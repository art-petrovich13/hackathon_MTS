package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type NodeRepository struct {
	db *sqlx.DB
}

func NewNodeRepository(db *sqlx.DB) *NodeRepository {
	return &NodeRepository{db: db}
}

func (r *NodeRepository) List(ctx context.Context) ([]models.ComputeNode, error) {
	var nodes []models.ComputeNode
	query := `SELECT id, name, endpoint, total_cpu, total_ram_mb, free_cpu, free_ram_mb, status
	          FROM compute_nodes ORDER BY name`
	err := r.db.SelectContext(ctx, &nodes, query)
	return nodes, err
}

func (r *NodeRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ComputeNode, error) {
	var node models.ComputeNode
	query := `SELECT id, name, endpoint, total_cpu, total_ram_mb, free_cpu, free_ram_mb, status
	          FROM compute_nodes WHERE id = $1`
	err := r.db.GetContext(ctx, &node, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &node, err
}

// FindSuitableNode ищет узел с достаточными свободными ресурсами (используется при создании VM).
func (r *NodeRepository) FindSuitableNode(ctx context.Context, tx *sqlx.Tx, cpuReq, ramMBReq int) (*models.ComputeNode, error) {
	var node models.ComputeNode
	query := `SELECT id, name, endpoint, total_cpu, total_ram_mb, free_cpu, free_ram_mb, status
	          FROM compute_nodes
	          WHERE free_cpu >= $1 AND free_ram_mb >= $2 AND status = 'active'
	          ORDER BY free_cpu DESC, free_ram_mb DESC
	          LIMIT 1
	          FOR UPDATE` // блокируем строку для транзакции
	var err error
	if tx != nil {
		err = tx.GetContext(ctx, &node, query, cpuReq, ramMBReq)
	} else {
		err = r.db.GetContext(ctx, &node, query, cpuReq, ramMBReq)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &node, err
}

// UpdateResources обновляет свободные ресурсы узла (используется при резервировании/освобождении).
func (r *NodeRepository) UpdateResources(ctx context.Context, tx *sqlx.Tx, nodeID uuid.UUID, deltaCPU, deltaRAM int) error {
	query := `UPDATE compute_nodes
	          SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2
	          WHERE id = $3`
	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query, deltaCPU, deltaRAM, nodeID)
	} else {
		_, err = r.db.ExecContext(ctx, query, deltaCPU, deltaRAM, nodeID)
	}
	return err
}
