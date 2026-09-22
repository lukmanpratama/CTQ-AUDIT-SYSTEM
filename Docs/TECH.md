# TECH.md --- CTQ Audit Web Application Technology Standard

## 1. Technology Decision

  Layer            Technology                 Standard
  ---------------- -------------------------- ----------------------------
  Frontend         Next.js                    TypeScript
  UI               React                      TypeScript
  Styling          Tailwind CSS               Utility-first
  Backend          NestJS                     TypeScript
  Database         PostgreSQL 16              Relational source of truth
  ORM              Prisma 5 or Drizzle        Select one and standardize
  API              REST                       JSON
  Validation       Zod / class-validator      Backend authoritative
  Authentication   JWT / secure session       HTTP-only where applicable
  File Storage     MinIO / S3-compatible      Photos/evidence
  Container        Docker                     Development + Production
  Reverse Proxy    Nginx                      Production
  Cache/Queue      Redis                      Only when required
  Testing          Vitest/Jest + Playwright   Unit/integration/E2E
  API Docs         OpenAPI/Swagger            Backend contract
  CI               GitHub Actions             Lint/test/build/migration

------------------------------------------------------------------------

# 2. Recommended Repository

``` text
ctqaudit/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── database/
│   ├── types/
│   └── config/
├── docs/
│   ├── PRD.md
│   ├── TDD.md
│   └── TECH.md
├── docker/
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── README.md
```

If a monorepo is unnecessary for the current team, a two-app repository
is also acceptable.

------------------------------------------------------------------------

# 3. Frontend Standard

Use:

``` text
Next.js
TypeScript
React
Tailwind CSS
```

Recommended structure:

``` text
apps/web/
├── app/
├── components/
├── features/
│   └── rqc/
├── lib/
├── hooks/
├── services/
├── types/
└── tests/
```

Feature structure:

``` text
features/rqc/
├── components/
│   ├── ModelCard.tsx
│   ├── AreaButton.tsx
│   ├── ProcessButton.tsx
│   ├── DefectInput.tsx
│   ├── RqcHeaderForm.tsx
│   └── InspectionSummary.tsx
├── services/
├── hooks/
├── schemas/
└── types/
```

------------------------------------------------------------------------

# 4. Backend Standard

NestJS module structure:

``` text
apps/api/src/
├── auth/
├── users/
├── models/
├── po/
├── ctq-setup/
├── rqc/
│   ├── header/
│   ├── area/
│   ├── process/
│   └── inspection/
├── files/
├── common/
└── main.ts
```

Use:

-   DTOs for request contracts.
-   Services for business rules.
-   Controllers for HTTP concerns.
-   Repositories/data-access layer for persistence.
-   Guards for authorization.
-   Pipes for validation.

Controllers must not contain business logic.

------------------------------------------------------------------------

# 5. Database Technology

PostgreSQL 16.

Use UUID for transaction IDs:

``` text
rqc_header_id
rqc_area_id
rqc_process_id
rqc_inspection_id
```

Use stable integer IDs for small master/setup tables if preferred.

Do not mix ID strategies without a reason.

------------------------------------------------------------------------

# 6. ORM Standard

The project must select one ORM.

Preferred for a team already using Prisma:

``` text
Prisma 5.x
```

Avoid mixing Prisma and Drizzle in the same application.

ORM responsibilities:

-   migrations
-   schema mapping
-   query generation
-   transactions
-   typed data access

Business rules remain in NestJS services.

------------------------------------------------------------------------

# 7. API Rules

Base path:

``` text
/api
```

Use resource-oriented routes.

Examples:

``` http
GET    /api/models
GET    /api/models/:id
GET    /api/models/:id/areas

GET    /api/pos?modelId=1

POST   /api/rqc/headers
GET    /api/rqc/headers/:id

POST   /api/rqc/headers/:id/areas
POST   /api/rqc/areas/:id/processes
POST   /api/rqc/processes/:id/inspections

PATCH  /api/rqc/inspections/:id
```

