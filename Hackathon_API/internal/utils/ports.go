package utils

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

const (
	PortRangeStart = 10000
	PortRangeEnd   = 25000
)

// AllocatePort находит свободный порт на указанной ноде и атомарно
// регистрирует его в port_allocations.
// Вызывать ВНУТРИ транзакции.
func AllocatePort(tx *sqlx.Tx, nodeID uuid.UUID, serviceType string, serviceID uuid.UUID) (int, error) {
	var usedPorts []int
	if err := tx.Select(&usedPorts,
		`SELECT port FROM port_allocations WHERE node_id = $1`,
		nodeID,
	); err != nil {
		return 0, fmt.Errorf("query used ports: %w", err)
	}

	usedSet := make(map[int]bool, len(usedPorts))
	for _, p := range usedPorts {
		usedSet[p] = true
	}

	for port := PortRangeStart; port < PortRangeEnd; port++ {
		if usedSet[port] {
			continue
		}
		_, err := tx.Exec(
			`INSERT INTO port_allocations (node_id, port, service_type, service_id)
			 VALUES ($1, $2, $3, $4)`,
			nodeID, port, serviceType, serviceID,
		)
		if err == nil {
			return port, nil
		}
		// Нарушение UNIQUE — порт заняли параллельно, пробуем следующий
	}

	return 0, errors.New("no free ports available on node")
}

// FreePort освобождает порт при удалении сервиса.
// Вызывать ВНУТРИ транзакции.
func FreePort(tx *sqlx.Tx, nodeID uuid.UUID, port int) error {
	_, err := tx.Exec(
		`DELETE FROM port_allocations WHERE node_id = $1 AND port = $2`,
		nodeID, port,
	)
	return err
}

// FreeServicePorts освобождает все порты конкретного сервиса.
// Вызывать ВНУТРИ транзакции.
func FreeServicePorts(tx *sqlx.Tx, serviceID uuid.UUID) error {
	_, err := tx.Exec(
		`DELETE FROM port_allocations WHERE service_id = $1`,
		serviceID,
	)
	return err
}