-- CreateTable
CREATE TABLE "master_area" (
    "area_id" BIGSERIAL NOT NULL,
    "area" VARCHAR(100) NOT NULL,

    CONSTRAINT "master_area_pkey" PRIMARY KEY ("area_id")
);

-- CreateTable
CREATE TABLE "master_process" (
    "process_id" BIGSERIAL NOT NULL,
    "process" VARCHAR(150) NOT NULL,
    "ctq" TEXT,
    "risk_level" VARCHAR(30),
    "selling_point" TEXT,

    CONSTRAINT "master_process_pkey" PRIMARY KEY ("process_id")
);

-- CreateTable
CREATE TABLE "master_defect" (
    "defect_id" BIGSERIAL NOT NULL,
    "defect" VARCHAR(200) NOT NULL,

    CONSTRAINT "master_defect_pkey" PRIMARY KEY ("defect_id")
);

-- CreateTable
CREATE TABLE "master_factory" (
    "factory_id" BIGSERIAL NOT NULL,
    "factory" VARCHAR(150) NOT NULL,

    CONSTRAINT "master_factory_pkey" PRIMARY KEY ("factory_id")
);

-- CreateTable
CREATE TABLE "master_user" (
    "nik" VARCHAR(30) NOT NULL,
    "nama_user" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'RQC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_user_pkey" PRIMARY KEY ("nik")
);

-- CreateTable
CREATE TABLE "master_po" (
    "po" VARCHAR(50) NOT NULL,
    "article" VARCHAR(100) NOT NULL,
    "model" VARCHAR(150) NOT NULL,
    "qty_order" INTEGER NOT NULL,

    CONSTRAINT "master_po_pkey" PRIMARY KEY ("po")
);

-- CreateTable
CREATE TABLE "setup_model" (
    "setup_model_id" BIGSERIAL NOT NULL,
    "model_name" VARCHAR(150) NOT NULL,
    "picture" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "setup_model_pkey" PRIMARY KEY ("setup_model_id")
);

-- CreateTable
CREATE TABLE "model_po_mapping" (
    "mapping_id" BIGSERIAL NOT NULL,
    "setup_model_id" BIGINT NOT NULL,
    "po_model_pattern" VARCHAR(200) NOT NULL,
    "normalized_model" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "model_po_mapping_pkey" PRIMARY KEY ("mapping_id")
);

-- CreateTable
CREATE TABLE "setup_area" (
    "setup_area_id" BIGSERIAL NOT NULL,
    "setup_model_id" BIGINT NOT NULL,
    "area_id" BIGINT NOT NULL,

    CONSTRAINT "setup_area_pkey" PRIMARY KEY ("setup_area_id")
);

-- CreateTable
CREATE TABLE "setup_process" (
    "setup_process_id" BIGSERIAL NOT NULL,
    "setup_area_id" BIGINT NOT NULL,
    "process_id" BIGINT NOT NULL,

    CONSTRAINT "setup_process_pkey" PRIMARY KEY ("setup_process_id")
);

-- CreateTable
CREATE TABLE "setup_defect" (
    "setup_defect_id" BIGSERIAL NOT NULL,
    "setup_process_id" BIGINT NOT NULL,
    "defect_id" BIGINT NOT NULL,

    CONSTRAINT "setup_defect_pkey" PRIMARY KEY ("setup_defect_id")
);

-- CreateTable
CREATE TABLE "rqc_header" (
    "rqc_header_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "checking_time" VARCHAR(20) NOT NULL,
    "setup_model_id" BIGINT NOT NULL,
    "po" VARCHAR(50) NOT NULL,
    "article" VARCHAR(100) NOT NULL,
    "model" VARCHAR(150) NOT NULL,
    "qty_order" INTEGER NOT NULL,
    "factory_id" BIGINT NOT NULL,
    "nik" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rqc_header_pkey" PRIMARY KEY ("rqc_header_id")
);

-- CreateTable
CREATE TABLE "rqc_area" (
    "rqc_area_id" UUID NOT NULL,
    "rqc_header_id" UUID NOT NULL,
    "setup_area_id" BIGINT NOT NULL,

    CONSTRAINT "rqc_area_pkey" PRIMARY KEY ("rqc_area_id")
);

-- CreateTable
CREATE TABLE "rqc_process" (
    "rqc_process_id" UUID NOT NULL,
    "rqc_area_id" UUID NOT NULL,
    "setup_process_id" BIGINT NOT NULL,
    "qty_checking" INTEGER NOT NULL,

    CONSTRAINT "rqc_process_pkey" PRIMARY KEY ("rqc_process_id")
);

-- CreateTable
CREATE TABLE "rqc_inspection" (
    "rqc_inspection_id" UUID NOT NULL,
    "rqc_process_id" UUID NOT NULL,
    "defect_id" BIGINT NOT NULL,
    "qty_defect" INTEGER NOT NULL,
    "defect_rate" DECIMAL(8,5) NOT NULL,
    "pass_rate" DECIMAL(8,5) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "photo_defect" TEXT,
    "action_plan" TEXT,
    "photo_after_action_plan" TEXT,
    "durasi_stopline" INTEGER,
    "root_cause" TEXT,
    "corrective" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rqc_inspection_pkey" PRIMARY KEY ("rqc_inspection_id")
);

