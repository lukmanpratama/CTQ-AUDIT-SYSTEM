# PRD --- CTQ Audit RQC Web Application

**Document Status:** Draft / Architecture Baseline\
**Audience:** Product Owner, Lead Architect, Backend Engineer, Frontend
Engineer, QA, AI Coding Agent\
**System:** CTQ Audit --- RQC (Roving Quality Control)\
**Primary Domain:** Footwear Manufacturing Quality Audit

------------------------------------------------------------------------

## 1. Product Vision

CTQ Audit is a web application for executing model-based Critical To
Quality (CTQ) audits.

The application must allow an RQC user to:

1.  Select a shoe model from a Model Card.
2.  Start an RQC audit session.
3.  Select a valid PO belonging to the selected model.
4.  Automatically load PO/article/model/order quantity data.
5.  Navigate through configured Area as UI buttons/cards.
6.  Navigate through configured Process as UI buttons/cards.
7.  Record defect quantities for defects configured for the selected
    Process.
8.  Automatically calculate defect rate and pass rate.
9.  Automatically determine Immediate Action or CAP status.
10. Record evidence and corrective actions.
11. Preserve an auditable relational history.

The system must separate **CTQ configuration** from **audit transaction
data**.

------------------------------------------------------------------------

## 2. Goals

### Functional Goals

-   Model-driven CTQ audit workflow.
-   Reusable CTQ configuration.
-   PO-driven production context.
-   Area → Process → Defect navigation.
-   Defect-level inspection transaction.
-   Automatic quality calculations.
-   Immediate Action / CAP workflow.
-   Complete audit traceability.
-   Support future TQC/QC imported data without corrupting RQC
    transaction structure.

### Architectural Goals

-   PostgreSQL as system-of-record.
-   Normalized relational schema.
-   Stable primary/foreign keys.
-   Backend validation independent of frontend validation.
-   API-first architecture.
-   Transactional consistency.
-   Extensible for future analytics and integrations.

------------------------------------------------------------------------

## 3. Non-Goals

The initial release does not include:

-   AppSheet.
-   Spreadsheet as the transactional database.
-   Hard-coded model-specific forms.
-   Separate tables per model.
-   Columns such as `defect_1`, `defect_2`, `defect_3`.
-   Hard-coded Area/Process/Defect lists in frontend code.
-   Automatic modification of historical audit records when CTQ setup
    changes.

------------------------------------------------------------------------

## 4. Actors

### RQC

Performs CTQ audits and records inspection results.

### Admin

Maintains master data and CTQ setup.

### System

Calculates quality metrics, determines status, enforces relationships,
and preserves audit history.

------------------------------------------------------------------------

## 5. Core User Journey

``` text
MODEL CARD
    |
    v
CREATE RQC HEADER
    |
    +-- Date
    +-- Checking Time
    +-- PO
    +-- Factory
    +-- Inspector
    |
    v
AREA BUTTONS
    |
    v
PROCESS BUTTONS
    |
    v
DEFECT INPUT
    |
    +-- Qty Checking
    +-- Qty Defect
    +-- Evidence
    |
    v
CALCULATE METRICS
    |
    +-- Defect Rate
    +-- Pass Rate
    +-- Status
    |
    +-------------------+
    |                   |
    v                   v
IMMEDIATE ACTION       CAP
```

------------------------------------------------------------------------

## 6. Business Rules

### 6.1 Model Selection

The user starts from a Model Card.

The selected model becomes the model context of the RQC Header.

The frontend must not allow the user to create an audit for an arbitrary
model outside the configured model list.

------------------------------------------------------------------------

### 6.2 PO Selection

PO is selected after Model.

The backend must validate that the selected PO belongs to the selected
model according to the configured matching policy.

If operational PO data contains naming variants such as:

-   `HYPERPATH MEN`
-   `HYPERPATH WOMEN`

while the setup model is `HYPERPATH`, the system may use a controlled
normalization/mapping strategy.

Do not use uncontrolled fuzzy matching as the authoritative
relationship.

Preferred architecture:

``` text
setup_model
      |
      +-- model matching/mapping policy
      |
master_po
```

------------------------------------------------------------------------

### 6.3 Header

One `rqc_header` represents one audit session.

Minimum context:

-   date
-   checking_time
-   model
-   PO
-   article
-   qty_order
-   factory
-   inspector

Article/model/order quantity should be derived from the selected PO
where possible.

