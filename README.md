# CTQ Audit RQC — Web Application

> **Critical To Quality Audit System — Roving Quality Control**
> Footwear Manufacturing Quality Inspection

## Architecture

```
NEXT.JS FRONTEND  →  NESTJS API  →  POSTGRESQL 16
                                 →  MINIO (Photos)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Backend | NestJS 10 + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Storage | MinIO (S3-compatible) |
| Cache | Redis |
| Container | Docker Compose |

## Quick Start

### Prerequisites
- Node.js >= 20
- Docker Desktop

### 1. Setup environment
```bash
cp .env.example .env
# Edit .env with your secrets
```

### 2. Start infrastructure
```bash
docker compose -f docker-compose.dev.yml up postgres minio redis -d
```

### 3. Install dependencies
```bash
npm install
```

### 4. Run database migration
```bash
npm run db:migrate:dev --workspace=packages/database
```

### 5. Seed development data
```bash
npm run db:seed --workspace=packages/database
```

### 6. Start development servers
```bash
# Terminal 1: API
npm run start:dev --workspace=apps/api

# Terminal 2: Web
npm run dev --workspace=apps/web
```

### Access
- **Web UI:** http://localhost:3000
- **API:** http://localhost:3001/api
- **Swagger:** http://localhost:3001/api/docs
- **MinIO Console:** http://localhost:9001

## Development Credentials (seed data)

| NIK | Password | Role |
|-----|----------|------|
| ADMIN001 | Admin@1234 | ADMIN |
| RQC001 | Rqc@1234 | RQC |

## Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation + Infrastructure | 🔄 In Progress |
| 2 | Master Data API | ⏳ Pending |
| 3 | CTQ Setup API | ⏳ Pending |
| 4 | RQC Header | ⏳ Pending |
| 5 | Area & Process Navigation | ⏳ Pending |
| 6 | Inspection + Calculation | ⏳ Pending |
| 7 | Immediate Action / CAP | ⏳ Pending |
| 8 | Analytics | ⏳ Pending |

## Documentation

- [PRD.md](Docs/PRD.md) — Product Requirements
- [TECH.md](Docs/TECH.md) — Technology Standards
- [TDD.md](Docs/TDD.md) — Technical Design Document

## Key Architectural Rules

1. **Backend is authoritative** — No business logic in frontend
2. **Configuration-driven** — CTQ setup from database, never hard-coded
3. **Historical integrity** — Completed audits are immutable
4. **Normalized schema** — No duplicate text columns, use FK relationships
5. **Migration mandatory** — Every schema change requires a migration file
