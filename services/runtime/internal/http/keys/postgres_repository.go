package keys

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const uniqueViolation = "23505"

type PostgresRepository struct {
	pool  *pgxpool.Pool
	table string
}

func NewPostgresRepository(pool *pgxpool.Pool, schema string) *PostgresRepository {
	return &PostgresRepository{pool: pool, table: pgx.Identifier{schema, "api_key"}.Sanitize()}
}

func (r *PostgresRepository) Insert(ctx context.Context, record Record) error {
	_, err := r.pool.Exec(ctx, fmt.Sprintf(`
		INSERT INTO %s
			(environment_uuid, openfga_store_id, project_slug, environment_name,
			 key_hash, key_prefix, key_last4)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`, r.table),
		record.EnvironmentUUID, record.StoreID, record.ProjectSlug, record.EnvironmentName,
		record.Hash, record.Prefix, record.Last4)
	if pgErr := (*pgconn.PgError)(nil); errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return ErrExists
	}
	if err != nil {
		return fmt.Errorf("insert api_key: %w", err)
	}
	return nil
}

func (r *PostgresRepository) Replace(ctx context.Context, envUUID string, issue func(environmentName string) Credential) (string, error) {
	var oldHash string
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		var envName string
		err := tx.QueryRow(ctx, fmt.Sprintf(`
			SELECT environment_name, key_hash FROM %s
			WHERE environment_uuid = $1 FOR UPDATE`, r.table), envUUID).
			Scan(&envName, &oldHash)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("select api_key: %w", err)
		}
		return r.updateCredential(ctx, tx, Record{EnvironmentUUID: envUUID, Credential: issue(envName)})
	})
	if errors.Is(err, ErrNotFound) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("rotate api_key transaction: %w", err)
	}
	return oldHash, nil
}

func (r *PostgresRepository) updateCredential(ctx context.Context, tx pgx.Tx, record Record) error {
	_, err := tx.Exec(ctx, fmt.Sprintf(`
		UPDATE %s
		SET key_hash = $1, key_prefix = $2, key_last4 = $3, rotated_at = NOW()
		WHERE environment_uuid = $4`, r.table),
		record.Hash, record.Prefix, record.Last4, record.EnvironmentUUID)
	if err != nil {
		return fmt.Errorf("rotate api_key: %w", err)
	}
	return nil
}

func (r *PostgresRepository) Remove(ctx context.Context, envUUID string) (string, bool, error) {
	var keyHash string
	err := r.pool.QueryRow(ctx, fmt.Sprintf(`
		DELETE FROM %s WHERE environment_uuid = $1 RETURNING key_hash`, r.table), envUUID).
		Scan(&keyHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("delete api_key: %w", err)
	}
	return keyHash, true, nil
}

func (r *PostgresRepository) FindByHash(ctx context.Context, keyHash string) (Record, bool, error) {
	record := Record{Credential: Credential{Hash: keyHash}}
	err := r.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT environment_uuid, openfga_store_id, project_slug, environment_name
		FROM %s WHERE key_hash = $1`, r.table), keyHash).
		Scan(&record.EnvironmentUUID, &record.StoreID, &record.ProjectSlug, &record.EnvironmentName)
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, false, nil
	}
	if err != nil {
		return Record{}, false, fmt.Errorf("lookup api_key: %w", err)
	}
	return record, true, nil
}

func (r *PostgresRepository) All(ctx context.Context) ([]Record, error) {
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT environment_uuid, openfga_store_id, project_slug, environment_name, key_hash
		FROM %s`, r.table))
	if err != nil {
		return nil, fmt.Errorf("warm cache query: %w", err)
	}
	records, err := pgx.CollectRows(rows, scanRecord)
	if err != nil {
		return nil, fmt.Errorf("warm cache rows: %w", err)
	}
	return records, nil
}

func scanRecord(row pgx.CollectableRow) (Record, error) {
	var record Record
	err := row.Scan(&record.EnvironmentUUID, &record.StoreID, &record.ProjectSlug, &record.EnvironmentName, &record.Hash)
	if err != nil {
		return Record{}, fmt.Errorf("warm cache scan: %w", err)
	}
	return record, nil
}
