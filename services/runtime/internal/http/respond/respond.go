package respond

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	servererrors "github.com/openfga/openfga/pkg/server/errors"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

const maxBodyBytes = 4 << 20

func DecodeProto(w http.ResponseWriter, r *http.Request, msg proto.Message) bool {
	return decode(w, r, func(raw []byte) error {
		if len(raw) == 0 {
			return nil
		}
		return protojson.UnmarshalOptions{DiscardUnknown: true}.Unmarshal(raw, msg)
	})
}

func DecodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	return decode(w, r, func(raw []byte) error { return json.Unmarshal(raw, v) })
}

func decode(w http.ResponseWriter, r *http.Request, unmarshal func([]byte) error) bool {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err == nil {
		err = unmarshal(raw)
	}
	if _, tooLarge := errors.AsType[*http.MaxBytesError](err); tooLarge {
		Error(w, http.StatusRequestEntityTooLarge, err.Error())
		return false
	}
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return false
	}
	return true
}

type Operation struct {
	Logger *zap.Logger
	Name   string
}

type FailureDetails struct {
	Operation  Operation
	StatusCode int
	Err        error
}

type failureReport struct {
	FailureDetails
	message string
}

func Engine[Req any, PReq interface {
	*Req
	proto.Message
}, Resp proto.Message](operation Operation, storeID func(*http.Request) string, call func(context.Context, PReq) (Resp, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := PReq(new(Req))
		if !DecodeProto(w, r, req) {
			return
		}
		m := req.ProtoReflect()
		m.Set(m.Descriptor().Fields().ByName("store_id"), protoreflect.ValueOfString(storeID(r)))
		resp, err := call(r.Context(), req)
		if err != nil {
			EngineError(w, r, FailureDetails{Operation: operation, Err: err})
			return
		}
		Proto(w, http.StatusOK, resp)
	}
}

func Proto(w http.ResponseWriter, status int, msg proto.Message) {
	w.Header().Set("Content-Type", "application/json")
	m := protojson.MarshalOptions{EmitUnpopulated: true}
	b, err := m.Marshal(msg)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(status)
	_, _ = w.Write(b)
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func Error(w http.ResponseWriter, status int, msg string) {
	if status >= http.StatusInternalServerError {
		msg = http.StatusText(status)
	}
	JSON(w, status, map[string]any{"error": msg, "code": status})
}

func Failure(w http.ResponseWriter, r *http.Request, details FailureDetails) {
	if errors.Is(details.Err, context.DeadlineExceeded) {
		details.StatusCode = http.StatusGatewayTimeout
	}
	failure(w, r, failureReport{FailureDetails: details, message: details.Err.Error()})
}

func EngineError(w http.ResponseWriter, r *http.Request, details FailureDetails) {
	statusCode, msg := engineStatus(details.Err)
	details.StatusCode = statusCode
	failure(w, r, failureReport{FailureDetails: details, message: msg})
}

func failure(w http.ResponseWriter, r *http.Request, report failureReport) {
	fields := []zap.Field{
		zap.String("op", report.Operation.Name),
		zap.Int("status", report.StatusCode),
		zap.String("request_id", requestIDFromCtx(r.Context())),
		zap.Error(report.Err),
	}
	if storeID := r.PathValue("id"); storeID != "" {
		fields = append(fields, zap.String("store_id", storeID))
	}
	level := zapcore.InfoLevel
	if report.StatusCode >= http.StatusInternalServerError {
		level = zapcore.ErrorLevel
	}
	report.Operation.Logger.Log(level, "request failed", fields...)
	Error(w, report.StatusCode, report.message)
}

func engineStatus(err error) (int, string) {
	encoded := servererrors.NewEncodedError(servererrors.ConvertToEncodedErrorCode(status.Convert(err)), err.Error())
	code := encoded.HTTPStatus()
	switch {
	case errors.Is(err, context.DeadlineExceeded), encoded.CodeValue() == int32(openfgav1.InternalErrorCode_deadline_exceeded):
		code = http.StatusGatewayTimeout
	case code >= http.StatusInternalServerError:
		code = http.StatusBadGateway
	}
	return code, encoded.Error()
}
