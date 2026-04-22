package models

import (
	"time"

	"github.com/google/uuid"
)

type ObjectStorage struct {
	ID                uuid.UUID  `db:"id"                   json:"id"`
	Name              string     `db:"name"                 json:"name"`
	ProjectID         uuid.UUID  `db:"project_id"           json:"project_id"`
	FlavorID          uuid.UUID  `db:"flavor_id"            json:"flavor_id"`
	Status            string     `db:"status"               json:"status"`
	DockerContainerID *string    `db:"docker_container_id"  json:"docker_container_id,omitempty"`
	NodeID            *uuid.UUID `db:"node_id"              json:"node_id,omitempty"`
	S3Endpoint        *string    `db:"s3_endpoint"          json:"s3_endpoint,omitempty"`
	ConsoleEndpoint   *string    `db:"console_endpoint"     json:"console_endpoint,omitempty"`
	AccessKey         *string    `db:"access_key"           json:"access_key,omitempty"`
	SecretKey         *string    `db:"secret_key"           json:"secret_key,omitempty"`
	BucketName        *string    `db:"bucket_name"          json:"bucket_name,omitempty"`
	StorageLimitGB    *int       `db:"storage_limit_gb"     json:"storage_limit_gb,omitempty"`
	CreatedAt         time.Time  `db:"created_at"           json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at"           json:"updated_at"`
}

type CreateObjectStorageRequest struct {
	Name       string    `json:"name"`
	ProjectID  uuid.UUID `json:"project_id"`
	FlavorID   uuid.UUID `json:"flavor_id"`
	BucketName string    `json:"bucket_name"`
}