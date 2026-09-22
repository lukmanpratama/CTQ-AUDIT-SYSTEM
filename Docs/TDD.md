# TDD --- CTQ Audit RQC Web Application

**Document Status:** Technical Design Baseline\
**Architecture Role:** Lead Architect Specification\
**Primary Stack:** Next.js + NestJS + PostgreSQL\
**ORM:** Prisma or Drizzle, subject to repository standardization

------------------------------------------------------------------------

# 1. Architecture Principles

1.  PostgreSQL is the transactional source of truth.
2.  Frontend never owns business-rule authority.
3.  Backend validates every relationship.
4.  Setup/configuration is separated from transaction data.
5.  Transactions use stable IDs.
6.  Historical records are immutable or controlled after completion.
7.  API contracts are explicit.
8.  Database constraints protect integrity even if the API is bypassed.
9.  CTQ navigation is data-driven.
10. No model-specific database tables.

------------------------------------------------------------------------

# 2. Logical Architecture

``` text
                    WEB CLIENT
                 Next.js Frontend
                       |
                       | HTTPS / REST
                       v
                  NestJS Backend
                       |
            +----------+----------+
            |                     |
            v                     v
      PostgreSQL DB          Object Storage
                             (photos/evidence)
```

------------------------------------------------------------------------

# 3. Domain Modules

Backend modules:

``` text
auth
users
models
po
ctq-setup
rqc
rqc-header
rqc-area
rqc-process
rqc-inspection
cap
files
```

Suggested ownership:

``` text
ctq-setup
  setup_model
  setup_area
  setup_process
  setup_defect

rqc
  rqc_header
  rqc_area
  rqc_process
  rqc_inspection
```

------------------------------------------------------------------------

# 4. Database Schema

## 4.1 master_area

``` sql
master_area (
    area_id        bigint primary key,
    area           varchar(100) not null unique
);
```

------------------------------------------------------------------------

## 4.2 master_process

``` sql
master_process (
    process_id      bigint primary key,
    process         varchar(150) not null unique,
    ctq             text,
    risk_level      varchar(30),
    selling_point   text
);
```

------------------------------------------------------------------------

## 4.3 master_defect

``` sql
master_defect (
    defect_id       bigint primary key,
    defect          varchar(200) not null unique
);
```

------------------------------------------------------------------------

## 4.4 setup_model

``` sql
setup_model (
    setup_model_id  bigint primary key,
    model_name      varchar(150) not null unique,
    picture         text,
    is_active       boolean not null default true
);
```

------------------------------------------------------------------------

## 4.5 setup_area

``` sql
setup_area (
    setup_area_id   bigint primary key,
    setup_model_id  bigint not null references setup_model(setup_model_id),
    area_id         bigint not null references master_area(area_id),
    unique (setup_model_id, area_id)
);
```

------------------------------------------------------------------------

## 4.6 setup_process

``` sql
setup_process (
    setup_process_id bigint primary key,
    setup_area_id    bigint not null references setup_area(setup_area_id),
    process_id       bigint not null references master_process(process_id),
    unique (setup_area_id, process_id)
);
```

------------------------------------------------------------------------

## 4.7 setup_defect

``` sql
setup_defect (
    setup_defect_id  bigint primary key,
    setup_process_id bigint not null references setup_process(setup_process_id),
    defect_id        bigint not null references master_defect(defect_id),
    unique (setup_process_id, defect_id)
);
```

------------------------------------------------------------------------

## 4.8 master_factory

``` sql
master_factory (
    factory_id  bigint primary key,
    factory     varchar(150) not null unique
);
```

------------------------------------------------------------------------

## 4.9 master_user

Passwords must never be stored as plaintext.

Recommended:

``` sql
master_user (
    nik          varchar(30) primary key,
    nama_user    varchar(150) not null,
    password_hash text not null,
    is_active    boolean not null default true
);
```

------------------------------------------------------------------------

## 4.10 master_po

The PO table should be treated as imported production master/context
data.

``` sql
master_po (
    po          varchar(50) primary key,
    article     varchar(100) not null,
    model       varchar(150) not null,
    qty_order   integer not null check (qty_order >= 0)
);
```

If one PO can contain multiple article/model lines, redesign this into:

``` text
master_po
master_po_item
```

rather than forcing multiple values into one row.

------------------------------------------------------------------------

# 5. RQC Transaction Schema

## 5.1 rqc_header