Historical transaction values should be snapshotted when the audit is
created so future master-data changes do not rewrite history.

------------------------------------------------------------------------

### 6.4 CTQ Configuration

Configuration hierarchy:

``` text
MODEL
  |
  +-- AREA
        |
        +-- PROCESS
              |
              +-- DEFECT
```

Database configuration:

``` text
setup_model
    |
setup_area
    |
setup_process
    |
setup_defect
```

Only configured Area/Process/Defect values may be audited for a model.

------------------------------------------------------------------------

### 6.5 Area and Process UI

Area and Process are navigation controls in the web UI.

They are not free-text inspection fields.

The UI must render:

``` text
[ TREATMENT ]
[ SEWING ]
[ ASSEMBLY ]
```

and then:

``` text
[ NOSEW ]
[ SPRAY COLLAR ]
[ INVERT COLLAR LINING ]
```

based on database configuration.

------------------------------------------------------------------------

### 6.6 Defect Input

Defects are configured per Process.

The inspection screen displays configured defects and allows the user to
enter defect quantity.

Example:

``` text
PEEL OFF       Qty [ 5 ]
DIRTY          Qty [ 2 ]
OVERMELTING    Qty [ 0 ]
```

The transaction is stored one row per defect.

------------------------------------------------------------------------

## 7. Quality Calculation

For each defect:

``` text
defect_rate = qty_defect / qty_checking
```

Example:

``` text
qty_checking = 20
qty_defect   = 5

defect_rate = 5 / 20 = 25%
```

Pass rate:

``` text
pass_rate = max(0, 1 - defect_rate)
```

The exact pass-rate definition must remain configurable if the business
later defines pass rate at process, audit, or pair level.

------------------------------------------------------------------------

## 8. Action Decision

Initial rule:

``` text
defect_rate > 20%
    => CAP

defect_rate <= 20%
    => IMMEDIATE_ACTION
```

The threshold must not be hard-coded in the frontend.

It belongs in backend business logic/configuration.

------------------------------------------------------------------------

## 9. Immediate Action

For Immediate Action, the user may record:

-   action_plan
-   photo_after_action_plan
-   stopline duration where applicable

------------------------------------------------------------------------

## 10. CAP

For CAP, the user may record:

-   root_cause
-   corrective
-   action_plan
-   evidence photo
-   photo_after_action_plan
-   stopline duration

CAP should remain linked to the exact inspection result that triggered
it.

------------------------------------------------------------------------

## 11. Transaction Integrity

The following relationships are mandatory:

``` text
RQC Header
    |
    +-- RQC Area
          |
          +-- RQC Process
                |
                +-- RQC Inspection
```

An inspection cannot exist without a valid process transaction.

A process transaction cannot exist without a valid area transaction.

An area transaction cannot exist without a valid header.

------------------------------------------------------------------------

## 12. Historical Integrity

When an audit is created, transaction data must preserve the operational
context at that time.

Changing:

-   model name
-   PO article
-   PO quantity
-   CTQ configuration
-   defect name

must not unexpectedly rewrite completed historical audit results.

Use IDs for relationships and snapshots for critical historical business
values.

------------------------------------------------------------------------

## 13. Acceptance Criteria

### AC-01 Model

Given an active configured model, when the user opens the audit screen,
the model is selectable as a Model Card.

### AC-02 PO

Given a selected model, only valid POs for that model can be selected.

### AC-03 Header

Saving the header creates exactly one RQC audit header.

### AC-04 Area

Only Area values configured for the selected model are displayed.

### AC-05 Process

Only Process values configured for the selected Area are displayed.

### AC-06 Defect

Only defects configured for the selected Process are displayed.

### AC-07 Calculation

The backend calculates defect rate from quantity values.

### AC-08 Status

The backend determines Immediate Action or CAP from the configured
threshold.

### AC-09 Integrity

Invalid model/area/process/defect combinations are rejected by the
backend.

### AC-10 Auditability

Every inspection can be traced back to:

``` text
Inspection
→ Process
→ Area
→ Header
→ Model
→ PO
→ Inspector
```

------------------------------------------------------------------------

## 14. Future Extensions

-   TQC imported inspection data.
-   Unified RQC/TQC analytics.
-   ANSI/AQL rules.
-   CAP approval workflow.
-   Corrective action verification.
-   Attachments/object storage.
-   Dashboard and trend analysis.
-   Role-based authorization.
-   Audit locking after closure.