Use consistent JSON response structures.

------------------------------------------------------------------------

# 8. Security

## Passwords

Never store:

``` text
password
```

Store:

``` text
password_hash
```

Use Argon2id or bcrypt with a current secure configuration.

## Authentication

Prefer:

-   HTTP-only secure cookies for browser sessions, or
-   short-lived access tokens with refresh-token rotation.

Never store sensitive authentication tokens in insecure browser storage
unnecessarily.

## Authorization

At minimum:

``` text
ADMIN
RQC
```

Backend must enforce role authorization.

------------------------------------------------------------------------

# 9. File Handling

Defect photos and action photos should not be stored as binary blobs in
PostgreSQL initially.

Store files in:

``` text
MinIO / S3-compatible object storage
```

Database stores metadata/path:

``` text
photo_defect
photo_after_action_plan
```

Recommended future table:

``` text
file_asset
- file_id
- object_key
- original_name
- mime_type
- size
- uploaded_by
- created_at
```

------------------------------------------------------------------------

# 10. CTQ Configuration Rule

Never hard-code:

``` ts
if (model === "HYPERPATH") {
   ...
}
```

Never hard-code:

``` ts
const defects = ["PEEL OFF", "DIRTY"];
```

All CTQ navigation comes from:

``` text
setup_model
setup_area
setup_process
setup_defect
```

------------------------------------------------------------------------

# 11. PO Matching

A naive substring search such as:

``` text
CONTAINS(model, selectedModel)
```

may be used only as a temporary discovery mechanism.

For production authority, prefer normalized model mapping.

Recommended future table:

``` text
model_po_mapping
- mapping_id
- setup_model_id
- po_model_pattern
- normalized_model
- is_active
```

This prevents:

``` text
HYPERPATH
```

from accidentally matching an unrelated model with the same substring.

------------------------------------------------------------------------

# 12. Quality Calculation

Backend-only calculation:

``` text
defectRate = qtyDefect / qtyChecking
passRate = 1 - defectRate
```

Store normalized decimal values.

Example:

``` text
qtyChecking = 20
qtyDefect = 5
defectRate = 0.25
passRate = 0.75
```

Frontend formats:

``` text
25%
75%
```

Do not store `"25%"` as text.

------------------------------------------------------------------------

# 13. Status Enumeration

Recommended enum:

``` text
IMMEDIATE_ACTION
CAP
CLOSED
CANCELLED
```

Initial automatic determination:

``` text
rate > configured threshold → CAP
else                        → IMMEDIATE_ACTION
```

Do not let the browser choose the authoritative status.

------------------------------------------------------------------------

# 14. Audit Lifecycle

Recommended future lifecycle:

``` text
DRAFT
  ↓
IN_PROGRESS
  ↓
SUBMITTED
  ↓
ACTION_REQUIRED
  ↓
CLOSED
```

The initial release may simplify this if workflow approval is not yet
required.

------------------------------------------------------------------------

# 15. API Idempotency

For create operations that may be retried by the browser/network,
consider an idempotency key.

Especially:

``` text
POST /rqc/headers
POST /rqc/processes/:id/inspections
```

This prevents duplicate inspection records from repeated mobile/browser
requests.

------------------------------------------------------------------------

# 16. Observability

Minimum:

-   structured application logs
-   request ID / correlation ID
-   error logging
-   database migration logging
-   health endpoint

Endpoints:

``` http
GET /health
GET /health/db
```

------------------------------------------------------------------------

# 17. Environment Variables

Example:

``` env
NODE_ENV=development

DATABASE_URL=postgresql://...

JWT_SECRET=...

S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=ctqaudit

REDIS_URL=redis://redis:6379
```

Secrets must never be committed.

------------------------------------------------------------------------

# 18. Docker Development

Recommended services:

``` text
postgres
minio
redis
api
web
```

Use Docker Compose for local infrastructure.

