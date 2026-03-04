package mobile

import (
    "context"
    "fmt"
    "io"
    "log/slog"
    "time"

    "github.com/docker/docker/api/types/container"
    "github.com/docker/docker/api/types/filters"
    "github.com/docker/docker/api/types/image"
    dockerclient "github.com/docker/docker/client"
    "github.com/docker/go-connections/nat"
)

type MobileDriver struct {
    client *dockerclient.Client
}

type CreateMobileOpts struct {
    Name      string
    OSVersion string // "android-11", "android-12"
    ADBPort   int    // host порт для ADB (5554)
    VNCPort   int    // host порт для VNC (5900)
    NoVNCPort int    // host порт для noVNC web (6080)
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

func (d *MobileDriver) Create(ctx context.Context, opts *CreateMobileOpts) (*MobileInstance, error) {
    // Docker image для Android эмулятора
    dockerImage := "budtmo/docker-android:emulator_11.0"
    if opts.OSVersion == "android-12" {
        dockerImage = "budtmo/docker-android:emulator_12.0"
    }

    slog.Info("mobile driver: pulling image", "image", dockerImage)
    if err := d.ensureImage(ctx, dockerImage); err != nil {
        return nil, fmt.Errorf("pull image: %w", err)
    }

    containerName := fmt.Sprintf("iaas-mobile-%s", opts.Name)

    // Маппинг портов
    portBindings := nat.PortMap{
        "5554/tcp": {{HostPort: fmt.Sprintf("%d", opts.ADBPort)}},
        "5900/tcp": {{HostPort: fmt.Sprintf("%d", opts.VNCPort)}},
        "6080/tcp": {{HostPort: fmt.Sprintf("%d", opts.NoVNCPort)}},
    }
    exposedPorts := nat.PortSet{
        "5554/tcp": struct{}{},
        "5900/tcp": struct{}{},
        "6080/tcp": struct{}{},
    }

    resp, err := d.client.ContainerCreate(ctx,
        &container.Config{
            Image:        dockerImage,
            ExposedPorts: exposedPorts,
            Env: []string{
                "EMULATOR_DEVICE=Samsung Galaxy S10",
                "WEB_VNC=true",
            },
        },
        &container.HostConfig{
            PortBindings: portBindings,
            // Android эмулятор требует привилегий для KVM
            Privileged: true,
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

    return &MobileInstance{
        ContainerID: resp.ID,
        ADBHost:     "127.0.0.1",
        VNCEndpoint: fmt.Sprintf("vnc://127.0.0.1:%d", opts.VNCPort),
        NoVNCURL:    fmt.Sprintf("http://127.0.0.1:%d", opts.NoVNCPort),
    }, nil
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
    // Проверяем есть ли образ локально
    _, _, err := d.client.ImageInspectWithRaw(ctx, img)
    if err == nil {
        return nil
    }

    // Пуллим с таймаутом
    pullCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
    defer cancel()

    reader, err := d.client.ImagePull(pullCtx, img, image.PullOptions{})
    if err != nil {
        return err
    }
    defer reader.Close()
    // Дожидаемся завершения pull
    _, err = io.Copy(io.Discard, reader)
    
    // Проверяем что фильтры работают
    _ = filters.NewArgs()
    return err
}