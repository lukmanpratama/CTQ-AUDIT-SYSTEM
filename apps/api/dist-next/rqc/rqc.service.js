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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RqcService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const cap_thresholds_1 = require("../common/cap-thresholds");
const model_match_1 = require("../common/model-match");
const model_match_2 = require("../common/model-match");
const tqc_checking_1 = require("../common/tqc-checking");
const hasUspClassification = (tqc) => !!tqc.uspClassification?.trim();
let RqcService = class RqcService {
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    async createHeader(dto) {
        const poData = await this.prisma.masterPo.findUnique({
            where: { po: dto.po }
        });
        if (!poData) {
            throw new common_1.NotFoundException(`PO ${dto.po} not found in master data.`);
        }
        if (dto.rqcHeaderId) {
            const existing = await this.findSameClientHeader(dto);
            if (existing)
                return existing;
        }
        const inspector = await this.prisma.masterUser.findUnique({ where: { nik: dto.nik }, select: { nik: true } });
        if (!inspector) {
            throw new common_1.BadRequestException(`Inspector NIK ${dto.nik} tidak terdaftar di Master User.`);
        }
        const resolvedFactoryId = await this.resolveFactoryId(dto.factoryId);
        try {
            const header = await this.prisma.rqcHeader.create({
                data: {
                    ...(dto.rqcHeaderId ? { rqcHeaderId: dto.rqcHeaderId } : {}),
                    date: new Date(dto.date),
                    checkingTime: dto.checkingTime,
                    setupModelId: BigInt(dto.setupModelId),
                    po: dto.po,
                    article: poData.article,
                    model: poData.model,
                    qtyOrder: poData.qtyOrder,
                    factoryId: resolvedFactoryId,
                    nik: dto.nik,
                    cell: dto.cell,
                }
            });
            return this.serializeBigInt(header);
        }
        catch (e) {
            if (dto.rqcHeaderId && e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                const existing = await this.findSameClientHeader(dto);
                if (existing)
                    return existing;
            }
            throw e;
        }
    }
    async findSameClientHeader(dto) {
        const existing = await this.prisma.rqcHeader.findUnique({ where: { rqcHeaderId: dto.rqcHeaderId } });
        if (!existing)
            return null;
        const same = String(existing.setupModelId) === String(dto.setupModelId) &&
            existing.po === dto.po &&
            existing.nik === dto.nik &&
            existing.checkingTime === dto.checkingTime &&
            existing.date.toISOString().slice(0, 10) === String(dto.date).slice(0, 10);
        if (!same) {
            throw new common_1.ConflictException(`Inspeksi dengan id ${dto.rqcHeaderId} sudah ada dengan data berbeda.`);
        }
        return this.serializeBigInt(existing);
    }
    async updateHeader(headerId, dto) {
        const existing = await this.prisma.rqcHeader.findUnique({
            where: { rqcHeaderId: headerId },
            select: { po: true }
        });
        if (!existing) {
            throw new common_1.NotFoundException(`RqcHeader ${headerId} not found`);
        }
        const data = {
            date: new Date(dto.date),
            checkingTime: dto.checkingTime,
            factoryId: await this.resolveFactoryId(dto.factoryId),
            cell: dto.cell,
        };
        if (dto.po !== existing.po) {
            const poData = await this.prisma.masterPo.findUnique({ where: { po: dto.po } });
            if (!poData) {
                throw new common_1.NotFoundException(`PO ${dto.po} not found in master data.`);
            }
            Object.assign(data, {
                po: dto.po,
                article: poData.article,
                model: poData.model,
                qtyOrder: poData.qtyOrder,
            });
        }
        const [header] = await this.prisma.$transaction([
            this.prisma.rqcHeader.update({ where: { rqcHeaderId: headerId }, data }),
            this.prisma.rqcInspection.updateMany({
                where: { rqcProcess: { rqcArea: { rqcHeaderId: headerId } } },
                data: { date: data.date }
            }),
        ]);
        return this.serializeBigInt(header);
    }
    async resolveFactoryId(factoryId) {
        let resolvedFactoryId;
        if (factoryId === 'INHOUSE') {
            let inhouseFactory = await this.prisma.masterFactory.findUnique({
                where: { factory: 'INHOUSE' }
            });
            if (!inhouseFactory) {
                inhouseFactory = await this.prisma.masterFactory.create({
                    data: { factory: 'INHOUSE' }
                });
            }
            resolvedFactoryId = inhouseFactory.factoryId;
        }
        else if (factoryId === 'BOTTOM' || factoryId === 'BOTTOM 1' || factoryId === 'BOTTOM 2') {
            const factoryName = factoryId;
            let bottomFactory = await this.prisma.masterFactory.findUnique({
                where: { factory: factoryName }
            });
            if (!bottomFactory) {
                bottomFactory = await this.prisma.masterFactory.create({
                    data: { factory: factoryName }
                });
            }
            resolvedFactoryId = bottomFactory.factoryId;
        }
        else {
            resolvedFactoryId = BigInt(factoryId);
        }
        return resolvedFactoryId;
    }
    async submitProcessInspection(headerId, setupAreaId, setupProcessId, dto) {
        const areaIdBigInt = BigInt(setupAreaId);
        const processIdBigInt = BigInt(setupProcessId);
        const header = await this.prisma.rqcHeader.findUnique({
            where: { rqcHeaderId: headerId },
            select: { date: true }
        });
        const headerDate = header?.date || new Date();
        let area = await this.prisma.rqcArea.findUnique({
            where: {
                rqcHeaderId_setupAreaId: {
                    rqcHeaderId: headerId,
                    setupAreaId: areaIdBigInt
                }
            }
        });
        if (!area) {
            area = await this.prisma.rqcArea.create({
                data: {
                    rqcHeaderId: headerId,
                    setupAreaId: areaIdBigInt
                }
            });
        }
        const processTx = await this.prisma.rqcProcess.upsert({
            where: {
                rqcAreaId_setupProcessId: {
                    rqcAreaId: area.rqcAreaId,
                    setupProcessId: processIdBigInt
                }
            },
            create: {
                rqcAreaId: area.rqcAreaId,
                setupProcessId: processIdBigInt,
                qtyChecking: dto.qtyChecking
            },
            update: {
                qtyChecking: dto.qtyChecking
            }
        });
        for (const d of dto.defects) {
            const defectRate = dto.qtyChecking > 0 ? (d.qtyDefect / dto.qtyChecking) : 0;
            const passRate = Math.max(0, 1 - defectRate);
            const status = defectRate > cap_thresholds_1.CAP_DAILY_THRESHOLD ? 'CAP' : 'IMMEDIATE_ACTION';
            await this.prisma.rqcInspection.upsert({
                where: {
                    rqcProcessId_defectId: {
                        rqcProcessId: processTx.rqcProcessId,
                        defectId: BigInt(d.defectId)
                    }
                },
                create: {
                    rqcProcessId: processTx.rqcProcessId,
                    defectId: BigInt(d.defectId),
                    date: headerDate,
                    qtyDefect: d.qtyDefect,
                    defectRate,
                    passRate,
                    status,
                    actionPlan: d.actionPlan,
                    rootCause: d.rootCause,
                    corrective: d.corrective,
                    durasiStopline: d.durasiStopline,
                    photoDefect: d.photoDefect,
                    photoAfterActionPlan: d.photoAfterActionPlan
                },
                update: {
                    date: headerDate,
                    qtyDefect: d.qtyDefect,
                    defectRate,
                    passRate,
                    status,
                    actionPlan: d.actionPlan !== undefined ? d.actionPlan : undefined,
                    rootCause: d.rootCause !== undefined ? d.rootCause : undefined,
                    corrective: d.corrective !== undefined ? d.corrective : undefined,
                    durasiStopline: d.durasiStopline !== undefined ? d.durasiStopline : undefined,
                    photoDefect: d.photoDefect !== undefined ? d.photoDefect : undefined,
                    photoAfterActionPlan: d.photoAfterActionPlan !== undefined ? d.photoAfterActionPlan : undefined
                }
            });
        }
        try {
            await this.notifications.notifyDailyCap(processTx.rqcProcessId);
        }
        catch (e) {
            console.error('Daily CAP notification failed', e);
        }
        return this.serializeBigInt({
            message: 'Inspection submitted successfully',
            rqcProcessId: processTx.rqcProcessId,
            processedDefects: dto.defects.length
        });
    }
    async deleteProcessInspection(headerId, setupAreaId, setupProcessId) {
        const areaIdBigInt = BigInt(setupAreaId);
        const processIdBigInt = BigInt(setupProcessId);
        const area = await this.prisma.rqcArea.findUnique({
            where: {
                rqcHeaderId_setupAreaId: {
                    rqcHeaderId: headerId,
                    setupAreaId: areaIdBigInt
                }
            }
        });
        if (!area)
            return { message: 'Area not found' };
        const processes = await this.prisma.rqcProcess.findMany({
            where: {
                rqcAreaId: area.rqcAreaId,
                setupProcessId: processIdBigInt
            }
        });
        for (const p of processes) {
            await this.prisma.rqcInspection.deleteMany({
                where: { rqcProcessId: p.rqcProcessId }
            });
            await this.prisma.rqcProcess.delete({
                where: { rqcProcessId: p.rqcProcessId }
            });
        }
        return { message: 'Process reset successfully' };
    }
    async deleteHeader(headerId) {
        return this.prisma.$transaction(async (tx) => {
            const areas = await tx.rqcArea.findMany({
                where: { rqcHeaderId: headerId },
                select: { rqcAreaId: true }
            });
            const areaIds = areas.map(a => a.rqcAreaId);
            if (areaIds.length > 0) {
                const processes = await tx.rqcProcess.findMany({
                    where: { rqcAreaId: { in: areaIds } },
                    select: { rqcProcessId: true }
                });
                const processIds = processes.map(p => p.rqcProcessId);
                if (processIds.length > 0) {
                    await tx.rqcInspection.deleteMany({
                        where: { rqcProcessId: { in: processIds } }
                    });
                }
                await tx.rqcProcess.deleteMany({
                    where: { rqcAreaId: { in: areaIds } }
                });
                await tx.rqcArea.deleteMany({
                    where: { rqcHeaderId: headerId }
                });
            }
            await tx.rqcHeader.delete({
                where: { rqcHeaderId: headerId }
            });
            return { success: true };
        });
    }
    async getHeaderSession(headerId) {
        const header = await this.prisma.rqcHeader.findUnique({
            where: { rqcHeaderId: headerId },
            include: {
                factory: true,
                rqcAreas: {
                    include: {
                        rqcProcesses: {
                            include: {
                                rqcInspections: {
                                    include: { masterDefect: true }
                                },
                                setupProcess: {
                                    include: {
                                        masterProcess: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!header) {
            throw new common_1.NotFoundException(`RqcHeader ${headerId} not found`);
        }
        return this.serializeBigInt(header);
    }
    async getAllHeaders(filters) {
        const headers = await this.prisma.rqcHeader.findMany({
            where: this.buildHeaderWhere(filters),
            orderBy: { createdAt: 'desc' },
            include: {
                setupModel: { select: { setupModelId: true, modelName: true, modelNo: true } },
                factory: true,
                inspector: {
                    select: {
                        namaUser: true
                    }
                },
                rqcAreas: {
                    include: {
                        rqcProcesses: {
                            include: {
                                rqcInspections: true
                            }
                        }
                    }
                }
            }
        });
        return this.serializeBigInt(headers);
    }
    async getHeadersByModel(filters) {
        const where = this.buildHeaderWhere(filters);
        const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
        const onlyModelId = filters.groupModelId ? BigInt(filters.groupModelId) : undefined;
        const counts = await this.prisma.rqcHeader.groupBy({
            by: ['setupModelId'],
            where: onlyModelId !== undefined ? { AND: [where, { setupModelId: onlyModelId }] } : where,
            _count: { _all: true },
        });
        const models = await this.prisma.setupModel.findMany({
            where: { setupModelId: { in: counts.map(c => c.setupModelId) } },
            select: { setupModelId: true, modelName: true, modelNo: true },
        });
        const modelById = new Map(models.map(m => [m.setupModelId, m]));
        const groups = await Promise.all(counts.map(async (c) => {
            const total = c._count._all;
            const totalPages = Math.max(Math.ceil(total / pageSize), 1);
            const page = onlyModelId !== undefined ? Math.min(Math.max(Number(filters.page) || 1, 1), totalPages) : 1;
            const rows = await this.prisma.rqcHeader.findMany({
                where: { AND: [where, { setupModelId: c.setupModelId }] },
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    rqcHeaderId: true, date: true, checkingTime: true, po: true, model: true, cell: true, nik: true,
                    factory: { select: { factory: true } },
                    inspector: { select: { namaUser: true } },
                },
            });
            const model = modelById.get(c.setupModelId);
            return {
                setupModelId: c.setupModelId,
                label: model ? (0, model_match_2.modelLabel)(model) : rows[0]?.model || '-',
                total, page, totalPages, rows,
            };
        }));
        const ids = groups.flatMap(g => g.rows.map(r => r.rqcHeaderId));
        const totals = ids.length === 0 ? [] : await this.prisma.$queryRaw `
            SELECT a.rqc_header_id::text AS id,
                   COALESCE(SUM(p.qty_checking), 0)::int AS checks,
                   COALESCE(SUM((SELECT SUM(i.qty_defect) FROM rqc_inspection i WHERE i.rqc_process_id = p.rqc_process_id)), 0)::int AS defects,
                   COALESCE(SUM((SELECT COUNT(*) FROM rqc_inspection i WHERE i.rqc_process_id = p.rqc_process_id AND i.status = 'CAP')), 0)::int AS caps
            FROM rqc_area a
            JOIN rqc_process p ON p.rqc_area_id = a.rqc_area_id
            WHERE a.rqc_header_id = ANY(${ids}::uuid[])
            GROUP BY a.rqc_header_id`;
        const totalsById = new Map(totals.map(t => [t.id, t]));
        groups.sort((a, b) => a.label.localeCompare(b.label));
        return this.serializeBigInt({
            pageSize,
            groups: groups.map(g => ({
                ...g,
                rows: g.rows.map(r => {
                    const t = totalsById.get(r.rqcHeaderId);
                    return { ...r, checks: t?.checks ?? 0, defects: t?.defects ?? 0, capCount: t?.caps ?? 0 };
                }),
            })),
        });
    }
    async getHeaderCells(modelId) {
        return this.prisma.rqcHeader.findMany({
            where: { ...(modelId ? { setupModelId: BigInt(modelId) } : {}), cell: { not: null } },
            distinct: ['cell'],
            select: { cell: true },
            orderBy: { cell: 'asc' },
        });
    }
    buildHeaderWhere(filters) {
        const whereClause = {};
        if (filters.model) {
            whereClause.model = { contains: filters.model, mode: 'insensitive' };
        }
        if (filters.modelId) {
            whereClause.setupModelId = BigInt(filters.modelId);
        }
        if (filters.checkingTime) {
            whereClause.checkingTime = filters.checkingTime;
        }
        if (filters.factoryId) {
            whereClause.factoryId = BigInt(filters.factoryId);
        }
        if (filters.cell) {
            whereClause.cell = filters.cell;
        }
        if (filters.inspector) {
            whereClause.inspector = {
                namaUser: { contains: filters.inspector, mode: 'insensitive' }
            };
        }
        if (filters.startDate || filters.endDate) {
            whereClause.date = {};
            if (filters.startDate) {
                whereClause.date.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
            }
            if (filters.endDate) {
                whereClause.date.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
            }
        }
        return whereClause;
    }
    async getDashboardFilterOptions() {
        const models = await this.prisma.setupModel.findMany({
            where: { rqcHeaders: { some: {} } },
            select: { setupModelId: true, modelName: true, modelNo: true },
            orderBy: { modelName: 'asc' }
        });
        const areas = await this.prisma.masterArea.findMany({
            where: { setupAreas: { some: { rqcAreas: { some: {} } } } },
            select: { areaId: true, area: true },
            orderBy: { area: 'asc' }
        });
        const checkingTimeObjects = await this.prisma.rqcHeader.findMany({
            distinct: ['checkingTime'],
            select: { checkingTime: true },
            orderBy: { checkingTime: 'asc' }
        });
        const checkingTimes = checkingTimeObjects.map(h => h.checkingTime).filter(Boolean);
        const factories = await this.prisma.masterFactory.findMany({
            orderBy: { factory: 'asc' }
        });
        const cellObjects = await this.prisma.rqcHeader.findMany({
            distinct: ['cell'],
            select: { cell: true },
            orderBy: { cell: 'asc' }
        });
        const cells = cellObjects.map(h => h.cell).filter(Boolean);
        return this.serializeBigInt({ models, areas, checkingTimes, factories, cells });
    }
    async getDashboardKpis(filters) {
        let inspectionWhere = {};
        let headerConditions = {};
        let applyingHeaderConditions = false;
        if (filters?.modelId) {
            headerConditions.setupModelId = BigInt(filters.modelId);
            applyingHeaderConditions = true;
        }
        if (filters?.checkingTime) {
            headerConditions.checkingTime = filters.checkingTime;
            applyingHeaderConditions = true;
        }
        if (filters?.factoryId) {
            headerConditions.factoryId = BigInt(filters.factoryId);
            applyingHeaderConditions = true;
        }
        if (filters?.cell) {
            headerConditions.cell = filters.cell;
            applyingHeaderConditions = true;
        }
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
            applyingHeaderConditions = true;
        }
        else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
            applyingHeaderConditions = true;
        }
        else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
            applyingHeaderConditions = true;
        }
        let processConditions = {};
        let applyingProcessConditions = false;
        if (applyingHeaderConditions) {
            processConditions.rqcArea = { rqcHeader: headerConditions };
            applyingProcessConditions = true;
        }
        if (filters?.areaId) {
            if (['NOSEW', 'PRINTING', 'EMBOSS', 'EMBROIDERY'].includes(filters.areaId)) {
                if (!processConditions.rqcArea)
                    processConditions.rqcArea = {};
                if (!processConditions.rqcArea.rqcHeader)
                    processConditions.rqcArea.rqcHeader = {};
                processConditions.rqcArea.rqcHeader = { ...processConditions.rqcArea.rqcHeader, cell: { startsWith: filters.areaId } };
                applyingProcessConditions = true;
            }
            else {
                if (!processConditions.rqcArea)
                    processConditions.rqcArea = {};
                processConditions.rqcArea.setupArea = { areaId: BigInt(filters.areaId) };
                applyingProcessConditions = true;
            }
        }
        if (applyingProcessConditions) {
            inspectionWhere.rqcProcess = processConditions;
        }
        const totalInspection = await this.prisma.rqcHeader.count({ where: headerConditions });
        const processAgg = await this.prisma.rqcProcess.aggregate({
            where: processConditions,
            _sum: { qtyChecking: true }
        });
        const totalQtyChecking = processAgg._sum.qtyChecking || 0;
        const agg = await this.prisma.rqcInspection.aggregate({
            where: inspectionWhere,
            _sum: {
                qtyDefect: true,
                defectRate: true,
                passRate: true
            },
            _avg: {
                defectRate: true,
                passRate: true
            }
        });
        const totalQtyDefect = agg._sum.qtyDefect || 0;
        let tqcQtyChecking = 0;
        let tqcQtyDefect = 0;
        if (filters?.modelId) {
            const masterModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: model_match_1.MODEL_MATCH_SELECT
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions = {
                    ...(0, model_match_2.tqcWhereForModel)(masterModel),
                    moduleType: 'ASSEMBLY'
                };
                if (filters?.startDate && filters?.endDate) {
                    tqcConditions.date = {
                        gte: new Date(filters.startDate),
                        lte: new Date(filters.endDate)
                    };
                }
                else if (filters?.startDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate) };
                }
                else if (filters?.endDate) {
                    tqcConditions.date = { lte: new Date(filters.endDate) };
                }
                const tqcRecords = await this.prisma.tqcReport.findMany({
                    where: tqcConditions,
                    select: { date: true, time: true, cell: true, building: true, qty: true, qtyDefect: true, qtyChecking: true }
                });
                const uniqueCheckingMap = (0, tqc_checking_1.tqcSlotChecking)(tqcRecords, tqc => {
                    const timeKey = tqc.time || 'no-time';
                    const cellKey = tqc.cell || tqc.building || 'no-cell';
                    const dateKey = tqc.date ? tqc.date.getTime().toString() : 'no-date';
                    return `${dateKey}_${cellKey}_${timeKey}`;
                });
                for (const tqc of tqcRecords) {
                    tqcQtyDefect += (tqc.qtyDefect || 0);
                }
                for (const qty of uniqueCheckingMap.values()) {
                    tqcQtyChecking += qty;
                }
            }
        }
        const tqcDefectRate = tqcQtyChecking > 0 ? (tqcQtyDefect / tqcQtyChecking) * 100 : 0;
        const rqcDefectRate = totalQtyChecking > 0 ? (totalQtyDefect / totalQtyChecking) * 100 : 0;
        const avgDefectRate = (tqcDefectRate + rqcDefectRate) / 2;
        const avgPassRate = ((100 - tqcDefectRate) + (100 - rqcDefectRate)) / 2;
        const totalProcessCount = await this.prisma.rqcProcess.count({
            where: processConditions
        });
        const processesWithDefectCount = await this.prisma.rqcProcess.count({
            where: {
                ...processConditions,
                rqcInspections: { some: { qtyDefect: { gt: 0 } } }
            }
        });
        const passCount = totalProcessCount - processesWithDefectCount;
        const immediateActionCount = await this.prisma.rqcInspection.count({
            where: {
                ...inspectionWhere,
                qtyDefect: { gt: 0 },
                status: 'IMMEDIATE_ACTION'
            }
        });
        const capCount = await this.prisma.rqcInspection.count({
            where: {
                ...inspectionWhere,
                qtyDefect: { gt: 0 },
                status: 'CAP'
            }
        });
        const openFindings = immediateActionCount + capCount;
        const immediateActionUnfilled = await this.prisma.rqcInspection.count({
            where: {
                ...inspectionWhere,
                qtyDefect: { gt: 0 },
                status: 'IMMEDIATE_ACTION',
                OR: [
                    { actionPlan: null },
                    { actionPlan: '' }
                ]
            }
        });
        const capUnfilled = await this.prisma.rqcInspection.count({
            where: {
                ...inspectionWhere,
                qtyDefect: { gt: 0 },
                status: 'CAP',
                OR: [
                    { rootCause: null },
                    { rootCause: '' }
                ]
            }
        });
        const allProcesses = await this.prisma.rqcProcess.findMany({
            where: processConditions,
            include: {
                setupProcess: {
                    include: { masterProcess: true }
                },
                rqcInspections: {
                    select: { qtyDefect: true }
                }
            }
        });
        const ctqMap = new Map();
        for (const rp of allProcesses) {
            let ctq = rp.setupProcess?.masterProcess?.ctq;
            if (!ctq || ctq.trim() === '') {
                ctq = 'OTHER';
            }
            if (!ctqMap.has(ctq)) {
                ctqMap.set(ctq, { total: 0, defects: 0 });
            }
            const stats = ctqMap.get(ctq);
            stats.total += 1;
            const hasDefect = rp.rqcInspections.some(i => i.qtyDefect > 0);
            if (hasDefect) {
                stats.defects += 1;
            }
        }
        const ctqKpis = Array.from(ctqMap.entries()).map(([ctq, stats]) => {
            const passRate = stats.total > 0 ? ((stats.total - stats.defects) / stats.total) * 100 : 0;
            return {
                label: ctq.toUpperCase(),
                passRate
            };
        });
        return {
            totalInspection,
            totalQtyChecking,
            totalQtyDefect,
            avgDefectRate,
            avgPassRate,
            openFindings,
            passCount,
            immediateActionCount,
            capCount,
            immediateActionUnfilled,
            capUnfilled,
            totalFindingsProcess: processesWithDefectCount,
            ctqKpis
        };
    }
    async getRecentInspections(filters) {
        let inspectionWhere = {};
        let headerConditions = {};
        let applyingHeaderConditions = false;
        if (filters?.modelId) {
            headerConditions.setupModelId = BigInt(filters.modelId);
            applyingHeaderConditions = true;
        }
        if (filters?.checkingTime) {
            headerConditions.checkingTime = filters.checkingTime;
            applyingHeaderConditions = true;
        }
        if (filters?.factoryId) {
            headerConditions.factoryId = BigInt(filters.factoryId);
            applyingHeaderConditions = true;
        }
        if (filters?.cell) {
            headerConditions.cell = filters.cell;
            applyingHeaderConditions = true;
        }
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
            applyingHeaderConditions = true;
        }
        else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
            applyingHeaderConditions = true;
        }
        else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
            applyingHeaderConditions = true;
        }
        let processConditions = {};
        let applyingProcessConditions = false;
        if (applyingHeaderConditions) {
            processConditions.rqcArea = { rqcHeader: headerConditions };
            applyingProcessConditions = true;
        }
        if (filters?.areaId) {
            if (['NOSEW', 'PRINTING', 'EMBOSS', 'EMBROIDERY'].includes(filters.areaId)) {
                if (!processConditions.rqcArea)
                    processConditions.rqcArea = {};
                if (!processConditions.rqcArea.rqcHeader)
                    processConditions.rqcArea.rqcHeader = {};
                processConditions.rqcArea.rqcHeader = { ...processConditions.rqcArea.rqcHeader, cell: { startsWith: filters.areaId } };
                applyingProcessConditions = true;
            }
            else {
                if (!processConditions.rqcArea)
                    processConditions.rqcArea = {};
                processConditions.rqcArea.setupArea = { areaId: BigInt(filters.areaId) };
                applyingProcessConditions = true;
            }
        }
        if (applyingProcessConditions) {
            inspectionWhere.rqcProcess = processConditions;
        }
        const inspections = await this.prisma.rqcInspection.findMany({
            where: {
                ...inspectionWhere,
                qtyDefect: { gt: 0 }
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                masterDefect: true,
                rqcProcess: {
                    include: {
                        setupProcess: { include: { masterProcess: true } },
                        rqcArea: {
                            include: {
                                setupArea: { include: { masterArea: true } },
                                rqcHeader: {
                                    include: {
                                        setupModel: { select: { modelName: true, modelNo: true } },
                                        factory: true,
                                        inspector: { select: { namaUser: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        const mapped = inspections.map(i => {
            const header = i.rqcProcess.rqcArea.rqcHeader;
            const processName = i.rqcProcess.setupProcess.masterProcess.process;
            const isInhousePart = header.factory?.factory?.toUpperCase() === 'INHOUSE';
            const fallbackArea = isInhousePart && header.cell ? header.cell.split(' ')[0] : '-';
            const areaName = i.rqcProcess.rqcArea.setupArea?.masterArea?.area || fallbackArea;
            const defectName = i.masterDefect?.defect || '-';
            const qtyChecking = i.rqcProcess.qtyChecking || 0;
            const qtyDefect = i.qtyDefect || 0;
            const defectRate = qtyChecking > 0 ? ((qtyDefect / qtyChecking) * 100) : 0;
            const displayStatus = i.status === 'CAP' ? 'CAP' : 'Immediate Action';
            const isCompleted = i.status === 'CAP'
                ? !!(i.rootCause && i.rootCause.trim() !== '')
                : !!(i.actionPlan && i.actionPlan.trim() !== '');
            return {
                id: i.rqcInspectionId,
                headerId: header.rqcHeaderId,
                date: header.date,
                namaRqc: header.inspector?.namaUser || '-',
                factoryCell: `${header.factory?.factory || '-'} / ${header.cell || '-'}`,
                model: (0, model_match_2.modelLabel)(header.setupModel),
                area: areaName,
                process: processName,
                defectName: defectName,
                qtyChecking,
                qtyDefect,
                defectRate: defectRate.toFixed(1),
                status: displayStatus,
                submitted: isCompleted ? 'COMPLETED' : 'NOT COMPLETED',
                statusColor: i.status === 'IMMEDIATE_ACTION' ? 'bg-red-100 text-red-800 border-red-200' :
                    i.status === 'CAP' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        'bg-gray-100 text-gray-800 border-gray-200',
                photoDefect: i.photoDefect || null,
                photoAfterActionPlan: i.photoAfterActionPlan || null,
                actionPlan: i.actionPlan || null,
                rootCause: i.rootCause || null,
                corrective: i.corrective || null,
                durasiStopline: i.durasiStopline || null
            };
        });
        return this.serializeBigInt(mapped);
    }
    async getTrends(filters) {
        let headerConditions = {};
        let applyingHeaderConditions = false;
        if (filters?.modelId) {
            headerConditions.setupModelId = BigInt(filters.modelId);
            applyingHeaderConditions = true;
        }
        if (filters?.factoryId) {
            headerConditions.factoryId = BigInt(filters.factoryId);
            applyingHeaderConditions = true;
        }
        if (filters?.cell) {
            headerConditions.cell = filters.cell;
            applyingHeaderConditions = true;
        }
        if (filters?.checkingTime && filters.checkingTime !== 'ALL' && filters.checkingTime !== 'CHECKING TIME') {
            headerConditions.checkingTime = filters.checkingTime;
            applyingHeaderConditions = true;
        }
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
            applyingHeaderConditions = true;
        }
        else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
            applyingHeaderConditions = true;
        }
        else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
            applyingHeaderConditions = true;
        }
        let processConditions = {};
        if (applyingHeaderConditions) {
            processConditions.rqcArea = { rqcHeader: headerConditions };
        }
        if (filters?.areaId) {
            if (['NOSEW', 'PRINTING', 'EMBOSS', 'EMBROIDERY'].includes(filters.areaId)) {
                if (!processConditions.rqcArea)
                    processConditions.rqcArea = {};
                if (!processConditions.rqcArea.rqcHeader)
                    processConditions.rqcArea.rqcHeader = {};
                processConditions.rqcArea.rqcHeader = { ...processConditions.rqcArea.rqcHeader, cell: { startsWith: filters.areaId } };
            }
            else {
                if (!processConditions.rqcArea)
                    processConditions.rqcArea = {};
                processConditions.rqcArea.setupArea = { areaId: BigInt(filters.areaId) };
            }
        }
        if (filters?.areaName) {
            if (!processConditions.rqcArea)
                processConditions.rqcArea = {};
            processConditions.rqcArea.setupArea = { masterArea: { area: filters.areaName } };
        }
        if (filters?.processName) {
            processConditions.setupProcess = { masterProcess: { process: filters.processName } };
        }
        const processes = await this.prisma.rqcProcess.findMany({
            where: processConditions,
            include: {
                rqcArea: { include: { rqcHeader: true } },
                rqcInspections: { select: { qtyDefect: true } }
            }
        });
        const dailyMap = new Map();
        const weeklyMap = new Map();
        const getWeekStr = (d) => {
            const shortMonth = d.toLocaleString('en-US', { month: 'short' });
            const year = d.getFullYear();
            const day = d.getDate();
            const w = Math.ceil(day / 7);
            return `${shortMonth} ${year} W ${w > 4 ? 4 : w}`;
        };
        if (filters?.modelId) {
            const masterModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: model_match_1.MODEL_MATCH_SELECT
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions = {
                    ...(0, model_match_2.tqcWhereForModel)(masterModel),
                    moduleType: 'ASSEMBLY'
                };
                if (filters?.startDate && filters?.endDate) {
                    tqcConditions.date = {
                        gte: new Date(filters.startDate),
                        lte: new Date(filters.endDate)
                    };
                }
                else if (filters?.startDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate) };
                }
                else if (filters?.endDate) {
                    tqcConditions.date = { lte: new Date(filters.endDate) };
                }
                if (filters?.cell) {
                    tqcConditions.cell = filters.cell;
                }
                const tqcRecords = await this.prisma.tqcReport.findMany({
                    where: tqcConditions
                });
                const uniqueCheckingMap = new Map();
                const dayCellChecking = (0, tqc_checking_1.tqcDayCellChecking)(tqcRecords.filter(t => t.date), tqc => `${tqc.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}_${tqc.cell || tqc.building || 'no-cell'}`);
                for (const tqc of tqcRecords) {
                    const dateObj = tqc.date;
                    if (!dateObj)
                        continue;
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const weekStr = getWeekStr(dateObj);
                    if (!dailyMap.has(dateStr))
                        dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0, rqcDefectRateSum: 0, rqcProcessCount: 0, tqcProcessMap: new Map() });
                    if (!weeklyMap.has(weekStr))
                        weeklyMap.set(weekStr, { checking: 0, defect: 0 });
                    const dStats = dailyMap.get(dateStr);
                    const wStats = weeklyMap.get(weekStr);
                    const isUspDefect = hasUspClassification(tqc);
                    if (isUspDefect) {
                        dStats.defect += (tqc.qtyDefect || 0);
                        wStats.defect += (tqc.qtyDefect || 0);
                    }
                    const cellKey = tqc.cell || tqc.building || 'no-cell';
                    const uniqueDayCellKey = `${dateStr}_${cellKey}`;
                    if (!uniqueCheckingMap.has(uniqueDayCellKey)) {
                        const qtyDiff = dayCellChecking.get(uniqueDayCellKey) ?? tqc_checking_1.TQC_CHECK_PER_DAY;
                        uniqueCheckingMap.set(uniqueDayCellKey, qtyDiff);
                        dStats.checking += qtyDiff;
                        wStats.checking += qtyDiff;
                    }
                    if (!isUspDefect)
                        continue;
                    const defectName = tqc.defectName || 'UNKNOWN';
                    if (!dStats.tqcProcessMap.has(defectName)) {
                        dStats.tqcProcessMap.set(defectName, { defect: 0, checking: 0 });
                    }
                    dStats.tqcProcessMap.get(defectName).defect += (tqc.qtyDefect || 0);
                    dStats.tqcProcessMap.get(defectName).checking = uniqueCheckingMap.get(uniqueDayCellKey) ?? tqc_checking_1.TQC_CHECK_PER_DAY;
                }
            }
        }
        for (const p of processes) {
            const dateObj = p.rqcArea.rqcHeader.date;
            if (!dateObj)
                continue;
            const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const weekStr = getWeekStr(dateObj);
            if (!dailyMap.has(dateStr))
                dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0, rqcDefectRateSum: 0, rqcProcessCount: 0, tqcProcessMap: new Map() });
            if (!weeklyMap.has(weekStr))
                weeklyMap.set(weekStr, { checking: 0, defect: 0 });
            const dStats = dailyMap.get(dateStr);
            const wStats = weeklyMap.get(weekStr);
            const chk = p.qtyChecking || 0;
            const def = p.rqcInspections.reduce((sum, i) => sum + (i.qtyDefect || 0), 0);
            dStats.rqcChecking += chk;
            dStats.rqcDefect += def;
            const processDefectRate = chk > 0 ? (def / chk) * 100 : 0;
            dStats.rqcDefectRateSum += parseFloat(processDefectRate.toFixed(2));
            dStats.rqcProcessCount += 1;
            wStats.checking += chk;
            wStats.defect += def;
        }
        const dailyTrend = Array.from(dailyMap.entries()).map(([date, stats]) => {
            let tqcDefectRateSum = 0;
            let tqcProcessCount = 0;
            for (const proc of stats.tqcProcessMap.values()) {
                const rawRate = stats.checking > 0 ? (proc.defect / stats.checking) * 100 : 0;
                tqcDefectRateSum += parseFloat(rawRate.toFixed(2));
                tqcProcessCount++;
            }
            const tqcDefectRate = tqcProcessCount > 0 ? (tqcDefectRateSum / tqcProcessCount) : 0;
            const rqcDefectRate = stats.rqcProcessCount > 0 ? (stats.rqcDefectRateSum / stats.rqcProcessCount) : 0;
            const passRate = ((100 - tqcDefectRate) + (100 - rqcDefectRate)) / 2;
            const avgDefectRate = (tqcDefectRate + rqcDefectRate) / 2;
            return {
                date,
                passRate: Number(passRate.toFixed(2)),
                avgDefectRate: Number(avgDefectRate.toFixed(2)),
                defectRate: Number(tqcDefectRate.toFixed(2)),
                defectRateRqc: Number(rqcDefectRate.toFixed(2)),
                rawRqcChecking: stats.rqcChecking,
                rawRqcDefect: stats.rqcDefect
            };
        });
        const weeklyAggregator = new Map();
        dailyTrend.forEach(day => {
            const parsedDate = new Date(day.date);
            if (isNaN(parsedDate.getTime()))
                return;
            const weekStr = getWeekStr(parsedDate);
            if (!weeklyAggregator.has(weekStr)) {
                weeklyAggregator.set(weekStr, { sum: 0, count: 0 });
            }
            weeklyAggregator.get(weekStr).sum += day.avgDefectRate;
            weeklyAggregator.get(weekStr).count += 1;
        });
        const weeklyTrend = Array.from(weeklyAggregator.entries()).map(([week, stats]) => {
            const defectRate = stats.count > 0 ? (stats.sum / stats.count) : 0;
            return {
                week,
                defectRate: Number(defectRate.toFixed(2))
            };
        });
        dailyTrend.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return this.serializeBigInt({
            dailyTrend,
            weeklyTrend
        });
    }
    async getProcessDefects(filters) {
        let headerConditions = {};
        if (filters?.modelId) {
            headerConditions.setupModelId = BigInt(filters.modelId);
        }
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
        }
        else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        }
        else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
        }
        if (filters?.factoryId) {
            headerConditions.factoryId = BigInt(filters.factoryId);
        }
        if (filters?.cell) {
            headerConditions.cell = filters.cell;
        }
        if (filters?.checkingTime && filters.checkingTime !== 'ALL' && filters.checkingTime !== 'CHECKING TIME') {
            headerConditions.checkingTime = filters.checkingTime;
        }
        const rqcProcesses = await this.prisma.rqcProcess.findMany({
            where: {
                rqcArea: {
                    rqcHeader: headerConditions
                }
            },
            include: {
                setupProcess: {
                    include: {
                        masterProcess: true,
                        masterUsp: true,
                        setupArea: {
                            include: { masterArea: true }
                        }
                    }
                },
                rqcInspections: {
                    include: { masterDefect: true }
                },
                rqcArea: {
                    include: {
                        rqcHeader: {
                            select: { checkingTime: true }
                        }
                    }
                }
            }
        });
        const areaMap = new Map();
        for (const rp of rqcProcesses) {
            const areaName = rp.setupProcess?.setupArea?.masterArea?.area || 'UNKNOWN';
            const processName = rp.setupProcess?.masterProcess?.process || 'UNKNOWN';
            const setupProcessId = rp.setupProcessId.toString();
            const checkingTime = rp.rqcArea?.rqcHeader?.checkingTime || '';
            let isMorning = true;
            const upperTime = checkingTime.toUpperCase();
            if (upperTime.includes('AFTERNOON') || upperTime.includes('SORE')) {
                isMorning = false;
            }
            else if (upperTime.includes('MORNING') || upperTime.includes('PAGI')) {
                isMorning = true;
            }
            else {
                const match = checkingTime.match(/(\d{1,2}):\d{2}/);
                if (match) {
                    const hour = parseInt(match[1], 10);
                    if (hour >= 13) {
                        isMorning = false;
                    }
                }
            }
            const qtyChecking = rp.qtyChecking || 0;
            if (!areaMap.has(areaName)) {
                areaMap.set(areaName, { areaName, processMap: new Map() });
            }
            const areaEntry = areaMap.get(areaName);
            if (!areaEntry.processMap.has(processName)) {
                areaEntry.processMap.set(processName, {
                    processName,
                    setupProcessId,
                    totalDefect: 0,
                    totalChecking: 0,
                    defectMap: new Map(),
                    qtyCheckingMorning: 0,
                    qtyCheckingAfternoon: 0,
                    qtyDefectMorning: 0,
                    qtyDefectAfternoon: 0,
                    ctq: rp.setupProcess?.masterProcess?.ctq || null,
                    usp: rp.setupProcess?.masterUsp?.uspName || null,
                });
            }
            const procEntry = areaEntry.processMap.get(processName);
            procEntry.totalChecking += qtyChecking;
            if (isMorning) {
                procEntry.qtyCheckingMorning += qtyChecking;
            }
            else {
                procEntry.qtyCheckingAfternoon += qtyChecking;
            }
            for (const insp of rp.rqcInspections) {
                const defectName = insp.masterDefect?.defect || 'UNKNOWN';
                const qtyDefect = insp.qtyDefect || 0;
                procEntry.totalDefect += qtyDefect;
                if (isMorning) {
                    procEntry.qtyDefectMorning += qtyDefect;
                }
                else {
                    procEntry.qtyDefectAfternoon += qtyDefect;
                }
                if (!procEntry.defectMap.has(defectName)) {
                    procEntry.defectMap.set(defectName, { defectName, qtyDefect: 0 });
                }
                procEntry.defectMap.get(defectName).qtyDefect += qtyDefect;
            }
        }
        const areas = Array.from(areaMap.values()).map(area => ({
            areaName: area.areaName,
            processes: Array.from(area.processMap.values()).map(proc => ({
                processName: proc.processName,
                setupProcessId: proc.setupProcessId,
                defectRate: proc.totalChecking > 0 ? (proc.totalDefect / proc.totalChecking) * 100 : 0,
                totalDefect: proc.totalDefect,
                totalChecking: proc.totalChecking,
                defects: Array.from(proc.defectMap.values())
                    .filter(d => d.qtyDefect > 0)
                    .sort((a, b) => b.qtyDefect - a.qtyDefect),
                qtyCheckingMorning: proc.qtyCheckingMorning,
                qtyCheckingAfternoon: proc.qtyCheckingAfternoon,
                qtyDefectMorning: proc.qtyDefectMorning,
                qtyDefectAfternoon: proc.qtyDefectAfternoon,
                ctq: proc.ctq,
                usp: proc.usp,
            })).sort((a, b) => b.defectRate - a.defectRate)
        }));
        let tqcRecords = [];
        const tqcAreas = [];
        if (filters?.modelId) {
            const masterModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: model_match_1.MODEL_MATCH_SELECT
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions = {
                    ...(0, model_match_2.tqcWhereForModel)(masterModel),
                    moduleType: 'ASSEMBLY'
                };
                if (filters?.startDate && filters?.endDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
                }
                else if (filters?.startDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate) };
                }
                else if (filters?.endDate) {
                    tqcConditions.date = { lte: new Date(filters.endDate) };
                }
                if (filters?.cell) {
                    tqcConditions.cell = filters.cell;
                }
                tqcRecords = await this.prisma.tqcReport.findMany({
                    where: tqcConditions,
                    select: { date: true, time: true, cell: true, building: true, qty: true, qtyDefect: true, qtyChecking: true, defectName: true, moduleType: true, ctqType: true, uspClassification: true }
                });
                const normDefect = (n) => (n || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const ctqByDefect = new Map((await this.prisma.setupDefectTqc.findMany()).map(m => [normDefect(m.defectName), m.ctqType]));
                const tqcMap = new Map();
                for (const tqc of tqcRecords) {
                    if (!hasUspClassification(tqc))
                        continue;
                    const moduleName = tqc.moduleType || 'UNKNOWN TQC';
                    const defectName = tqc.defectName || 'UNKNOWN DEFECT';
                    if (!tqcMap.has(moduleName)) {
                        tqcMap.set(moduleName, { areaName: moduleName, processMap: new Map() });
                    }
                    const modEntry = tqcMap.get(moduleName);
                    const timeKey = tqc.time || 'no-time';
                    const cellKey = tqc.cell || tqc.building || 'no-cell';
                    const dateKey = tqc.date ? tqc.date.getTime().toString() : 'no-date';
                    const seqKey = tqc.seq || '';
                    const uniqueKey = `${dateKey}_${cellKey}_${timeKey}_${seqKey}`;
                    if (!modEntry.processMap.has(defectName)) {
                        modEntry.processMap.set(defectName, {
                            processName: defectName,
                            setupProcessId: `tqc-${defectName}`,
                            totalDefect: 0,
                            totalChecking: 0,
                            defectMap: new Map(),
                            uniqueCheckingMap: new Map(),
                            uspSet: new Set(),
                            ctqSet: new Set()
                        });
                    }
                    const procEntry = modEntry.processMap.get(defectName);
                    if (tqc.uspClassification?.trim())
                        procEntry.uspSet.add(tqc.uspClassification.trim());
                    const rowCtq = tqc.ctqType?.trim() || ctqByDefect.get(normDefect(defectName));
                    if (rowCtq)
                        procEntry.ctqSet.add(rowCtq);
                    if (!procEntry.uniqueCheckingMap.has(uniqueKey)) {
                        procEntry.uniqueCheckingMap.set(uniqueKey, tqc.qtyChecking ?? tqc_checking_1.TQC_CHECK_PER_HOUR);
                    }
                    const qtyD = tqc.qtyDefect || 0;
                    procEntry.totalDefect += qtyD;
                    if (!procEntry.defectMap.has(defectName)) {
                        procEntry.defectMap.set(defectName, { defectName, qtyDefect: 0 });
                    }
                    procEntry.defectMap.get(defectName).qtyDefect += qtyD;
                }
                const globalTqcUniqueChecks = (0, tqc_checking_1.tqcDayCellChecking)(tqcRecords || [], tqc => `${tqc.date ? tqc.date.toISOString().split('T')[0] : 'no-date'}_${tqc.cell || tqc.building || 'no-cell'}`);
                let globalTqcTotalChecking = 0;
                for (const qty of globalTqcUniqueChecks.values())
                    globalTqcTotalChecking += qty;
                for (const modEntry of tqcMap.values()) {
                    tqcAreas.push({
                        areaName: modEntry.areaName,
                        processes: Array.from(modEntry.processMap.values()).map(proc => {
                            let totalModChecking = globalTqcTotalChecking;
                            return {
                                processName: proc.processName,
                                setupProcessId: proc.setupProcessId,
                                defectRate: totalModChecking > 0 ? (proc.totalDefect / totalModChecking) * 100 : 0,
                                totalDefect: proc.totalDefect,
                                totalChecking: totalModChecking,
                                defects: Array.from(proc.defectMap.values()),
                                qtyCheckingMorning: 0, qtyCheckingAfternoon: 0, qtyDefectMorning: 0, qtyDefectAfternoon: 0,
                                usp: [...proc.uspSet].join(', ') || null,
                                ctq: [...proc.ctqSet].join(', ') || null
                            };
                        }).sort((a, b) => b.defectRate - a.defectRate)
                    });
                }
            }
        }
        let rqcTotalDefect = 0;
        let rqcTotalChecking = 0;
        let rqcDefectRateSum = 0;
        let rqcProcessCount = 0;
        for (const area of areas) {
            for (const proc of area.processes) {
                rqcTotalDefect += proc.totalDefect;
                rqcTotalChecking += proc.totalChecking;
                rqcDefectRateSum += parseFloat(proc.defectRate.toFixed(2));
                rqcProcessCount++;
            }
        }
        const rqcDefectRate = rqcProcessCount > 0 ? rqcDefectRateSum / rqcProcessCount : 0;
        const rqcPassRate = 100 - rqcDefectRate;
        let tqcTotalDefect = 0;
        let tqcDefectRateSum = 0;
        let tqcProcessCount = 0;
        if (tqcRecords && tqcRecords.length > 0) {
            for (const tqc of tqcRecords) {
                if (hasUspClassification(tqc))
                    tqcTotalDefect += (tqc.qtyDefect || 0);
            }
            for (const tArea of tqcAreas) {
                for (const proc of tArea.processes) {
                    tqcDefectRateSum += parseFloat(proc.defectRate.toFixed(2));
                    tqcProcessCount++;
                }
            }
        }
        let finalTqcTotalChecking = 0;
        if (tqcRecords && tqcRecords.length > 0) {
            const finalTqcUniqueChecks = (0, tqc_checking_1.tqcDayCellChecking)(tqcRecords, tqc => `${tqc.date ? tqc.date.toISOString().split('T')[0] : 'no-date'}_${tqc.cell || tqc.building || 'no-cell'}`);
            for (const qty of finalTqcUniqueChecks.values())
                finalTqcTotalChecking += qty;
        }
        const tqcDefectRate = tqcProcessCount > 0 ? tqcDefectRateSum / tqcProcessCount : 0;
        const tqcPassRate = 100 - tqcDefectRate;
        return this.serializeBigInt({
            areas,
            tqcAreas,
            rqcOverallStats: {
                totalChecking: rqcTotalChecking,
                totalDefect: rqcTotalDefect,
                defectRate: rqcDefectRate,
                passRate: rqcPassRate
            },
            tqcOverallStats: {
                totalChecking: finalTqcTotalChecking,
                totalDefect: tqcTotalDefect,
                defectRate: tqcDefectRate,
                passRate: tqcPassRate
            }
        });
    }
    async getImmediateActionData(filters) {
        let headerConditions = {};
        if (filters?.modelId)
            headerConditions.setupModelId = BigInt(filters.modelId);
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        }
        else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        }
        else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
        }
        if (filters?.factoryId)
            headerConditions.factoryId = BigInt(filters.factoryId);
        if (filters?.cell)
            headerConditions.cell = filters.cell;
        const processConditions = {
            rqcArea: { rqcHeader: headerConditions }
        };
        if (filters?.areaName) {
            processConditions.rqcArea.setupArea = { masterArea: { area: filters.areaName } };
        }
        const immediateInspections = await this.prisma.rqcInspection.findMany({
            where: {
                rqcProcess: processConditions,
                status: 'IMMEDIATE_ACTION'
            },
            include: {
                masterDefect: true,
                rqcProcess: {
                    include: {
                        setupProcess: {
                            include: {
                                masterProcess: true,
                                setupArea: { include: { masterArea: true } }
                            }
                        },
                        rqcArea: {
                            include: { rqcHeader: true }
                        }
                    }
                }
            },
            orderBy: {
                rqcProcess: { rqcArea: { rqcHeader: { date: 'desc' } } }
            }
        });
        const formatted = immediateInspections.map(insp => {
            const header = insp.rqcProcess?.rqcArea?.rqcHeader;
            const proc = insp.rqcProcess?.setupProcess;
            return {
                id: insp.rqcInspectionId,
                date: header?.date ? header.date.toISOString().split('T')[0] : '',
                checkingTime: header?.checkingTime || '-',
                defectName: insp.masterDefect?.defect || '-',
                photoDefect: insp.photoDefect || null,
                processName: proc?.masterProcess?.process || '-',
                qtyChecking: insp.rqcProcess?.qtyChecking || 0,
                qtyDefect: insp.qtyDefect || 0,
                actionPlan: insp.actionPlan || '-',
                photoAfterActionPlan: insp.photoAfterActionPlan || null,
            };
        });
        return this.serializeBigInt(formatted);
    }
    async getTqcEolSummary(filters) {
        let tqcWhere = {};
        if (filters?.modelId) {
            const setupModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: model_match_1.MODEL_MATCH_SELECT
            });
            if (setupModel?.modelName) {
                tqcWhere = { ...tqcWhere, ...(0, model_match_2.tqcWhereForModel)(setupModel) };
            }
            else {
                return { cells: [], passRateData: [], averagePassRate: 0, averageDefectRate: 0, topDefects: [], qtyChecking: 0, qtyDefect: 0 };
            }
        }
        if (filters?.startDate && filters?.endDate) {
            tqcWhere.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        }
        else if (filters?.startDate) {
            tqcWhere.date = { gte: new Date(filters.startDate) };
        }
        else if (filters?.endDate) {
            tqcWhere.date = { lte: new Date(filters.endDate) };
        }
        const allTqcRecordsFilterFree = await this.prisma.tqcReport.findMany({
            where: { ...tqcWhere, moduleType: { in: ['ASSEMBLY', 'TREATMENT'] } },
            select: { moduleType: true, cell: true, building: true }
        });
        const uniqueCellsSet = new Set();
        let hasTreatment = false;
        allTqcRecordsFilterFree.forEach((t) => {
            if (t.moduleType === 'TREATMENT')
                hasTreatment = true;
            if (t.moduleType === 'ASSEMBLY') {
                const c = (t.cell || t.building || '').trim().toUpperCase();
                if (c)
                    uniqueCellsSet.add(c);
            }
        });
        const cells = Array.from(uniqueCellsSet).sort();
        const tabs = hasTreatment ? ['TREATMENT', ...cells] : cells;
        if (filters?.cell) {
            if (filters.cell === 'TREATMENT') {
                tqcWhere.moduleType = 'TREATMENT';
            }
            else {
                tqcWhere.moduleType = 'ASSEMBLY';
                tqcWhere.OR = [
                    { cell: filters.cell },
                    { building: filters.cell }
                ];
            }
        }
        else {
            if (hasTreatment) {
                tqcWhere.moduleType = 'TREATMENT';
            }
            else if (cells.length > 0) {
                tqcWhere.moduleType = 'ASSEMBLY';
                tqcWhere.OR = [{ cell: cells[0] }, { building: cells[0] }];
            }
            else {
                tqcWhere.moduleType = 'ASSEMBLY';
            }
        }
        const tqcRecords = await this.prisma.tqcReport.findMany({ where: tqcWhere });
        const dailyMap = new Map();
        const defectMap = new Map();
        let overallDefectCount = 0;
        tqcRecords.forEach((t) => {
            const dateStr = t.date ? t.date.toISOString().split('T')[0] : 'Unknown';
            const cellVal = (t.cell || t.building || 'no-cell').trim().toUpperCase();
            const defectName = t.defectName || 'UNKNOWN';
            if (!dailyMap.has(dateStr))
                dailyMap.set(dateStr, { uniqueCells: new Set(), totalDefect: 0 });
            const dayObj = dailyMap.get(dateStr);
            dayObj.uniqueCells.add(cellVal);
            if (!(0, tqc_checking_1.isCtqTqcDefect)(t))
                return;
            const defectQty = t.qtyDefect || 0;
            dayObj.totalDefect += defectQty;
            overallDefectCount += defectQty;
            if (!defectMap.has(defectName))
                defectMap.set(defectName, 0);
            defectMap.set(defectName, defectMap.get(defectName) + defectQty);
        });
        const passRateData = [];
        let globalChecking = 0;
        let sumDailyPassRate = 0;
        let sumDailyDefRate = 0;
        let validDays = 0;
        const dayCellChecking = (0, tqc_checking_1.tqcDayCellChecking)(tqcRecords, (t) => `${t.date ? t.date.toISOString().split('T')[0] : 'Unknown'}_${(t.cell || t.building || 'no-cell').trim().toUpperCase()}`);
        Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, stats]) => {
            const dailyChecking = [...stats.uniqueCells].reduce((sum, c) => sum + (dayCellChecking.get(`${date}_${c}`) ?? tqc_checking_1.TQC_CHECK_PER_DAY), 0);
            globalChecking += dailyChecking;
            let passRate = 100;
            let defRate = 0;
            if (dailyChecking > 0) {
                defRate = (stats.totalDefect / dailyChecking) * 100;
                passRate = ((dailyChecking - stats.totalDefect) / dailyChecking) * 100;
            }
            if (dailyChecking > 0) {
                sumDailyPassRate += passRate;
                sumDailyDefRate += defRate;
                validDays++;
            }
            passRateData.push({
                isoDate: date,
                date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
                passRate: Math.round((passRate + Number.EPSILON) * 100) / 100,
                defectRate: Math.round((defRate + Number.EPSILON) * 100) / 100,
                qtyChecking: dailyChecking,
                qtyDefect: stats.totalDefect
            });
        });
        const allDefects = Array.from(defectMap.entries()).map(([name, qty]) => {
            const rate = globalChecking > 0 ? (qty / globalChecking) * 100 : 0;
            return {
                name,
                absoluteVal: rate,
                qty
            };
        }).sort((a, b) => b.qty - a.qty);
        const topDefects = allDefects;
        const averagePassRate = validDays > 0 ? (sumDailyPassRate / validDays) : 100;
        const averageDefectRate = globalChecking > 0 ? (overallDefectCount / globalChecking) * 100 : 0;
        return {
            tabs,
            passRateData,
            averagePassRate: Math.round((averagePassRate + Number.EPSILON) * 100) / 100,
            averageDefectRate: Math.round((averageDefectRate + Number.EPSILON) * 100) / 100,
            topDefects,
            qtyChecking: globalChecking,
            qtyDefect: overallDefectCount
        };
    }
    async getCapData(filters) {
        let headerConditions = {};
        if (filters?.modelId)
            headerConditions.setupModelId = BigInt(filters.modelId);
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        }
        else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        }
        else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
        }
        if (filters?.factoryId)
            headerConditions.factoryId = BigInt(filters.factoryId);
        if (filters?.cell)
            headerConditions.cell = filters.cell;
        const capInspections = await this.prisma.rqcInspection.findMany({
            where: {
                rqcProcess: {
                    rqcArea: {
                        rqcHeader: headerConditions
                    }
                },
                status: 'CAP'
            },
            include: {
                masterDefect: true,
                rqcProcess: {
                    include: {
                        setupProcess: {
                            include: {
                                masterProcess: true,
                                setupArea: { include: { masterArea: true } }
                            }
                        },
                        rqcArea: {
                            include: { rqcHeader: true }
                        }
                    }
                }
            },
            orderBy: {
                rqcProcess: {
                    rqcArea: {
                        rqcHeader: {
                            date: 'desc'
                        }
                    }
                }
            }
        });
        const formatted = capInspections.map(insp => {
            const header = insp.rqcProcess?.rqcArea?.rqcHeader;
            const weekStr = header?.date ? `W${Math.ceil(header.date.getDate() / 7)} ${header.date.toLocaleString('en-US', { month: 'short' })}` : 'N/A';
            return {
                id: insp.rqcInspectionId,
                date: header?.date,
                weekStr,
                areaName: insp.rqcProcess?.setupProcess?.setupArea?.masterArea?.area || 'UNKNOWN',
                processName: insp.rqcProcess?.setupProcess?.masterProcess?.process || 'UNKNOWN',
                defectName: insp.masterDefect?.defect || 'UNKNOWN',
                qtyDefect: insp.qtyDefect,
                rootCause: insp.rootCause || '',
                actionPlan: insp.actionPlan || '',
                corrective: insp.corrective || '',
                photoAfterActionPlan: insp.photoAfterActionPlan || null
            };
        });
        return this.serializeBigInt({ capData: formatted });
    }
    async getCtqDetails(filters) {
        let headerConditions = {
            setupModelId: BigInt(filters.modelId)
        };
        if (filters.startDate && filters.endDate) {
            headerConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        }
        else if (filters.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        }
        else if (filters.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
        }
        const rqcProcesses = await this.prisma.rqcProcess.findMany({
            where: {
                rqcArea: { rqcHeader: headerConditions },
                setupProcess: {
                    masterProcess: {
                        ctq: { equals: filters.ctqType, mode: 'insensitive' }
                    }
                }
            },
            include: {
                setupProcess: {
                    include: {
                        masterProcess: true,
                        setupArea: { include: { masterArea: true } },
                        masterUsp: true
                    }
                },
                rqcInspections: {
                    select: { qtyDefect: true }
                }
            }
        });
        const sellingPointMap = new Map();
        const areaMap = new Map();
        const setupProcesses = await this.prisma.setupProcess.findMany({
            where: {
                setupArea: { setupModelId: BigInt(filters.modelId) },
                masterProcess: { ctq: { equals: filters.ctqType, mode: 'insensitive' } }
            },
            include: {
                masterProcess: true,
                setupArea: { include: { masterArea: true } },
                masterUsp: true
            }
        });
        for (const sp of setupProcesses) {
            const areaName = sp.setupArea?.masterArea?.area || 'UNKNOWN';
            const processName = sp.masterProcess?.process || 'UNKNOWN';
            const uspName = sp.masterUsp?.uspName || '-';
            if (!sellingPointMap.has(uspName)) {
                sellingPointMap.set(uspName, { totalChecking: 0, totalDefect: 0 });
            }
            if (!areaMap.has(areaName)) {
                areaMap.set(areaName, { areaName, processMap: new Map() });
            }
            const areaEntry = areaMap.get(areaName);
            if (!areaEntry.processMap.has(processName)) {
                areaEntry.processMap.set(processName, { processName, uspName, isSellingPoint: sp.isSellingPoint || false, totalChecking: 0, totalDefect: 0 });
            }
        }
        for (const rp of rqcProcesses) {
            const areaName = rp.setupProcess?.setupArea?.masterArea?.area || 'UNKNOWN';
            const processName = rp.setupProcess?.masterProcess?.process || 'UNKNOWN';
            const uspName = rp.setupProcess?.masterUsp?.uspName || '-';
            const isSellingPoint = rp.setupProcess?.isSellingPoint || false;
            const qtyChecking = rp.qtyChecking || 0;
            const qtyDefect = rp.rqcInspections.reduce((sum, insp) => sum + (insp.qtyDefect || 0), 0);
            if (!sellingPointMap.has(uspName)) {
                sellingPointMap.set(uspName, { totalChecking: 0, totalDefect: 0 });
            }
            const spEntry = sellingPointMap.get(uspName);
            spEntry.totalChecking += qtyChecking;
            spEntry.totalDefect += qtyDefect;
            if (!areaMap.has(areaName)) {
                areaMap.set(areaName, { areaName, processMap: new Map() });
            }
            const areaEntry = areaMap.get(areaName);
            if (!areaEntry.processMap.has(processName)) {
                areaEntry.processMap.set(processName, { processName, uspName, isSellingPoint, totalChecking: 0, totalDefect: 0 });
            }
            const procEntry = areaEntry.processMap.get(processName);
            procEntry.totalChecking += qtyChecking;
            procEntry.totalDefect += qtyDefect;
        }
        const sellingPoints = Array.from(sellingPointMap.entries()).map(([sp, stat]) => {
            const defectRate = stat.totalChecking > 0 ? (stat.totalDefect / stat.totalChecking) * 100 : 0;
            const passRate = stat.totalChecking > 0 ? 100 - defectRate : 0;
            return {
                name: sp.toUpperCase(),
                passRate,
                defectRate,
                hasData: stat.totalChecking > 0
            };
        });
        const areas = Array.from(areaMap.values()).map(area => ({
            areaName: area.areaName,
            processes: Array.from(area.processMap.values()).map(proc => {
                const defectRate = proc.totalChecking > 0 ? (proc.totalDefect / proc.totalChecking) * 100 : 0;
                const passRate = proc.totalChecking > 0 ? 100 - defectRate : 0;
                return {
                    processName: proc.processName,
                    uspName: proc.uspName,
                    isSellingPoint: proc.isSellingPoint,
                    passRate,
                    defectRate,
                    hasData: proc.totalChecking > 0
                };
            }).sort((a, b) => b.defectRate - a.defectRate)
        }));
        return this.serializeBigInt({
            uspGroups: sellingPoints,
            areas
        });
    }
    async getDefectCtqSummary(modelIdStr, startDate, endDate, cell) {
        const modelId = BigInt(modelIdStr);
        let dateFilterRqc = undefined;
        let dateFilterTqc = undefined;
        if (startDate || endDate) {
            dateFilterRqc = {};
            dateFilterTqc = {};
            if (startDate) {
                dateFilterRqc.gte = new Date(startDate);
                dateFilterTqc.gte = new Date(startDate);
            }
            if (endDate) {
                dateFilterRqc.lte = new Date(`${endDate}T23:59:59.999Z`);
                dateFilterTqc.lte = new Date(`${endDate}T23:59:59.999Z`);
            }
        }
        const rqcWhere = { setupModelId: modelId };
        if (dateFilterRqc)
            rqcWhere.date = dateFilterRqc;
        if (cell)
            rqcWhere.cell = cell;
        const model = await this.prisma.setupModel.findUnique({ where: { setupModelId: modelId }, select: model_match_1.MODEL_MATCH_SELECT });
        if (!model)
            return { usps: [], rqcData: {}, tqcData: {}, rqcTopProcesses: [], tqcTopDefects: [] };
        const tqcWhere = { ...(0, model_match_2.tqcWhereForModel)(model, 'equals') };
        if (dateFilterTqc)
            tqcWhere.date = dateFilterTqc;
        if (cell)
            tqcWhere.cell = cell;
        const setupProcs = await this.prisma.setupProcess.findMany({
            where: { setupArea: { setupModelId: modelId } },
            include: { masterProcess: true, masterUsp: true }
        });
        const processUspMap = new Map();
        const uspsSet = new Set();
        setupProcs.forEach(p => {
            if (p.masterUsp) {
                const uspName = p.masterUsp.uspName.toUpperCase();
                processUspMap.set(p.setupProcessId, uspName);
                uspsSet.add(uspName);
            }
        });
        const rqcHeaders = await this.prisma.rqcHeader.findMany({
            where: rqcWhere,
            include: {
                rqcAreas: {
                    include: {
                        rqcProcesses: {
                            include: { rqcInspections: { include: { masterDefect: true } } }
                        }
                    }
                }
            }
        });
        const rqcUspAggregates = new Map();
        const rqcProcessAggregates = new Map();
        const rqcDefectNameAggregates = new Map();
        rqcHeaders.forEach(header => {
            header.rqcAreas.forEach(area => {
                area.rqcProcesses.forEach(proc => {
                    const procName = setupProcs.find(sp => sp.setupProcessId === proc.setupProcessId)?.masterProcess.process || 'UNKNOWN';
                    const uspName = processUspMap.get(proc.setupProcessId) || null;
                    const isSellingPoint = setupProcs.find(sp => sp.setupProcessId === proc.setupProcessId)?.isSellingPoint || false;
                    const qtyCheck = proc.qtyChecking;
                    let qtyDefect = 0;
                    proc.rqcInspections.forEach((ins) => {
                        qtyDefect += ins.qtyDefect;
                        const defectName = ins.masterDefect?.defect || 'UNKNOWN DEFECT';
                        if (!rqcDefectNameAggregates.has(defectName)) {
                            rqcDefectNameAggregates.set(defectName, { qtyDefect: 0, uspName, isSellingPoint: false, byProcess: {} });
                        }
                        const defectAgg = rqcDefectNameAggregates.get(defectName);
                        defectAgg.qtyDefect += ins.qtyDefect;
                        defectAgg.isSellingPoint ||= isSellingPoint;
                        defectAgg.byProcess[procName] = (defectAgg.byProcess[procName] || 0) + ins.qtyDefect;
                    });
                    if (!rqcProcessAggregates.has(procName)) {
                        rqcProcessAggregates.set(procName, { qtyCheck: 0, qtyDefect: 0, uspName, isSellingPoint: false });
                    }
                    rqcProcessAggregates.get(procName).qtyCheck += qtyCheck;
                    rqcProcessAggregates.get(procName).qtyDefect += qtyDefect;
                    rqcProcessAggregates.get(procName).isSellingPoint ||= isSellingPoint;
                    if (uspName) {
                        if (!rqcUspAggregates.has(uspName)) {
                            rqcUspAggregates.set(uspName, { qtyCheck: 0, qtyDefect: 0 });
                        }
                        rqcUspAggregates.get(uspName).qtyCheck += qtyCheck;
                        rqcUspAggregates.get(uspName).qtyDefect += qtyDefect;
                    }
                });
            });
        });
        const tqcRecords = await this.prisma.tqcReport.findMany({ where: tqcWhere });
        const tqcDefectAggregates = new Map();
        const tqcUspAggregates = new Map();
        const globalTqcUniqueChecks = new Map();
        const tqcDayChecks = (0, tqc_checking_1.tqcDayCellChecking)(tqcRecords, (t) => `${t.date ? (typeof t.date === 'string' ? new Date(t.date).toISOString().split('T')[0] : t.date.toISOString().split('T')[0]) : 'no-date'}_${t.cell || t.building || 'no-cell'}`);
        tqcRecords.forEach((t) => {
            const cellKey = t.cell || t.building || 'no-cell';
            const dateKey = t.date ? (typeof t.date === 'string' ? new Date(t.date).toISOString().split('T')[0] : t.date.toISOString().split('T')[0]) : 'no-date';
            const uniqueDayCellKey = `${dateKey}_${cellKey}`;
            globalTqcUniqueChecks.set(uniqueDayCellKey, tqcDayChecks.get(uniqueDayCellKey) ?? tqc_checking_1.TQC_CHECK_PER_DAY);
            const uspName = t.uspClassification ? t.uspClassification.toUpperCase() : null;
            if (uspName)
                uspsSet.add(uspName);
            const defName = t.defectName || 'Unmapped';
            const qtyDefect = t.qtyDefect || 0;
            if (!tqcDefectAggregates.has(defName)) {
                tqcDefectAggregates.set(defName, { qtyDefect: 0, uspName });
            }
            tqcDefectAggregates.get(defName).qtyDefect += qtyDefect;
            if (uspName) {
                if (!tqcUspAggregates.has(uspName)) {
                    tqcUspAggregates.set(uspName, { qtyDefect: 0 });
                }
                tqcUspAggregates.get(uspName).qtyDefect += qtyDefect;
            }
        });
        let globalTqcTotalChecking = 0;
        for (const qty of globalTqcUniqueChecks.values())
            globalTqcTotalChecking += qty;
        const usps = Array.from(uspsSet).sort();
        const rqcData = {};
        const tqcData = {};
        const rqcTopProcessesByUsp = {};
        const rqcTopDefectsByUsp = {};
        const tqcTopDefectsByUsp = {};
        usps.forEach(u => {
            const processesForUsp = Array.from(rqcProcessAggregates.entries()).filter(([_, v]) => v.uspName === u);
            let rqcUspsSumCheck = 0;
            let rqcUspsSumDefect = 0;
            let rqcUspsSumPassRate = 0;
            let rqcUspsSumDefRate = 0;
            let processCount = 0;
            const rqcCharts = processesForUsp.map(([name, v]) => {
                rqcUspsSumCheck += v.qtyCheck;
                rqcUspsSumDefect += v.qtyDefect;
                const defRate = v.qtyCheck > 0 ? (v.qtyDefect / v.qtyCheck) * 100 : 0;
                const pRate = v.qtyCheck > 0 ? 100 - defRate : 0;
                if (v.qtyCheck > 0) {
                    rqcUspsSumPassRate += pRate;
                    rqcUspsSumDefRate += defRate;
                    processCount++;
                }
                return {
                    name,
                    rate: defRate,
                    qty: v.qtyDefect,
                    qtyCheck: v.qtyCheck,
                    isUsp: v.isSellingPoint
                };
            }).sort((a, b) => b.rate - a.rate);
            const rqcAvgPassRate = processCount > 0 ? rqcUspsSumPassRate / processCount : 0;
            const rqcAvgDefRate = processCount > 0 ? rqcUspsSumDefRate / processCount : 0;
            rqcData[u] = {
                passRate: processCount > 0 ? rqcAvgPassRate : 100,
                defectRate: rqcAvgDefRate,
                qtyCheck: rqcUspsSumCheck,
                qtyDefect: rqcUspsSumDefect
            };
            rqcTopProcessesByUsp[u] = rqcCharts;
            const defectsForUspRqc = Array.from(rqcDefectNameAggregates.entries()).filter(([_, v]) => v.uspName === u);
            rqcTopDefectsByUsp[u] = defectsForUspRqc.map(([name, v]) => ({
                name,
                qty: v.qtyDefect,
                isUsp: v.isSellingPoint,
                byProcess: v.byProcess
            })).sort((a, b) => b.qty - a.qty);
            const defectsForUsp = Array.from(tqcDefectAggregates.entries()).filter(([_, v]) => v.uspName === u);
            let tqcUspsSumCheck = globalTqcTotalChecking;
            let tqcUspsSumDefect = 0;
            const tqcAgg = tqcUspAggregates.get(u);
            if (tqcAgg) {
                tqcUspsSumDefect = tqcAgg.qtyDefect;
            }
            const tqcAvgDefRate = tqcUspsSumCheck > 0 ? (tqcUspsSumDefect / tqcUspsSumCheck) * 100 : 0;
            const tqcAvgPassRate = tqcUspsSumCheck > 0 ? 100 - tqcAvgDefRate : 100;
            tqcData[u] = {
                passRate: tqcAvgPassRate,
                defectRate: tqcAvgDefRate,
                qtyCheck: tqcUspsSumCheck,
                qtyDefect: tqcUspsSumDefect
            };
            const tqcCharts = defectsForUsp.map(([name, v]) => ({
                name,
                rate: tqcUspsSumCheck > 0 ? (v.qtyDefect / tqcUspsSumCheck) * 100 : 0,
                qty: v.qtyDefect,
                qtyCheck: tqcUspsSumCheck,
                isUsp: true
            })).sort((a, b) => b.rate - a.rate);
            tqcTopDefectsByUsp[u] = tqcCharts;
        });
        return {
            usps,
            rqcData,
            tqcData,
            rqcTopProcessesByUsp,
            rqcTopDefectsByUsp,
            tqcTopDefectsByUsp
        };
    }
    serializeBigInt(obj) {
        return JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));
    }
};
exports.RqcService = RqcService;
exports.RqcService = RqcService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, notifications_service_1.NotificationsService])
], RqcService);
//# sourceMappingURL=rqc.service.js.map