Production should use separate configuration and secrets.

------------------------------------------------------------------------

# 19. Testing Standard

## Unit

Test:

-   calculation service
-   PO/model matching
-   CTQ validation
-   authorization
-   status determination

## Integration

Test:

``` text
DB migration
→ create model setup
→ create PO
→ create header
→ create area
→ create process
→ create inspection
```

## E2E

Test actual user flow:

``` text
Login
→ Model Card
→ Header
→ PO
→ Area
→ Process
→ Defect
→ Qty
→ Submit
```

------------------------------------------------------------------------

# 20. AI Coding Agent Rules

The AI Coding Agent must follow these rules.

### Rule 1 --- Read architecture first

Before implementing a feature, read:

``` text
docs/PRD.md
docs/TDD.md
docs/TECH.md
```

### Rule 2 --- Never invent schema

Do not create new tables/columns merely to simplify frontend
implementation.

First evaluate existing relationships.

### Rule 3 --- Backend is authoritative

Never rely on frontend validation for:

-   PO/model compatibility
-   CTQ configuration
-   status
-   defect rate
-   permissions

### Rule 4 --- Preserve normalization

Do not add duplicate text columns when an FK already represents the
entity.

Bad:

``` text
defect_id
defect
```

Good:

``` text
defect_id
```

### Rule 5 --- No hard-coded CTQ

CTQ comes from setup tables.

### Rule 6 --- Migrations are mandatory

Any schema change must have a migration.

Never manually edit production tables without migration.

### Rule 7 --- Test before completion

A coding task is incomplete until relevant tests pass.

### Rule 8 --- Do not silently change business rules

If a requested implementation conflicts with PRD/TDD, report the
conflict and propose the smallest architectural change.

### Rule 9 --- Preserve historical data

Never cascade-delete completed RQC audit history because a setup record
was changed.

### Rule 10 --- Prefer small changes

Implement one vertical slice at a time:

``` text
DB
→ repository
→ service
→ API
→ frontend
→ test
```

------------------------------------------------------------------------

# 21. AI Agent Implementation Order

The recommended implementation sequence is:

## Phase 1 --- Foundation

``` text
Docker
PostgreSQL
NestJS
Next.js
ORM
migrations
health checks
```

## Phase 2 --- Master

``` text
master_area
master_process
master_defect
master_factory
master_user
master_po
```

## Phase 3 --- CTQ Setup

``` text
setup_model
setup_area
setup_process
setup_defect
```

## Phase 4 --- RQC Header

``` text
Model Card
→ Header
→ PO validation
```

## Phase 5 --- Navigation

``` text
Header
→ Area
→ Process
```

## Phase 6 --- Inspection

``` text
Process
→ Defect Qty
→ calculations
→ status
```

## Phase 7 --- Action

``` text
Immediate Action
CAP
Evidence
```

## Phase 8 --- Analytics

Only after transaction integrity is stable.

------------------------------------------------------------------------

# 22. Architecture Decision Summary

The system uses:

``` text
MASTER
    ↓
SETUP / CTQ CONFIGURATION
    ↓
RQC HEADER
    ↓
RQC AREA
    ↓
RQC PROCESS
    ↓
RQC INSPECTION
```

The web UI presents:

``` text
MODEL CARD
    ↓
HEADER FORM
    ↓
AREA BUTTONS
    ↓
PROCESS BUTTONS
    ↓
DEFECT QUANTITY INPUT
    ↓
QUALITY RESULT
    ↓
IMMEDIATE ACTION / CAP
```

The database remains independent from the presentation style.

------------------------------------------------------------------------

# 23. Final Engineering Principle

The CTQ Audit application must be:

**configuration-driven, relational, transaction-safe, API-authoritative,
historically auditable, and extensible.**

The frontend is responsible for user experience.

The backend is responsible for business rules.

PostgreSQL is responsible for data integrity.

The CTQ setup tables are responsible for defining what may be inspected.
