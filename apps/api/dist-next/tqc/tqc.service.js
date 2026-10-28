"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TqcService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TqcService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const tqc_setup_defect_dto_1 = require("../tqc-setup-defect/tqc-setup-defect.dto");
const tqc_checking_1 = require("../common/tqc-checking");
let TqcService = TqcService_1 = class TqcService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(TqcService_1.name);
    }
    async onModuleInit() {
        try {
            await this.prisma.$executeRawUnsafe(`ALTER TABLE tqc_report ADD COLUMN IF NOT EXISTS usp_classification VARCHAR(100)`);
            await this.prisma.$executeRawUnsafe(`ALTER TABLE tqc_report ADD COLUMN IF NOT EXISTS qty_checking DOUBLE PRECISION`);
            await this.prisma.$executeRawUnsafe(`ALTER TABLE tqc_report ADD COLUMN IF NOT EXISTS ctq_type VARCHAR(100)`);
            this.logger.log('DB migration: usp_classification, qty_checking and ctq_type columns ensured on tqc_report');
        }
        catch (e) {
            this.logger.warn('DB migration check skipped: ' + e.message);
        }
    }
    async createMany(data, moduleType) {
        if (!Array.isArray(data)) {
            throw new common_1.BadRequestException('Request body must be a list of rows parsed from the Excel file.');
        }
        const records = data.map((row) => {
            return {
                date: new Date(row.date),
                time: String(row.time || ''),
                building: String(row.building || ''),
                cell: String(row.cell || ''),
                model: String(row.model || ''),
                article: String(row.article || ''),
                orderNo: String(row.orderNo || ''),
                seq: row.seq ? Number(row.seq) : null,
                pwiNo: String(row.pwiNo || ''),
                qty: row.qty ? Number(row.qty) : null,
                qtyDefect: row.qtyDefect ? Number(row.qtyDefect) : null,
                qtyProduction: row.qtyProduction ? Number(row.qtyProduction) : null,
                destination: String(row.destination || ''),
                category: String(row.category || ''),
                type: String(row.type || ''),
                defectName: String(row.defectName || ''),
                uspClassification: String(row.uspClassification || ''),
                moduleType: moduleType.toUpperCase(),
            };
        });
        const errors = this.validateRecords(records, data);
        if (errors.length > 0) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                error: 'Bad Request',
                message: `${errors.length} invalid row(s) in the Excel file. Nothing was imported.`,
                errors: errors.slice(0, 100),
            });
        }
        try {
            if (records.length === 0)
                return { count: 0, skipped: 0 };
            const str = (v) => (v == null ? '' : String(v).trim());
            const num = (v) => (v == null || v === '' ? '' : String(Number(v)));
            const signature = (r) => [
                str(r.date), str(r.time), str(r.building), str(r.cell), str(r.model), str(r.article),
                str(r.orderNo), num(r.seq), str(r.pwiNo), num(r.qty), num(r.qtyDefect), num(r.qtyProduction),
                str(r.destination), str(r.category), str(r.type), str(r.defectName), str(r.uspClassification),
            ].join('|');
            const existingRows = await this.prisma.$queryRawUnsafe(`SELECT to_char(date, 'YYYY-MM-DD') AS date, time, building, cell, model, article,
                        order_no AS "orderNo", seq, pwi_no AS "pwiNo", qty, qty_defect AS "qtyDefect",
                        qty_production AS "qtyProduction", destination, category, type,
                        defect_name AS "defectName", usp_classification AS "uspClassification"
                 FROM tqc_report WHERE module_type = $1`, moduleType.toUpperCase());
            const seen = new Set(existingRows.map(signature));
            const newRecords = records.filter((r) => {
                const key = signature({ ...r, date: r.date.toISOString().slice(0, 10) });
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            });
            const skipped = records.length - newRecords.length;
            if (newRecords.length === 0)
                return { count: 0, skipped };
            const BATCH_SIZE = 100;
            let totalInserted = 0;
            for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
                const batch = newRecords.slice(i, i + BATCH_SIZE);
                const values = batch.map((r) => `(
                    ${r.date instanceof Date ? `'${r.date.toISOString()}'` : `'${new Date(r.date).toISOString()}'`},
                    ${r.time ? `'${String(r.time).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.building ? `'${String(r.building).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.cell ? `'${String(r.cell).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.model ? `'${String(r.model).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.article ? `'${String(r.article).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.orderNo ? `'${String(r.orderNo).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.seq != null ? Number(r.seq) : 'NULL'},
                    ${r.pwiNo ? `'${String(r.pwiNo).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.qty != null ? Number(r.qty) : 'NULL'},
                    ${r.qtyDefect != null ? Number(r.qtyDefect) : 'NULL'},
                    ${r.qtyProduction != null ? Number(r.qtyProduction) : 'NULL'},
                    ${r.destination ? `'${String(r.destination).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.category ? `'${String(r.category).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.type ? `'${String(r.type).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.defectName ? `'${String(r.defectName).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.uspClassification != null ? `'${String(r.uspClassification).replace(/'/g, "''")}'` : 'NULL'},
                    '${String(r.moduleType).replace(/'/g, "''")}'
                )`).join(',');
                const sql = `INSERT INTO tqc_report (
                    date, time, building, cell, model, article, order_no, seq, pwi_no,
                    qty, qty_defect, qty_production, destination, category, type,
                    defect_name, usp_classification, module_type
                ) VALUES ${values}`;
                await this.prisma.$executeRawUnsafe(sql);
                totalInserted += batch.length;
            }
            return { count: totalInserted, skipped };
        }
        catch (error) {
            console.error("TQC UPLOAD DB ERROR:", error);
            throw new common_1.HttpException(`Failed to upload to DB: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    validateRecords(records, data) {
        const errors = [];
        records.forEach((r, i) => {
            const row = Number(data[i]?.rowNo) || i + 2;
            const raw = String(data[i]?.date ?? '');
            const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            const valid = m && !isNaN(r.date.getTime())
                && r.date.getUTCFullYear() === +m[1] && r.date.getUTCMonth() + 1 === +m[2] && r.date.getUTCDate() === +m[3];
            if (!valid)
                errors.push({ row, message: `Date "${raw}" is not a valid date (expected a real date, e.g. 2026-09-19).` });
            for (const [field, max] of Object.entries(TqcService_1.TEXT_LIMITS)) {
                const len = String(r[field] ?? '').length;
                if (len > max)
                    errors.push({ row, message: `${field} is ${len} characters long; the maximum is ${max}.` });
            }
            if (r.seq != null && (!Number.isInteger(r.seq) || Math.abs(r.seq) > 2147483647)) {
                errors.push({ row, message: `Seq "${data[i]?.seq}" must be a whole number below 2,147,483,647.` });
            }
            for (const field of ['qty', 'qtyDefect', 'qtyProduction']) {
                if (r[field] != null && !Number.isFinite(r[field]))
                    errors.push({ row, message: `${field} "${data[i]?.[field]}" is not a number.` });
            }
        });
        return errors;
    }
    async getByModule(moduleType) {
        const recordsRaw = await this.prisma.$queryRawUnsafe(`SELECT * FROM tqc_report WHERE module_type = $1 ORDER BY date DESC, tqc_id DESC`, moduleType.toUpperCase());
        const records = recordsRaw.map(r => {
            const getProp = (snake, camel, flat) => r[snake] !== undefined ? r[snake] : (r[camel] !== undefined ? r[camel] : r[flat]);
            return {
                tqcId: getProp('tqc_id', 'tqcId', 'tqcid'),
                date: r.date,
                time: r.time,
                building: r.building,
                cell: r.cell,
                model: r.model,
                article: r.article,
                orderNo: getProp('order_no', 'orderNo', 'orderno'),
                seq: r.seq,
                pwiNo: getProp('pwi_no', 'pwiNo', 'pwino'),
                qty: r.qty,
                qtyDefect: getProp('qty_defect', 'qtyDefect', 'qtydefect'),
                qtyProduction: getProp('qty_production', 'qtyProduction', 'qtyproduction'),
                qtyChecking: getProp('qty_checking', 'qtyChecking', 'qtychecking'),
                destination: r.destination,
                category: r.category,
                type: r.type,
                defectName: getProp('defect_name', 'defectName', 'defectname'),
                uspClassification: getProp('usp_classification', 'uspClassification', 'uspclassification'),
                ctqTypeOverride: getProp('ctq_type', 'ctqType', 'ctqtype'),
                moduleType: getProp('module_type', 'moduleType', 'moduletype'),
                createdAt: getProp('created_at', 'createdAt', 'createdat')
            };
        });
        const normalizeName = (name) => name ? name.replace(/\s+/g, ' ').trim().toLowerCase() : '';
        const mappingsList = await this.prisma.setupDefectTqc.findMany();
        const mappingDict = new Map();
        for (const m of mappingsList) {
            mappingDict.set(normalizeName(m.defectName), m.ctqType);
        }
        return records.map(r => {
            const ctqTypeSetup = r.defectName ? (mappingDict.get(normalizeName(r.defectName)) || null) : null;
            return { ...r, ctqTypeSetup, ctqType: r.ctqTypeOverride || ctqTypeSetup };
        });
    }
    async updateUspClassification(id, uspClassification) {
        const value = String(uspClassification ?? '').trim();
        const updated = await this.prisma.$executeRawUnsafe(`UPDATE tqc_report SET usp_classification = $1 WHERE tqc_id = $2`, value || null, id);
        if (!updated) {
            throw new common_1.HttpException('TQC record not found', common_1.HttpStatus.NOT_FOUND);
        }
        return { tqcId: id, uspClassification: value };
    }
    async updateRecord(id, data) {
        const existing = await this.prisma.$queryRawUnsafe(`SELECT qty_checking, qty_defect FROM tqc_report WHERE tqc_id = $1`, id);
        if (existing.length === 0)
            throw new common_1.HttpException('TQC record not found', common_1.HttpStatus.NOT_FOUND);
        const slotWhere = `t.module_type = s.module_type AND t.date = s.date
            AND COALESCE(t.building, '') = COALESCE(s.building, '') AND COALESCE(t.cell, '') = COALESCE(s.cell, '')
            AND COALESCE(t.time, '') = COALESCE(s.time, '')`;
        const sets = [];
        const params = [];
        const set = (column, value) => { params.push(value); sets.push(`${column} = $${params.length}`); };
        if (data.article !== undefined)
            set('article', data.article.trim().toUpperCase() || null);
        if (data.defectName !== undefined) {
            const name = data.defectName.replace(/\s+/g, ' ').trim();
            if (!name)
                throw new common_1.BadRequestException('Defect Name cannot be empty.');
            set('defect_name', name);
        }
        if (data.ctqType !== undefined) {
            const ctq = (data.ctqType ?? '').trim();
            if (ctq && !tqc_setup_defect_dto_1.CTQ_TYPES.includes(ctq)) {
                throw new common_1.BadRequestException(`CTQ Type must be one of: ${tqc_setup_defect_dto_1.CTQ_TYPES.join(', ')}.`);
            }
            set('ctq_type', ctq || null);
        }
        if (data.qtyDefect !== undefined)
            set('qty_defect', data.qtyDefect);
        const checking = data.qtyChecking !== undefined ? data.qtyChecking : existing[0].qty_checking;
        const effectiveChecking = checking ?? tqc_checking_1.TQC_CHECK_PER_HOUR;
        const defect = data.qtyDefect !== undefined ? data.qtyDefect : existing[0].qty_defect;
        if (defect != null && defect > effectiveChecking) {
            throw new common_1.BadRequestException(`Qty Defect (${defect}) cannot be larger than Qty Checking (${effectiveChecking}).`);
        }
        if (data.qtyChecking !== undefined) {
            const others = await this.prisma.$queryRawUnsafe(`SELECT MAX(t.qty_defect) AS max_defect FROM tqc_report t, tqc_report s
                 WHERE s.tqc_id = $1 AND t.tqc_id <> s.tqc_id AND ${slotWhere}`, id);
            const maxDefect = others[0]?.max_defect;
            if (maxDefect != null && Number(maxDefect) > effectiveChecking) {
                throw new common_1.BadRequestException(`Another defect in this hour has Qty Defect ${maxDefect}, larger than Qty Checking ${effectiveChecking}.`);
            }
        }
        let slotRows = 0;
        await this.prisma.$transaction(async (tx) => {
            if (sets.length > 0) {
                await tx.$executeRawUnsafe(`UPDATE tqc_report SET ${sets.join(', ')} WHERE tqc_id = $${params.length + 1}`, ...params, id);
            }
            if (data.qtyChecking !== undefined) {
                slotRows = await tx.$executeRawUnsafe(`UPDATE tqc_report t SET qty_checking = $1 FROM tqc_report s
                     WHERE s.tqc_id = $2 AND ${slotWhere}`, data.qtyChecking, id);
            }
        });
        return { tqcId: id, updated: sets.length + (data.qtyChecking !== undefined ? 1 : 0), slotRows };
    }
    async deleteRecord(id) {
        return this.prisma.tqcReport.delete({
            where: { tqcId: id }
        });
    }
    async deleteByModule(moduleType) {
        return this.prisma.tqcReport.deleteMany({
            where: { moduleType: moduleType.toUpperCase() }
        });
    }
};
exports.TqcService = TqcService;
TqcService.TEXT_LIMITS = {
    time: 50, building: 50, cell: 50, model: 150, article: 100, orderNo: 50, pwiNo: 50,
    destination: 100, category: 50, type: 100, defectName: 200, uspClassification: 100,
};
exports.TqcService = TqcService = TqcService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TqcService);
//# sourceMappingURL=tqc.service.js.map