-- CreateTable
CREATE TABLE "file_asset" (
    "file_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" BIGINT NOT NULL,
    "uploaded_by" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_asset_pkey" PRIMARY KEY ("file_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_area_area_key" ON "master_area"("area");

-- CreateIndex
CREATE UNIQUE INDEX "master_process_process_key" ON "master_process"("process");

-- CreateIndex
CREATE UNIQUE INDEX "master_defect_defect_key" ON "master_defect"("defect");

-- CreateIndex
CREATE UNIQUE INDEX "master_factory_factory_key" ON "master_factory"("factory");

-- CreateIndex
CREATE UNIQUE INDEX "setup_model_model_name_key" ON "setup_model"("model_name");

-- CreateIndex
CREATE INDEX "idx_setup_area_model" ON "setup_area"("setup_model_id");

-- CreateIndex
CREATE UNIQUE INDEX "setup_area_setup_model_id_area_id_key" ON "setup_area"("setup_model_id", "area_id");

-- CreateIndex
CREATE INDEX "idx_setup_process_area" ON "setup_process"("setup_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "setup_process_setup_area_id_process_id_key" ON "setup_process"("setup_area_id", "process_id");

-- CreateIndex
CREATE INDEX "idx_setup_defect_process" ON "setup_defect"("setup_process_id");

-- CreateIndex
CREATE UNIQUE INDEX "setup_defect_setup_process_id_defect_id_key" ON "setup_defect"("setup_process_id", "defect_id");

-- CreateIndex
CREATE INDEX "idx_rqc_header_date" ON "rqc_header"("date");

-- CreateIndex
CREATE INDEX "idx_rqc_header_model" ON "rqc_header"("setup_model_id");

-- CreateIndex
CREATE INDEX "idx_rqc_header_po" ON "rqc_header"("po");

-- CreateIndex
CREATE INDEX "idx_rqc_area_header" ON "rqc_area"("rqc_header_id");

-- CreateIndex
CREATE UNIQUE INDEX "rqc_area_rqc_header_id_setup_area_id_key" ON "rqc_area"("rqc_header_id", "setup_area_id");

-- CreateIndex
CREATE INDEX "idx_rqc_process_area" ON "rqc_process"("rqc_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "rqc_process_rqc_area_id_setup_process_id_key" ON "rqc_process"("rqc_area_id", "setup_process_id");

-- CreateIndex
CREATE INDEX "idx_rqc_inspection_process" ON "rqc_inspection"("rqc_process_id");

-- CreateIndex
CREATE INDEX "idx_rqc_inspection_status" ON "rqc_inspection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rqc_inspection_rqc_process_id_defect_id_key" ON "rqc_inspection"("rqc_process_id", "defect_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_asset_object_key_key" ON "file_asset"("object_key");

-- AddForeignKey
ALTER TABLE "model_po_mapping" ADD CONSTRAINT "model_po_mapping_setup_model_id_fkey" FOREIGN KEY ("setup_model_id") REFERENCES "setup_model"("setup_model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_area" ADD CONSTRAINT "setup_area_setup_model_id_fkey" FOREIGN KEY ("setup_model_id") REFERENCES "setup_model"("setup_model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_area" ADD CONSTRAINT "setup_area_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "master_area"("area_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_process" ADD CONSTRAINT "setup_process_setup_area_id_fkey" FOREIGN KEY ("setup_area_id") REFERENCES "setup_area"("setup_area_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_process" ADD CONSTRAINT "setup_process_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "master_process"("process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_defect" ADD CONSTRAINT "setup_defect_setup_process_id_fkey" FOREIGN KEY ("setup_process_id") REFERENCES "setup_process"("setup_process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_defect" ADD CONSTRAINT "setup_defect_defect_id_fkey" FOREIGN KEY ("defect_id") REFERENCES "master_defect"("defect_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_header" ADD CONSTRAINT "rqc_header_setup_model_id_fkey" FOREIGN KEY ("setup_model_id") REFERENCES "setup_model"("setup_model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_header" ADD CONSTRAINT "rqc_header_po_fkey" FOREIGN KEY ("po") REFERENCES "master_po"("po") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_header" ADD CONSTRAINT "rqc_header_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "master_factory"("factory_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_header" ADD CONSTRAINT "rqc_header_nik_fkey" FOREIGN KEY ("nik") REFERENCES "master_user"("nik") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_area" ADD CONSTRAINT "rqc_area_rqc_header_id_fkey" FOREIGN KEY ("rqc_header_id") REFERENCES "rqc_header"("rqc_header_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_area" ADD CONSTRAINT "rqc_area_setup_area_id_fkey" FOREIGN KEY ("setup_area_id") REFERENCES "setup_area"("setup_area_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_process" ADD CONSTRAINT "rqc_process_rqc_area_id_fkey" FOREIGN KEY ("rqc_area_id") REFERENCES "rqc_area"("rqc_area_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_process" ADD CONSTRAINT "rqc_process_setup_process_id_fkey" FOREIGN KEY ("setup_process_id") REFERENCES "setup_process"("setup_process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_inspection" ADD CONSTRAINT "rqc_inspection_rqc_process_id_fkey" FOREIGN KEY ("rqc_process_id") REFERENCES "rqc_process"("rqc_process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rqc_inspection" ADD CONSTRAINT "rqc_inspection_defect_id_fkey" FOREIGN KEY ("defect_id") REFERENCES "master_defect"("defect_id") ON DELETE RESTRICT ON UPDATE CASCADE;
