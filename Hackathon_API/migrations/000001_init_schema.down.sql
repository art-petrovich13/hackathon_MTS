-- users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- flavors
CREATE TABLE flavors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cpu INT NOT NULL,
    ram_mb INT NOT NULL,
    disk_gb INT NOT NULL
);

-- images
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    docker_image TEXT NOT NULL,
    os_type TEXT NOT NULL,
    version TEXT,
    imported BOOLEAN DEFAULT FALSE,
    source_url TEXT,
    status TEXT DEFAULT 'active'
);

-- compute_nodes
CREATE TABLE compute_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    total_cpu INT NOT NULL,
    total_ram_mb INT NOT NULL,
    free_cpu INT NOT NULL,
    free_ram_mb INT NOT NULL,
    status TEXT DEFAULT 'active'
);

-- vms
CREATE TABLE vms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    flavor_id UUID REFERENCES flavors(id),
    image_id UUID REFERENCES images(id),
    status TEXT NOT NULL,
    docker_container_id TEXT,
    ip_address INET,
    node_id UUID REFERENCES compute_nodes(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- snapshots
CREATE TABLE snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vm_id UUID REFERENCES vms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    docker_image_name TEXT,
    size_mb INT,
    status TEXT DEFAULT 'creating',
    created_at TIMESTAMP DEFAULT NOW()
);

-- vm_metrics
CREATE TABLE vm_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vm_id UUID REFERENCES vms(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT NOW(),
    cpu_avg FLOAT,
    ram_avg INT,
    network_rx_bytes BIGINT,
    network_tx_bytes BIGINT
);

-- recommendations
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vm_id UUID REFERENCES vms(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    current_flavor_id UUID REFERENCES flavors(id),
    suggested_flavor_id UUID REFERENCES flavors(id),
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- import_tasks
CREATE TABLE import_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    image_name TEXT NOT NULL,
    os_type TEXT,
    version TEXT,
    status TEXT DEFAULT 'pending',
    image_id UUID REFERENCES images(id),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);