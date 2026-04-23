<div align="center">

# ⬡ IaaSPanel

**Облачная IaaS-платформа с агентным ИИ**

[![Go](https://img.shields.io/badge/Go_1.25-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

*Проект хакатона MTS — полноценная IaaS-платформа с поддержкой VM, управляемых БД, S3-хранилищ, мобильной фермы и агентного ИИ для автоматического развёртывания инфраструктуры*

</div>

---

## 🗂 Содержание

- [О проекте](#-о-проекте)
- [Ключевые возможности](#-ключевые-возможности)
- [Технологии](#-технологии)
- [Структура репозитория](#-структура-репозитория)
- [Быстрый старт](#-быстрый-старт)
- [API](#-api)
- [Роли пользователей](#-роли-пользователей)
- [AgentMesh — AI-агент](#-agentmesh--ai-агент)
- [База данных](#-база-данных)
- [Тестовые аккаунты](#-тестовые-аккаунты)
- [Команда](#-команда)

---

## 🚀 О проекте

**IaaSPanel** — это полнофункциональная облачная платформа «Инфраструктура как сервис», построенная на Docker. Платформа позволяет пользователям разворачивать виртуальные машины, управляемые базы данных, объектные и файловые хранилища, а также Android-эмуляторы — всё из единого интерфейса.

Главная отличительная черта — **AgentMesh**: система агентного ИИ, которая принимает описание задачи на естественном языке и автоматически проектирует и разворачивает оптимальную инфраструктуру. Пользователь пишет «нужен интернет-магазин на 1000 пользователей» — платформа за несколько минут поднимает VM, PostgreSQL и S3-хранилище.

---

## ✨ Ключевые возможности

### Инфраструктурные сервисы

| Сервис | Технология | Что умеет |
|--------|-----------|-----------|
| 🖥️ **Virtual Machines** | Docker containers | Создание, старт/стоп, консоль (noVNC) |
| 🗄️ **Managed Databases** | PostgreSQL · MySQL · Redis | Авто-генерация credentials, старт/стоп |
| 📦 **Object Storage** | MinIO (S3-compatible) | Бакеты, access/secret keys, S3-endpoint |
| 💾 **File Storage** | NFS server | Файловые шары, NFS-endpoint |
| 📱 **Mobile Farm** | Android emulators (ADB + noVNC) | Удалённый экран в браузере |

### Платформенные возможности

- 🔐 **JWT-авторизация** с разделением ролей `admin` / `user`
- 🤖 **AgentMesh** — AI-агент на основе OpenRouter (Mistral), который разворачивает инфраструктуру по текстовому описанию
- 📺 **noVNC** — браузерный экран для Android-эмуляторов (`/screen/:id`)
- 📊 **Admin Dashboard** — мониторинг всех ресурсов и пользователей
- ⚡ **Автообнаружение** — воркеры каждые 5 секунд синхронизируют реальное состояние Docker с БД
- 🔄 **Graceful shutdown** — корректная остановка воркеров и HTTP-сервера
- 📏 **Resource limits** — лимиты на VM, CPU, RAM, БД, хранилища на проект

---

## 🛠 Технологии

### Backend (`Hackathon_API`)

| Технология | Назначение |
|-----------|-----------|
| **Go 1.25** | Основной язык |
| **Chi v5** | HTTP-роутер |
| **sqlx + pgx** | Работа с PostgreSQL |
| **golang-migrate** | Миграции схемы БД |
| **Docker SDK** | Управление контейнерами |
| **golang-jwt/jwt v5** | JWT-аутентификация |
| **bcrypt** | Хэширование паролей |
| **OpenRouter API** | AI-агент (Mistral model) |
| **Viper** | Конфигурация через env |
| **Slog** | Структурированное логирование |

### Frontend (`Hackathon-UI`)

| Технология | Назначение |
|-----------|-----------|
| **React 18 + TypeScript** | UI-фреймворк |
| **Vite 5** | Сборщик |
| **TanStack Query v5** | Кэш и состояние данных |
| **React Router DOM v6** | Клиентская маршрутизация |
| **Axios** | HTTP-клиент с interceptor |
| **Recharts** | Графики и метрики |
| **Lucide React** | Иконки |
| **React Hot Toast** | Уведомления |
| **CSS Modules** | Стилизация компонентов |

---

## 📁 Структура репозитория

```
hackathon_MTS/
│
├── Hackathon_API/                     # Go Backend
│   ├── cmd/
│   │   ├── api/main.go               # Точка входа, роутер, воркеры
│   │   └── hashgen/main.go           # Утилита генерации bcrypt-хэша
│   │
│   ├── internal/
│   │   ├── agent/                    # AgentMesh — AI-оркестратор
│   │   │   ├── orchestrator.go       # Главный агент (OpenRouter API)
│   │   │   ├── subagents.go          # VM-, DB-, Storage-агенты
│   │   │   ├── deployer.go           # Исполнение плана агента
│   │   │   ├── presets.go            # Готовые решения (ритейл, медицина…)
│   │   │   └── protocol.go           # Типы протокола агента
│   │   │
│   │   ├── auth/jwt.go               # Генерация и валидация JWT
│   │   ├── ctxkeys/keys.go           # Ключи контекста (Claims)
│   │   ├── config/config.go          # Конфигурация через env/viper
│   │   ├── middleware/auth.go        # Authenticate, RequireAdmin
│   │   │
│   │   ├── compute/
│   │   │   ├── docker/               # DockerDriver — создание VM
│   │   │   ├── db/                   # DatabaseDriver — PostgreSQL/MySQL/Redis
│   │   │   ├── object/               # MinIODriver — Object Storage
│   │   │   ├── mobile/               # MobileDriver — Android ADB
│   │   │   ├── sim/                  # SimDriver — заглушка для тестов
│   │   │   └── driver/               # Интерфейс ComputeDriver
│   │   │
│   │   ├── handlers/                 # HTTP-хендлеры
│   │   │   ├── agent_handler.go      # POST /agent/execute, /agent/preset + SSE
│   │   │   ├── auth_handler.go       # POST /auth/login, /register, GET /auth/me
│   │   │   ├── vm_handler.go         # CRUD VM + start/stop/console
│   │   │   ├── database_handler.go   # CRUD Database + start/stop
│   │   │   ├── object_storage_handler.go
│   │   │   ├── file_storage_handler.go
│   │   │   ├── mobile_handler.go
│   │   │   ├── user_handler.go       # CRUD Users + лимиты (admin)
│   │   │   ├── flavor_handler.go
│   │   │   ├── image_handler.go
│   │   │   ├── node_handler.go
│   │   │   └── service_catalog_handler.go
│   │   │
│   │   ├── models/                   # Структуры сущностей (sqlx db-теги)
│   │   ├── repository/               # Репозитории (SQL-запросы)
│   │   ├── services/
│   │   │   ├── vm_service.go         # Бизнес-логика VM
│   │   │   ├── limits_checker.go     # Проверка лимитов ресурсов
│   │   │   └── startup_cleanup.go    # Очистка зависших pending при старте
│   │   ├── utils/
│   │   │   ├── ports.go              # Атомарное выделение портов на ноде
│   │   │   └── crypto.go             # Генерация паролей и ключей
│   │   └── worker/                   # Асинхронные воркеры (5-секундный тик)
│   │       ├── vm_worker.go
│   │       ├── db_worker.go
│   │       ├── object_storage_worker.go
│   │       ├── file_storage_worker.go
│   │       ├── mobile_worker.go
│   │       └── reconcile_worker.go   # Реконцилиация Docker ↔ БД (1 мин)
│   │
│   └── migrations/
│       ├── 000001_init_schema        # users, projects, vms, flavors, images, nodes
│       ├── 000002_services           # managed_databases, object/file storages, mobile
│       ├── 000003_fix_status_constraints  # pending-start / pending-stop статусы
│       ├── 000004_auth               # role в users, project_limits
│       ├── 000005_vm_novnc           # novnc_port для VM
│       └── seed.sql                  # Начальные данные (flavors, images, admin)
│
└── Hackathon-UI/                     # React Frontend
    └── src/
        ├── api/api.ts                # Axios client + все API-функции
        ├── types/api.ts              # TypeScript типы для всех сущностей
        ├── context/
        │   ├── AuthContext.tsx       # JWT + сессия в sessionStorage
        │   └── ThemeContext.tsx      # Тёмная/светлая тема
        ├── components/
        │   ├── auth/ProtectedRoute.tsx
        │   └── ui/                   # StatusBadge, EngineBadge, CredentialsModal,
        │                             # ResourceCard, VncViewer, UserFilter
        ├── layouts/
        │   ├── AdminLayout.tsx       # Сайдбар + хедер для admin
        │   └── UserLayout.tsx        # Сайдбар + хедер для user
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── public/               # LandingAboutPage, ContactsPage
        │   ├── admin/                # Dashboard, VMs, Databases, Storage,
        │   │                         # Mobile, Users, Catalog, Metrics,
        │   │                         # Recommendations, Snapshots, Images, Nodes
        │   └── user/
        │       ├── agent/AgentPage.tsx    # 🤖 AgentMesh UI (маркет + чат)
        │       ├── screen/ScreenPage.tsx  # noVNC fullscreen
        │       ├── dashboard/
        │       ├── compute/
        │       ├── databases/
        │       ├── storage/
        │       ├── mobile/
        │       └── snapshots/
        └── routes/AppRoutes.tsx      # Все роуты с ProtectedRoute
```

---

## ⚡ Быстрый старт

### Требования

- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+ LTS](https://nodejs.org/)
- [Docker + Docker Compose](https://docs.docker.com/get-docker/)
- [PostgreSQL 15+](https://www.postgresql.org/download/) (или через Docker)
- [golang-migrate](https://github.com/golang-migrate/migrate) (для миграций)

---

### 1. Клонировать репозиторий

```bash
git clone https://github.com/art-petrovich13/hackathon_MTS.git
cd hackathon_MTS
```

---

### 2. Запустить PostgreSQL

```bash
# Через Docker — быстро и просто
docker run -d \
  --name iaas-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=iaas \
  -p 5432:5432 \
  postgres:15
```

---

### 3. Настроить переменные окружения для Backend

```bash
cd Hackathon_API

# Создать .env файл
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mysecretpassword
DB_NAME=iaas
API_PORT=8080
OPENROUTER_API_KEY=your_openrouter_key_here
EOF
```

> **OpenRouter API Key** можно получить бесплатно на [openrouter.ai](https://openrouter.ai) — нужен для работы AI-агента. Без ключа агент недоступен, остальное работает.

---

### 4. Применить миграции и сиды

```bash
# Применить все миграции
migrate -path ./migrations -database "postgres://postgres:mysecretpassword@localhost:5432/iaas?sslmode=disable" up

# Загрузить начальные данные (flavors, images, admin-аккаунт)
psql -U postgres -d iaas -f migrations/seed.sql
```

---

### 5. Запустить Backend

```bash
cd Hackathon_API
go run ./cmd/api
```

```
INFO  server started           port=8080
INFO  vm worker launched
INFO  db worker launched
INFO  object storage worker launched
INFO  file storage worker launched
INFO  mobile worker launched
INFO  reconcile worker launched
```

API доступен на **http://localhost:8080**

---

### 6. Запустить Frontend

```bash
cd Hackathon-UI
npm install
npm run dev
```

Приложение доступно на **http://localhost:5173**

---

### 7. Войти в систему

| Роль | Email | Пароль |
|------|-------|--------|
| **Admin** | `admin@iaas.local` | `admin123` |

Зарегистрировать нового пользователя можно через форму `/login → Регистрация` или через API.

---

## 📡 API

Базовый URL: `http://localhost:8080/api/v1`

### Аутентификация

| Метод | Эндпоинт | Доступ | Описание |
|-------|----------|--------|----------|
| `POST` | `/auth/login` | Public | Вход. Тело: `{"email":"…","password":"…"}` |
| `POST` | `/auth/register` | Public | Регистрация нового пользователя |
| `GET` | `/auth/me` | Auth | Данные текущего пользователя из токена |

> Все защищённые запросы: `Authorization: Bearer <token>`

### Virtual Machines

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/vms` | Список VM (user — только свои) |
| `POST` | `/vms` | Создать VM |
| `GET` | `/vms/{id}` | Детали VM |
| `DELETE` | `/vms/{id}` | Удалить VM |
| `POST` | `/vms/{id}/start` | Запустить |
| `POST` | `/vms/{id}/stop` | Остановить |
| `GET` | `/vms/{id}/console` | noVNC-ссылка |

### Managed Databases

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/databases` | Список БД |
| `POST` | `/databases` | Создать (engine: `postgres`/`mysql`/`redis`) |
| `GET` | `/databases/{id}` | Детали + credentials |
| `DELETE` | `/databases/{id}` | Удалить |
| `POST` | `/databases/{id}/start` | Запустить |
| `POST` | `/databases/{id}/stop` | Остановить |

### Хранилища

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET/POST` | `/object-storages` | Object Storage (MinIO) |
| `POST` | `/object-storages/{id}/start` | Запустить |
| `POST` | `/object-storages/{id}/stop` | Остановить |
| `GET/POST` | `/file-storages` | File Storage (NFS) |

### Mobile Farm

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET/POST` | `/mobile-devices` | Список / создать Android-эмулятор |
| `POST` | `/mobile-devices/{id}/start` | Запустить |
| `POST` | `/mobile-devices/{id}/stop` | Остановить |

### AgentMesh

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `POST` | `/agent/execute` | Развернуть по тексту. SSE-поток статусов |
| `POST` | `/agent/preset` | Развернуть готовое решение по `preset_id` |

### Управление (Admin only)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/users` | Список всех пользователей |
| `POST` | `/users` | Создать пользователя |
| `DELETE` | `/users/{id}` | Удалить пользователя |
| `GET/PUT` | `/users/{id}/limits` | Лимиты ресурсов проекта |
| `GET` | `/service-catalog` | Каталог доступных сервисов |
| `GET` | `/service-catalog/full` | Каталог + вложенные flavors |
| `GET` | `/flavors` | Конфигурации ресурсов |
| `GET` | `/images` | Образы ОС |
| `GET` | `/nodes` | Compute-ноды |

---

## 👥 Роли пользователей

### Admin (`role: admin`)
- Видит **все** ресурсы всех пользователей
- Управляет пользователями: создание, удаление, установка лимитов
- Доступ к `/admin/*` — отдельный дашборд с полной статистикой

### User (`role: user`)
- Видит **только свои** ресурсы (изоляция по `project_id` из JWT)
- Создаёт VM, БД, хранилища и эмуляторы в рамках своих лимитов
- Доступ к `/dashboard`, `/compute`, `/databases`, `/storage`, `/mobile`, `/agent`

### Жизненный цикл ресурса

```
POST /vms  →  status: pending
                  ↓ VMWorker (5s тик)
           status: creating → running
                  ↓ POST /vms/{id}/stop
           status: pending-stop
                  ↓ VMWorker
           status: stopped
                  ↓ POST /vms/{id}/start
           status: pending-start
                  ↓ VMWorker
           status: running
```

---

## 🤖 AgentMesh — AI-агент

AgentMesh — это система агентного ИИ, реализованная поверх существующей инфраструктуры. Агент принимает текстовое описание задачи, анализирует её через OpenRouter (модель Mistral), формирует план из компонентов и разворачивает их через существующие сервисы.

### Как работает

```
Пользователь: "Разверни Django с PostgreSQL под 500 пользователей"
         │
         ▼
  Orchestrator (OpenRouter API)
  Анализирует запрос → JSON-план:
  { needs_vm: true, needs_db: true, engine: "postgres", users: 500 }
         │
         ┌────────────────┐
         ▼                ▼
    VmAgent          DbAgent
  (выбирает flavor  (выбирает pg-m
   medium по users)  по числу users)
         │                │
         └────────┬───────┘
                  ▼
            Deployer
    Создаёт VM + DB в БД → pending
    Воркеры подхватывают и запускают контейнеры
         │
         ▼
   SSE-поток → Frontend обновляется в реальном времени
```

### Готовые решения (Presets)

Маркетплейс на странице `/agent` включает 10 готовых отраслевых решений без AI-запроса:

| Пресет | Компоненты |
|--------|-----------|
| 🛒 Интернет-магазин | VM + PostgreSQL + Redis + S3 |
| 🏥 Телемедицина | VM + PostgreSQL + S3 |
| 🎓 LMS для школы | VM + PostgreSQL + S3 |
| 🏭 Цифровой двойник | VM + PostgreSQL + S3 |
| 🚀 MVP за 5 минут | VM + PostgreSQL |
| 📰 Медиаплатформа | VM + PostgreSQL + S3 (200GB) |
| 🎮 Игровой сервер | VM + Redis |
| 📊 Data Pipeline | VM + PostgreSQL + S3 (500GB) |
| 🔧 CI/CD окружение | VM + PostgreSQL + S3 |
| 💬 Корпоративный чат | VM + PostgreSQL + Redis + S3 |

---

## 🗄 База данных

Схема PostgreSQL, 5 миграций:

```
users              — email, password_hash, role (admin/user)
projects           — привязка пользователя к проекту
project_limits     — max_vms, max_cpu, max_ram_mb, max_dbs…

flavors            — конфигурации (cpu, ram, disk, service_type, docker_image)
images             — образы ОС (docker_image)
compute_nodes      — ноды (total_cpu, free_cpu, total_ram_mb…)
port_allocations   — реестр занятых портов (уникальность по node+port)

vms                — виртуальные машины (status, docker_container_id, novnc_port)
managed_databases  — БД (engine, host, port, db_user, db_password)
object_storages    — MinIO (s3_endpoint, access_key, secret_key)
file_storages      — NFS (volume_name, nfs_endpoint)
mobile_devices     — Android (adb_host, adb_port, vnc_port, novnc_port)

service_catalog    — каталог доступных типов сервисов
vm_metrics         — метрики CPU/RAM для аналитики
```

---

## 🔑 Тестовые аккаунты

После применения `seed.sql` автоматически создаётся:

| Роль | Email | Пароль |
|------|-------|--------|
| **Admin** | `admin@iaas.local` | `admin123` |

Дополнительных пользователей можно создать через:
- Форму регистрации на сайте (`/login`)
- `POST /api/v1/auth/register`
- Admin-панель `→ Users → + New User`

---

## 🌐 Адреса сервисов

| Сервис | Адрес |
|--------|-------|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:8080 |
| **Health check** | http://localhost:8080/health |

---

## 👨‍💻 Команда

| Разработчик | Роль | Стек |
|-------------|------|------|
| **P1** | Backend Developer | Go, Docker SDK, PostgreSQL, JWT |
| **P2** | Frontend Developer | React, TypeScript, TanStack Query |

---

<div align="center">

*Сделано на хакатоне MTS · 2026*

</div>
