package mobile

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	dockerclient "github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/docker/go-connections/nat"
)

type MobileDriver struct {
	client *dockerclient.Client
}

type CreateMobileOpts struct {
	Name      string
	OSVersion string // "android-11", "android-12"
	ADBPort   int
	VNCPort   int
	NoVNCPort int
}

type MobileInstance struct {
	ContainerID string
	ADBHost     string
	VNCEndpoint string
	NoVNCURL    string
}

func NewMobileDriver() (*MobileDriver, error) {
	cli, err := dockerclient.NewClientWithOpts(
		dockerclient.FromEnv,
		dockerclient.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("mobile driver: docker client: %w", err)
	}
	return &MobileDriver{client: cli}, nil
}

// CheckKVM проверяет наличие /dev/kvm (аппаратная виртуализация)
func (d *MobileDriver) CheckKVM() bool {
	_, err := os.Stat("/dev/kvm")
	return err == nil
}

func (d *MobileDriver) Create(ctx context.Context, opts *CreateMobileOpts) (*MobileInstance, error) {
	dockerImage := "budtmo/docker-android:emulator_11.0"
	if opts.OSVersion == "android-12" {
		dockerImage = "budtmo/docker-android:emulator_12.0"
	}

	slog.Info("mobile driver: pulling image", "image", dockerImage)
	if err := d.ensureImage(ctx, dockerImage); err != nil {
		return nil, fmt.Errorf("pull image: %w", err)
	}

	envs := []string{
		"EMULATOR_DEVICE=Samsung Galaxy S10",
		"WEB_VNC=true",
		"NOVNC=true",         // ← без этого noVNC не запускается
		"DATAPARTITION=1024", // ← 1GB для данных эмулятора
	}

	// Если KVM недоступен — запускаем без аппаратного ускорения
	if !d.CheckKVM() {
		slog.Warn("mobile driver: KVM not available, using software rendering (SLOW)")
	}

	containerName := fmt.Sprintf("iaas-mobile-%s", opts.Name)

	portBindings := nat.PortMap{
		"5555/tcp": {{HostPort: fmt.Sprintf("%d", opts.ADBPort)}},
		"5900/tcp": {{HostPort: fmt.Sprintf("%d", opts.VNCPort)}},
		"6080/tcp": {{HostPort: fmt.Sprintf("%d", opts.NoVNCPort)}},
	}
	exposedPorts := nat.PortSet{
		"5555/tcp": struct{}{},
		"5900/tcp": struct{}{},
		"6080/tcp": struct{}{},
	}

	// Пробрасываем /dev/kvm если доступен
	var binds []string
	if d.CheckKVM() {
		binds = []string{"/dev/kvm:/dev/kvm"}
	}

	resp, err := d.client.ContainerCreate(ctx,
		&container.Config{
			Image:        dockerImage,
			ExposedPorts: exposedPorts,
			Env:          envs,
		},
		&container.HostConfig{
			PortBindings: portBindings,
			Privileged:   true,
			Binds:        binds,
		},
		nil, nil,
		containerName,
	)
	if err != nil {
		return nil, fmt.Errorf("container create: %w", err)
	}

	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("container start: %w", err)
	}

	// Возвращаем сразу — ожидание готовности делается в воркере через WaitForReady()
	return &MobileInstance{
		ContainerID: resp.ID,
		ADBHost:     "127.0.0.1",
		VNCEndpoint: fmt.Sprintf("vnc://127.0.0.1:%d", opts.VNCPort),
		NoVNCURL:    fmt.Sprintf("http://127.0.0.1:%d/vnc.html", opts.NoVNCPort),
	}, nil
}

// WaitForReady ждёт пока Android эмулятор внутри контейнера не будет готов.
// WaitForReady ждёт готовности Android эмулятора.
// Проверяет логи контейнера на наличие "Boot animation finished"
// (надёжнее чем adb devices, работает без KVM).
func (d *MobileDriver) WaitForReady(ctx context.Context, containerID string) error {
	slog.Info("mobile driver: waiting for android emulator to be ready", "container", containerID[:12])

	for attempt := 1; ; attempt++ {
		select {
		case <-ctx.Done():
			return fmt.Errorf("emulator not ready after %d attempts (~%ds)", attempt, attempt*5)
		default:
		}

		// Проверяем логи контейнера — ищем признак завершения загрузки Android
		logsReader, err := d.client.ContainerLogs(ctx, containerID, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Tail:       "100",
		})
		if err == nil {
			var buf bytes.Buffer
			io.Copy(&buf, logsReader) //nolint:errcheck
			logsReader.Close()
			logs := buf.String()

			// budtmo/docker-android пишет это когда эмулятор полностью загружен
			if strings.Contains(logs, "Boot animation finished") ||
				strings.Contains(logs, "Emulator is ready") ||
				strings.Contains(logs, "boot completed") {
				slog.Info("mobile driver: emulator ready (boot animation finished)", "attempt", attempt)
				return nil
			}
		}

		// Резервная проверка через adb devices (работает после старта adb-сервера внутри контейнера)
		execID, err := d.client.ContainerExecCreate(ctx, containerID, container.ExecOptions{
			Cmd:          []string{"adb", "devices"},
			AttachStdout: true,
			AttachStderr: true,
		})
		if err == nil {
			if execResp, err := d.client.ContainerExecAttach(ctx, execID.ID, container.ExecAttachOptions{}); err == nil {
				var stdout bytes.Buffer
				stdcopy.StdCopy(&stdout, io.Discard, execResp.Reader)
				execResp.Close()
				output := stdout.String()
				if strings.Contains(output, "emulator") ||
					(strings.Contains(output, "\tdevice") && !strings.HasSuffix(strings.TrimSpace(output), "devices")) {
					slog.Info("mobile driver: emulator ready (adb devices)", "attempt", attempt)
					return nil
				}
			}
		}

		if attempt%6 == 0 {
			slog.Info("mobile driver: still waiting for emulator",
				"attempt", attempt,
				"elapsed_sec", attempt*5,
			)
		}
		time.Sleep(5 * time.Second)
	}
}

func (d *MobileDriver) Delete(ctx context.Context, containerID string) error {
	return d.client.ContainerRemove(ctx, containerID, container.RemoveOptions{Force: true, RemoveVolumes: true})
}

func (d *MobileDriver) StartContainer(ctx context.Context, containerID string) error {
	return d.client.ContainerStart(ctx, containerID, container.StartOptions{})
}

func (d *MobileDriver) StopContainer(ctx context.Context, containerID string) error {
	timeout := 10
	return d.client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
}

func (d *MobileDriver) ensureImage(ctx context.Context, img string) error {
	_, _, err := d.client.ImageInspectWithRaw(ctx, img)
	if err == nil {
		return nil
	}

	pullCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	reader, err := d.client.ImagePull(pullCtx, img, image.PullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	_, err = io.Copy(io.Discard, reader)

	_ = filters.NewArgs()
	return err
}