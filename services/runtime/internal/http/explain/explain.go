package explain

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/wrapperspb"
)

const latestModelOnly = 1

const noSchemaMessage = `this environment has no published schema yet. Publish one with "peretyn apply", then retry.`

var (
	typeRestrictionPattern   = regexp.MustCompile(`'([^']+)' is not an allowed type restriction for '([^'#]+)#([^']+)'`)
	undefinedRelationPattern = regexp.MustCompile(`relation '([^'#]+)#([^']+)' not found`)
	undefinedTypePattern     = regexp.MustCompile(`type '([^']+)' not found`)
)

type ModelReader interface {
	ReadAuthorizationModels(context.Context, *openfgav1.ReadAuthorizationModelsRequest) (*openfgav1.ReadAuthorizationModelsResponse, error)
}

type Explainer struct {
	models ModelReader
}

func New(models ModelReader) Explainer {
	return Explainer{models: models}
}

type rejectedTuple struct {
	storeID    string
	subject    string
	objectType string
	relation   string
}

func (e Explainer) Explain(ctx context.Context, storeID string, err error) (string, bool) {
	engineStatus := status.Convert(err)
	if engineStatus.Code() == codes.Code(openfgav1.ErrorCode_latest_authorization_model_not_found) {
		return noSchemaMessage, true
	}
	message := engineStatus.Message()
	if match := typeRestrictionPattern.FindStringSubmatch(message); match != nil {
		return e.explainTypeRestriction(ctx, rejectedTuple{storeID: storeID, subject: match[1], objectType: match[2], relation: match[3]})
	}
	if match := undefinedRelationPattern.FindStringSubmatch(message); match != nil {
		return fmt.Sprintf(`"%s" is not a relation or permission of "%s" in the published schema.`, match[2], match[1]), true
	}
	if match := undefinedTypePattern.FindStringSubmatch(message); match != nil {
		return fmt.Sprintf(`"%s" is not a type in the published schema.`, match[1]), true
	}
	return "", false
}

func (e Explainer) explainTypeRestriction(ctx context.Context, tuple rejectedTuple) (string, bool) {
	allowed, found := e.allowedSubjects(ctx, tuple)
	if !found {
		return "", false
	}
	if len(allowed) == 0 {
		return fmt.Sprintf(`"%s" is a permission of "%s", so tuples can't be written to it. Write the tuple to a relation that "%s" is computed from.`,
			tuple.relation, tuple.objectType, tuple.relation), true
	}
	return fmt.Sprintf(`relation "%s" of "%s" doesn't accept "%s" subjects. The schema allows: %s. Add "%s" to its targets, or write a subject it accepts.`,
		tuple.relation, tuple.objectType, tuple.subject, strings.Join(allowed, ", "), tuple.subject), true
}

func (e Explainer) allowedSubjects(ctx context.Context, tuple rejectedTuple) ([]string, bool) {
	resp, err := e.models.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{StoreId: tuple.storeID, PageSize: wrapperspb.Int32(latestModelOnly)})
	if err != nil || len(resp.GetAuthorizationModels()) == 0 {
		return nil, false
	}
	for _, typeDefinition := range resp.GetAuthorizationModels()[0].GetTypeDefinitions() {
		if typeDefinition.GetType() == tuple.objectType {
			return formatTargets(typeDefinition.GetMetadata().GetRelations()[tuple.relation].GetDirectlyRelatedUserTypes()), true
		}
	}
	return nil, false
}

func formatTargets(references []*openfgav1.RelationReference) []string {
	targets := make([]string, 0, len(references))
	for _, reference := range references {
		targets = append(targets, formatTarget(reference))
	}
	return targets
}

func formatTarget(reference *openfgav1.RelationReference) string {
	if reference.GetWildcard() != nil {
		return reference.GetType() + ":*"
	}
	if reference.GetRelation() != "" {
		return reference.GetType() + "#" + reference.GetRelation()
	}
	return reference.GetType()
}
