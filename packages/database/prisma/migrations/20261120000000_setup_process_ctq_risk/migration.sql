-- CTQ category and risk level move from master_process (one value for every model) to
-- setup_process (set per model on the Configure page). master_process.ctq / risk_level stay
-- in place but are no longer written or read.
--
-- Safe to run more than once: the columns are only added when missing, and the copy below only
-- fills setup processes that have neither value yet.

ALTER TABLE "setup_process" ADD COLUMN IF NOT EXISTS "ctq" TEXT;
ALTER TABLE "setup_process" ADD COLUMN IF NOT EXISTS "risk_level" VARCHAR(30);

-- Carry the old global values over to each setup process of that master process, mapped to the
-- options the Configure page offers. A CTQ that is not one of its categories is left empty.
UPDATE "setup_process" AS sp
SET "ctq" = CASE lower(trim(mp."ctq"))
        WHEN 'external compliance' THEN 'External Compliance'
        WHEN 'safety' THEN 'Safety'
        WHEN 'function' THEN 'Function'
        WHEN 'durability' THEN 'Durability'
        WHEN 'appearance' THEN 'Appearance'
        WHEN 'color' THEN 'Color'
        WHEN 'fit & comfort' THEN 'Fit & Comfort'
    END,
    "risk_level" = CASE upper(trim(mp."risk_level"))
        WHEN 'LOW' THEN 'Low'
        WHEN 'MEDIUM' THEN 'Medium'
        WHEN 'HIGH' THEN 'Critical'
        WHEN 'CRITICAL' THEN 'Critical'
    END
FROM "master_process" AS mp
WHERE mp."process_id" = sp."process_id"
  AND sp."ctq" IS NULL
  AND sp."risk_level" IS NULL;