``` sql
rqc_header (
    rqc_header_id   uuid primary key,
    date            date not null,
    checking_time   varchar(20) not null,
    setup_model_id  bigint not null references setup_model(setup_model_id),
    po              varchar(50) not null references master_po(po),
    article         varchar(100) not null,
    model           varchar(150) not null,
    qty_order       integer not null check (qty_order >= 0),
    factory_id      bigint not null references master_factory(factory_id),
    nik             varchar(30) not null references master_user(nik),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
```

### Why snapshot article/model/qty_order?

Because `master_po` can change after the audit.

The audit must preserve what was inspected at that time.

------------------------------------------------------------------------

# 6. rqc_area

``` sql
rqc_area (
    rqc_area_id     uuid primary key,
    rqc_header_id   uuid not null references rqc_header(rqc_header_id),
    setup_area_id   bigint not null references setup_area(setup_area_id),
    unique (rqc_header_id, setup_area_id)
);
```

The UI may render this as Area buttons.

------------------------------------------------------------------------

# 7. rqc_process

``` sql
rqc_process (
    rqc_process_id   uuid primary key,
    rqc_area_id      uuid not null references rqc_area(rqc_area_id),
    setup_process_id bigint not null references setup_process(setup_process_id),
    qty_checking     integer not null check (qty_checking > 0),
    unique (rqc_area_id, setup_process_id)
);
```

The UI may render this as Process buttons.

------------------------------------------------------------------------

# 8. rqc_inspection

``` sql
rqc_inspection (
    rqc_inspection_id       uuid primary key,
    rqc_process_id          uuid not null references rqc_process(rqc_process_id),
    defect_id               bigint not null references master_defect(defect_id),
    qty_defect              integer not null check (qty_defect >= 0),
    defect_rate             numeric(8,5) not null,
    pass_rate               numeric(8,5) not null,
    status                  varchar(30) not null,
    photo_defect            text,
    action_plan             text,
    photo_after_action_plan text,
    durasi_stopline         integer,
    root_cause              text,
    corrective              text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now(),
    unique (rqc_process_id, defect_id)
);
```

`qty_checking` is inherited through:

``` text
rqc_inspection
    → rqc_process
        → qty_checking
```

Do not duplicate it in `rqc_inspection` unless reporting/performance
requirements prove duplication necessary.

------------------------------------------------------------------------

# 9. Relationship Diagram

``` text
setup_model
    |
    | 1:N
    v
setup_area
    |
    | 1:N
    v
setup_process
    |
    | 1:N
    v
setup_defect
    |
    +---- master_defect


rqc_header
    |
    | 1:N
    v
rqc_area
    |
    | 1:N
    v
rqc_process
    |
    | 1:N
    v
rqc_inspection
    |
    +---- master_defect


rqc_header
    +---- setup_model
    +---- master_po
    +---- master_factory
    +---- master_user

rqc_area
    +---- setup_area

rqc_process
    +---- setup_process
```

------------------------------------------------------------------------

# 10. API Design

## Model

``` http
GET /api/models
GET /api/models/:id
```

## PO

``` http
GET /api/pos?modelId=:modelId
```

The backend owns model-to-PO validation.

## CTQ

``` http
GET /api/models/:modelId/areas
GET /api/setup-areas/:setupAreaId/processes
GET /api/setup-processes/:setupProcessId/defects
```

## RQC

``` http
POST /api/rqc/headers
GET  /api/rqc/headers/:id
POST /api/rqc/headers/:id/areas
POST /api/rqc/areas/:id/processes
POST /api/rqc/processes/:id/inspections
PATCH /api/rqc/inspections/:id
```

------------------------------------------------------------------------

# 11. Create Header Contract

Request:

``` json
{
  "date": "2026-08-27",
  "checkingTime": "MORNING",
  "setupModelId": 1,
  "po": "PO001",
  "factoryId": 1
}
```

Backend must:

1.  Validate model.
2.  Validate PO.
3.  Validate PO/model compatibility.
4.  Read PO context.
5.  Snapshot article/model/qty_order.
6.  Validate factory.
7.  Validate authenticated inspector.
8.  Create header in a transaction.

------------------------------------------------------------------------

# 12. Create Area

Request:

``` json
{
  "setupAreaId": 10
}
```

Backend verifies:

``` text
setupArea.setup_model_id == rqc_header.setup_model_id
```

Otherwise return:

``` http
400 Bad Request
```

------------------------------------------------------------------------

# 13. Create Process

Request:

``` json
{
  "setupProcessId": 100,
  "qtyChecking": 20
}
```

Backend verifies:

``` text
setupProcess.setup_area_id == rqc_area.setup_area_id
```

------------------------------------------------------------------------

# 14. Create Inspection

Request:

``` json
{
  "defectId": 500,
  "qtyDefect": 5
}
```

Backend resolves:

