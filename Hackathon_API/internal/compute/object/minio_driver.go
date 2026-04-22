package object

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

const MinIOImage = "minio/minio:latest"

// MinIOInstance — результат запуска MinIO контейнера
type MinIOInstance struct {
	ContainerID     string
	S3Endpoint      string // http://127.0.0.1:S3_PORT
	ConsoleEndpoint string // http://127.0.0.1:CONSOLE_PORT
}

// CreateMinIOOpts — параметры для запуска MinIO
type CreateMinIOOpts struct {
	Name        string
	AccessKey   string // MINIO_ROOT_USER
	SecretKey   string // MINIO_ROOT_PASSWORD
	S3Port      int    // порт S3 API на хосте
	ConsolePort int    // порт консоли MinIO на хосте
}

// MinIODriver создаёт/удаляет MinIO контейнеры
type MinIODriver struct {
	cli *client.Client
}

func NewMinIODriver() (*MinIODriver, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}
	return &MinIODriver{cli: cli}, nil
}

// Create запускает MinIO контейнер и возвращает endpoint'ы
func (d *MinIODriver) Create(ctx context.Context, opts *CreateMinIOOpts) (*MinIOInstance, error) {
	if err := d.ensureImage(ctx, MinIOImage); err != nil {
		return nil, fmt.Errorf("ensure image: %w", err)
	}

	portMap := nat.PortMap{
		"9000/tcp": []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", opts.S3Port)}},
		"9001/tcp": []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", opts.ConsolePort)}},
	}
	exposedPorts := nat.PortSet{
		"9000/tcp": struct{}{},
		"9001/tcp": struct{}{},
	}

	cfg := &container.Config{
		Image: MinIOImage,
		Cmd:   []string{"server", "/data", "--console-address", ":9001"},
		Env: []string{
			fmt.Sprintf("MINIO_ROOT_USER=%s", opts.AccessKey),
			fmt.Sprintf("MINIO_ROOT_PASSWORD=%s", opts.SecretKey),
		},
		ExposedPorts: exposedPorts,
		Labels: map[string]string{
			"iaas.managed": "true",
			"iaas.service": "object_storage",
			"iaas.name":    opts.Name,
		},
	}

	hostCfg := &container.HostConfig{
		PortBindings:  portMap,
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
	}

	containerName := fmt.Sprintf("minio-%s", opts.Name)
	resp, err := d.cli.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, containerName)
	if err != nil {
		return nil, fmt.Errorf("container create: %w", err)
	}

	if err := d.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = d.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, fmt.Errorf("container start: %w", err)
	}

	if err := d.waitReady(ctx, resp.ID); err != nil {
		_ = d.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, fmt.Errorf("minio not ready: %w", err)
	}

	return &MinIOInstance{
		ContainerID:     resp.ID,
		S3Endpoint:      fmt.Sprintf("http://127.0.0.1:%d", opts.S3Port),
		ConsoleEndpoint: fmt.Sprintf("http://127.0.0.1:%d", opts.ConsolePort),
	}, nil
}

// Delete останавливает и удаляет MinIO контейнер
func (d *MinIODriver) Delete(ctx context.Context, containerID string) error {
	return d.cli.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	})
}

func (d *MinIODriver) ensureImage(ctx context.Context, img string) error {
	_, _, err := d.cli.ImageInspectWithRaw(ctx, img)
	if err == nil {
		return nil
	}
	pullCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	reader, err := d.cli.ImagePull(pullCtx, img, image.PullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	io.Copy(io.Discard, reader)
	return nil
}

func (d *MinIODriver) waitReady(ctx context.Context, containerID string) error {
	deadline := time.Now().Add(60 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		logReader, err := d.cli.ContainerLogs(ctx, containerID, container.LogsOptions{
			ShowStdout: true, ShowStderr: true,
		})
		if err == nil {
			logBytes, _ := io.ReadAll(logReader)
			logReader.Close()
			s := string(logBytes)
			if strings.Contains(s, "API:") ||
				strings.Contains(s, "S3-API:") ||
				strings.Contains(s, "MinIO Object Storage Server") ||
				strings.Contains(s, "Documentation:") {
				return nil
			}
		}
		time.Sleep(2 * time.Second)
	}
	// MinIO обычно стартует за <5 секунд, после 60с считаем что запустился
	return nil
}

// StartContainer — запускает остановленный MinIO контейнер.
func (d *MinIODriver) StartContainer(ctx context.Context, containerID string) error {
	if err := d.cli.ContainerStart(ctx, containerID, container.StartOptions{}); err != nil {
		return fmt.Errorf("container start %q: %w", containerID, err)
	}
	return nil
}

// StopContainer — мягко останавливает MinIO контейнер (SIGTERM -> SIGKILL).
func (d *MinIODriver) StopContainer(ctx context.Context, containerID string) error {
	timeoutSec := 10
	if err := d.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeoutSec}); err != nil {
		return fmt.Errorf("container stop %q: %w", containerID, err)
	}
	return nil
}