``` text
rqc_process
    ↓
setup_process
    ↓
setup_defect
    ↓
defect_id
```

If the defect is not configured for the selected process, reject the
request.

------------------------------------------------------------------------

# 15. Calculation Service

Do not trust frontend-calculated metrics.

Backend:

``` ts
defectRate = qtyDefect / qtyChecking;
passRate = Math.max(0, 1 - defectRate);
status = defectRate > threshold
  ? "CAP"
  : "IMMEDIATE_ACTION";
```

Use decimal-safe arithmetic.

Avoid JavaScript floating-point arithmetic for persisted
financial/quality ratios where precision matters; normalize the result
before persistence.

------------------------------------------------------------------------

# 16. CAP / Immediate Action

Initial implementation may keep action data on `rqc_inspection`.

If workflow complexity grows, migrate to:

``` text
rqc_action
rqc_cap
```

Do not create these tables prematurely.

------------------------------------------------------------------------

# 17. Transaction Boundary

Creating an audit header and its initial context must be atomic.

For example:

``` text
BEGIN

create rqc_header
validate model/PO
create required audit context

COMMIT
```

For Area/Process/Inspection creation, each command should be atomic.

------------------------------------------------------------------------

# 18. Database Constraints

Mandatory constraints:

-   PK on every entity.
-   FK for every relationship.
-   Unique model names.
-   Unique setup combinations.
-   Unique inspection `(rqc_process_id, defect_id)`.
-   Non-negative quantities.
-   Positive `qty_checking`.
-   Valid status enum/check.
-   NOT NULL for mandatory business fields.

------------------------------------------------------------------------

# 19. Indexing

Recommended indexes:

``` sql
CREATE INDEX idx_setup_area_model
ON setup_area(setup_model_id);

CREATE INDEX idx_setup_process_area
ON setup_process(setup_area_id);

CREATE INDEX idx_setup_defect_process
ON setup_defect(setup_process_id);

CREATE INDEX idx_rqc_header_date
ON rqc_header(date);

CREATE INDEX idx_rqc_header_model
ON rqc_header(setup_model_id);

CREATE INDEX idx_rqc_header_po
ON rqc_header(po);

CREATE INDEX idx_rqc_area_header
ON rqc_area(rqc_header_id);

CREATE INDEX idx_rqc_process_area
ON rqc_process(rqc_area_id);

CREATE INDEX idx_rqc_inspection_process
ON rqc_inspection(rqc_process_id);

CREATE INDEX idx_rqc_inspection_status
ON rqc_inspection(status);
```

------------------------------------------------------------------------

# 20. Frontend State Model

Frontend state:

``` text
selectedModel
    ↓
rqcHeader
    ↓
selectedArea
    ↓
selectedProcess
    ↓
inspectionForm
```

The frontend should request each navigation level from the API rather
than embedding CTQ setup.

------------------------------------------------------------------------

# 21. Error Handling

Standard API errors:

``` text
400 VALIDATION_ERROR
401 UNAUTHORIZED
403 FORBIDDEN
404 NOT_FOUND
409 CONFLICT
422 BUSINESS_RULE_VIOLATION
500 INTERNAL_ERROR
```

Example:

``` json
{
  "code": "CTQ_DEFECT_NOT_CONFIGURED",
  "message": "Defect is not configured for this process."
}
```

------------------------------------------------------------------------

# 22. Testing Strategy

### Unit Tests

-   PO/model validation.
-   CTQ hierarchy validation.
-   defect-rate calculation.
-   status calculation.
-   authorization.

### Integration Tests

-   create header.
-   add area.
-   add process.
-   add inspection.
-   reject invalid CTQ combinations.
-   reject invalid PO/model combination.

### E2E

``` text
Model Card
→ Header
→ PO
→ Area
→ Process
→ Defect Qty
→ Status
→ Action
```

------------------------------------------------------------------------

# 23. Migration Strategy

Existing tables can be migrated in this order:

``` text
master tables
    ↓
setup tables
    ↓
rqc_header
    ↓
rqc_area
    ↓
rqc_process
    ↓
rqc_inspection
```

Do not migrate historical RQC data directly into the final table without
mapping old relationships.

------------------------------------------------------------------------

# 24. Definition of Done

Feature is complete only when:

-   Database migrations pass.
-   FK/unique constraints pass.
-   API validation passes.
-   Frontend cannot bypass CTQ configuration.
-   Backend rejects invalid relationships.
-   Metrics are calculated server-side.
-   RQC transaction can be traced end-to-end.
-   Automated tests pass.
-   No plaintext passwords exist.
-   No duplicate defect columns exist.
-   No hard-coded model-specific CTQ logic exists.
