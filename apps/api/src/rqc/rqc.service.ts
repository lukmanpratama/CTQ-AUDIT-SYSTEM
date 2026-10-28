import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CAP_DAILY_THRESHOLD } from '../common/cap-thresholds';
import { MODEL_MATCH_SELECT } from '../common/model-match';
import { CreateHeaderDto, CreateInspectionDto, UpdateHeaderDto } from './rqc.dto';
import { modelLabel, tqcWhereForModel } from '../common/model-match';
import { TQC_CHECK_PER_DAY, TQC_CHECK_PER_HOUR, isCtqTqcDefect, tqcDayCellChecking, tqcSlotChecking } from '../common/tqc-checking';

// TQC defects count on the CTQ dashboards only when the row has a USP Classification
const hasUspClassification = (tqc: { uspClassification?: string | null }) => !!tqc.uspClassification?.trim();

type HeaderListFilters = { model?: string; modelId?: string; startDate?: string; endDate?: string; checkingTime?: string; inspector?: string; factoryId?: string; cell?: string };

@Injectable()
export class RqcService {
    constructor(private prisma: PrismaService, private notifications: NotificationsService) { }

    async createHeader(dto: CreateHeaderDto) {
        // Resolve PO to snapshot data (to satisfy historical integrity requirement)
        const poData = await this.prisma.masterPo.findUnique({
            where: { po: dto.po }
        });

        if (!poData) {
            throw new NotFoundException(`PO ${dto.po} not found in master data.`);
        }

        // An audit started offline is sent with the id the phone gave it: a second send (retry after a
        // lost response) returns that audit instead of creating a duplicate
        if (dto.rqcHeaderId) {
            const existing = await this.findSameClientHeader(dto);
            if (existing) return existing;
        }

        // A clear error instead of a foreign-key 500 (e.g. an inspector removed while a phone was offline)
        const inspector = await this.prisma.masterUser.findUnique({ where: { nik: dto.nik }, select: { nik: true } });
        if (!inspector) {
            throw new BadRequestException(`Inspector NIK ${dto.nik} tidak terdaftar di Master User.`);
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
                    article: poData.article, // Snaphots
                    model: poData.model,     // Snaphots
                    qtyOrder: poData.qtyOrder, // Snaphots
                    factoryId: resolvedFactoryId,
                    nik: dto.nik,
                    cell: dto.cell,
                }
            });
            return this.serializeBigInt(header);
        } catch (e) {
            // The same id sent twice at once: the other request created it first
            if (dto.rqcHeaderId && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                const existing = await this.findSameClientHeader(dto);
                if (existing) return existing;
            }
            throw e;
        }
    }

    /**
     * The header created earlier with this client id, or null. Same id but a different audit
     * (model, PO, date, time or inspector) is a conflict, never silently merged.
     */
    private async findSameClientHeader(dto: CreateHeaderDto) {
        const existing = await this.prisma.rqcHeader.findUnique({ where: { rqcHeaderId: dto.rqcHeaderId! } });
        if (!existing) return null;
        const same =
            String(existing.setupModelId) === String(dto.setupModelId) &&
            existing.po === dto.po &&
            existing.nik === dto.nik &&
            existing.checkingTime === dto.checkingTime &&
            existing.date.toISOString().slice(0, 10) === String(dto.date).slice(0, 10);
        if (!same) {
            throw new ConflictException(`Inspeksi dengan id ${dto.rqcHeaderId} sudah ada dengan data berbeda.`);
        }
        return this.serializeBigInt(existing);
    }

    async updateHeader(headerId: string, dto: UpdateHeaderDto) {
        const existing = await this.prisma.rqcHeader.findUnique({
            where: { rqcHeaderId: headerId },
            select: { po: true }
        });
        if (!existing) {
            throw new NotFoundException(`RqcHeader ${headerId} not found`);
        }

        const data: any = {
            date: new Date(dto.date),
            checkingTime: dto.checkingTime,
            factoryId: await this.resolveFactoryId(dto.factoryId),
            cell: dto.cell,
        };

        // Only re-snapshot PO data when the PO itself changed
        if (dto.po !== existing.po) {
            const poData = await this.prisma.masterPo.findUnique({ where: { po: dto.po } });
            if (!poData) {
                throw new NotFoundException(`PO ${dto.po} not found in master data.`);
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
            // Inspections carry a copy of the header date; keep them in sync
            this.prisma.rqcInspection.updateMany({
                where: { rqcProcess: { rqcArea: { rqcHeaderId: headerId } } },
                data: { date: data.date }
            }),
        ]);

        return this.serializeBigInt(header);
    }

    private async resolveFactoryId(factoryId: string): Promise<bigint> {
        let resolvedFactoryId: bigint;
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
        } else if (factoryId === 'BOTTOM' || factoryId === 'BOTTOM 1' || factoryId === 'BOTTOM 2') {
            // Resolve BOTTOM, BOTTOM 1, BOTTOM 2 — stored as-is in masterFactory
            const factoryName = factoryId; // 'BOTTOM', 'BOTTOM 1', or 'BOTTOM 2'
            let bottomFactory = await this.prisma.masterFactory.findUnique({
                where: { factory: factoryName }
            });
            if (!bottomFactory) {
                bottomFactory = await this.prisma.masterFactory.create({
                    data: { factory: factoryName }
                });
            }
            resolvedFactoryId = bottomFactory.factoryId;
        } else {
            resolvedFactoryId = BigInt(factoryId);
        }

        return resolvedFactoryId;
    }

    async submitProcessInspection(
        headerId: string,
        setupAreaId: string,
        setupProcessId: string,
        dto: CreateInspectionDto
    ) {
        const areaIdBigInt = BigInt(setupAreaId);
        const processIdBigInt = BigInt(setupProcessId);

        const header = await this.prisma.rqcHeader.findUnique({
            where: { rqcHeaderId: headerId },
            select: { date: true }
        });
        const headerDate = header?.date || new Date();

        // 1. Ensure RqcArea exists. If not, create it lazily.
        // This allows UI to just POST inspection directly.
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

        // 2. Upsert the RqcProcess entry (qtyChecking lives here)
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

        // 3. Prepare and insert/update defects with metrics calculation
        for (const d of dto.defects) {
            const defectRate = dto.qtyChecking > 0 ? (d.qtyDefect / dto.qtyChecking) : 0;
            const passRate = Math.max(0, 1 - defectRate);

            // Action Decision rule from PRD: rate > 20% = CAP
            const status = defectRate > CAP_DAILY_THRESHOLD ? 'CAP' : 'IMMEDIATE_ACTION';

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

        // Daily CAP popup for everyone with the app open; a failed alert must not fail the save
        try {
            await this.notifications.notifyDailyCap(processTx.rqcProcessId);
        } catch (e) {
            console.error('Daily CAP notification failed', e);
        }

        return this.serializeBigInt({
            message: 'Inspection submitted successfully',
            rqcProcessId: processTx.rqcProcessId,
            processedDefects: dto.defects.length
        });
    }

    async deleteProcessInspection(
        headerId: string,
        setupAreaId: string,
        setupProcessId: string
    ) {
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

        if (!area) return { message: 'Area not found' };

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

    async deleteHeader(headerId: string) {
        return this.prisma.$transaction(async (tx) => {
            // Find all areas for this header
            const areas = await tx.rqcArea.findMany({
                where: { rqcHeaderId: headerId },
                select: { rqcAreaId: true }
            });
            const areaIds = areas.map(a => a.rqcAreaId);

            if (areaIds.length > 0) {
                // Find all processes for these areas
                const processes = await tx.rqcProcess.findMany({
                    where: { rqcAreaId: { in: areaIds } },
                    select: { rqcProcessId: true }
                });
                const processIds = processes.map(p => p.rqcProcessId);

                if (processIds.length > 0) {
                    // Delete inspections
                    await tx.rqcInspection.deleteMany({
                        where: { rqcProcessId: { in: processIds } }
                    });
                }

                // Delete processes
                await tx.rqcProcess.deleteMany({
                    where: { rqcAreaId: { in: areaIds } }
                });

                // Delete areas
                await tx.rqcArea.deleteMany({
                    where: { rqcHeaderId: headerId }
                });
            }

            // Delete header
            await tx.rqcHeader.delete({
                where: { rqcHeaderId: headerId }
            });

            return { success: true };
        });
    }

    async getHeaderSession(headerId: string) {
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
            throw new NotFoundException(`RqcHeader ${headerId} not found`);
        }

        return this.serializeBigInt(header);
    }

    async getAllHeaders(filters: HeaderListFilters) {
        const headers = await this.prisma.rqcHeader.findMany({
            where: this.buildHeaderWhere(filters),
            orderBy: { createdAt: 'desc' },
            include: {
                // Only the name: setupModel.picture is a large base64 image and was repeated
                // for every header (117 headers ≈ 47 MB), making the browser fetch fail.
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

    /**
     * Inspection Report list: headers grouped per model, one page of rows per model.
     * Each row carries its checks/defects totals (summed in SQL) instead of the whole
     * area → process → inspection tree. Without `groupModelId` every model comes back with
     * its first page; with it, only that model at `page`.
     */
    async getHeadersByModel(filters: HeaderListFilters & { groupModelId?: string; page?: string; pageSize?: string }) {
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

        const groups = await Promise.all(counts.map(async c => {
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
                label: model ? modelLabel(model) : rows[0]?.model || '-',
                total, page, totalPages, rows,
            };
        }));

        // Checks / defects / CAP rows (defect rate above the daily CAP threshold) per header, for these pages only
        const ids = groups.flatMap(g => g.rows.map(r => r.rqcHeaderId));
        const totals = ids.length === 0 ? [] : await this.prisma.$queryRaw<{ id: string; checks: number; defects: number; caps: number }[]>`
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

    /** Dashboards used to download every header (with its whole inspection tree) only to list its cells. */
    async getHeaderCells(modelId?: string) {
        return this.prisma.rqcHeader.findMany({
            where: { ...(modelId ? { setupModelId: BigInt(modelId) } : {}), cell: { not: null } },
            distinct: ['cell'],
            select: { cell: true },
            orderBy: { cell: 'asc' },
        });
    }

    private buildHeaderWhere(filters: HeaderListFilters) {
        const whereClause: any = {};

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
                // Ensure date string is parsed and set appropriately
                whereClause.date.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
            }
            if (filters.endDate) {
                whereClause.date.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
            }
        }

        return whereClause;
    }

    async getDashboardFilterOptions() {
        // Query distinct models that have RQC Headers
        const models = await this.prisma.setupModel.findMany({
            where: { rqcHeaders: { some: {} } },
            select: { setupModelId: true, modelName: true, modelNo: true },
            orderBy: { modelName: 'asc' }
        });

        // Query distinct areas that have been part of RQC Areas
        const areas = await this.prisma.masterArea.findMany({
            where: { setupAreas: { some: { rqcAreas: { some: {} } } } },
            select: { areaId: true, area: true },
            orderBy: { area: 'asc' }
        });

        // Query distinct checking times
        const checkingTimeObjects = await this.prisma.rqcHeader.findMany({
            distinct: ['checkingTime'],
            select: { checkingTime: true },
            orderBy: { checkingTime: 'asc' }
        });
        const checkingTimes = checkingTimeObjects.map(h => h.checkingTime).filter(Boolean);

        // Query factories
        const factories = await this.prisma.masterFactory.findMany({
            orderBy: { factory: 'asc' }
        });

        // Query distinct lines (cells)
        const cellObjects = await this.prisma.rqcHeader.findMany({
            distinct: ['cell'],
            select: { cell: true },
            orderBy: { cell: 'asc' }
        });
        const cells = cellObjects.map(h => h.cell).filter(Boolean);

        return this.serializeBigInt({ models, areas, checkingTimes, factories, cells });
    }

    async getDashboardKpis(filters?: { modelId?: string, areaId?: string, startDate?: string, endDate?: string, checkingTime?: string, factoryId?: string, cell?: string }) {
        let inspectionWhere: any = {};
        let headerConditions: any = {};
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
        } else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
            applyingHeaderConditions = true;
        } else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
            applyingHeaderConditions = true;
        }

        let processConditions: any = {};
        let applyingProcessConditions = false;

        if (applyingHeaderConditions) {
            processConditions.rqcArea = { rqcHeader: headerConditions };
            applyingProcessConditions = true;
        }

        if (filters?.areaId) {
            if (['NOSEW', 'PRINTING', 'EMBOSS', 'EMBROIDERY'].includes(filters.areaId)) {
                if (!processConditions.rqcArea) processConditions.rqcArea = {};
                if (!processConditions.rqcArea.rqcHeader) processConditions.rqcArea.rqcHeader = {};
                processConditions.rqcArea.rqcHeader = { ...processConditions.rqcArea.rqcHeader, cell: { startsWith: filters.areaId } };
                applyingProcessConditions = true;
            } else {
                if (!processConditions.rqcArea) processConditions.rqcArea = {};
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

        // Fetch real TQC aggregated statistics based on the model string
        let tqcQtyChecking = 0;
        let tqcQtyDefect = 0;

        if (filters?.modelId) {
            const masterModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: MODEL_MATCH_SELECT
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions: any = {
                    ...tqcWhereForModel(masterModel),
                    moduleType: 'ASSEMBLY'
                };
                if (filters?.startDate && filters?.endDate) {
                    tqcConditions.date = {
                        gte: new Date(filters.startDate),
                        lte: new Date(filters.endDate)
                    };
                } else if (filters?.startDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate) };
                } else if (filters?.endDate) {
                    tqcConditions.date = { lte: new Date(filters.endDate) };
                }

                const tqcRecords = await this.prisma.tqcReport.findMany({
                    where: tqcConditions,
                    select: { date: true, time: true, cell: true, building: true, qty: true, qtyDefect: true, qtyChecking: true }
                });

                // 120 per hour slot, unless the slot's Qty Checking was edited on the TQC Records page
                const uniqueCheckingMap = tqcSlotChecking(tqcRecords, tqc => {
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

        // Total Processes Checked
        const totalProcessCount = await this.prisma.rqcProcess.count({
            where: processConditions
        });

        // Processes that have at least one defect
        const processesWithDefectCount = await this.prisma.rqcProcess.count({
            where: {
                ...processConditions,
                rqcInspections: { some: { qtyDefect: { gt: 0 } } }
            }
        });

        const passCount = totalProcessCount - processesWithDefectCount;

        // Metric queries
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

        // Unfilled metrics
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

        // Calculate Breakdown of Pass Rate by CTQ Type
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

        const ctqMap = new Map<string, { total: number, defects: number }>();

        for (const rp of allProcesses) {
            let ctq = rp.setupProcess?.masterProcess?.ctq;
            if (!ctq || ctq.trim() === '') {
                // If it's empty, we might choose to group it into "OTHER" or skip
                ctq = 'OTHER';
            }

            if (!ctqMap.has(ctq)) {
                ctqMap.set(ctq, { total: 0, defects: 0 });
            }

            const stats = ctqMap.get(ctq)!;
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

    async getRecentInspections(filters?: { modelId?: string, areaId?: string, startDate?: string, endDate?: string, checkingTime?: string, factoryId?: string, cell?: string }) {
        let inspectionWhere: any = {};
        let headerConditions: any = {};
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
        } else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
            applyingHeaderConditions = true;
        } else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
            applyingHeaderConditions = true;
        }

        let processConditions: any = {};
        let applyingProcessConditions = false;

        if (applyingHeaderConditions) {
            processConditions.rqcArea = { rqcHeader: headerConditions };
            applyingProcessConditions = true;
        }

        if (filters?.areaId) {
            if (['NOSEW', 'PRINTING', 'EMBOSS', 'EMBROIDERY'].includes(filters.areaId)) {
                if (!processConditions.rqcArea) processConditions.rqcArea = {};
                if (!processConditions.rqcArea.rqcHeader) processConditions.rqcArea.rqcHeader = {};
                processConditions.rqcArea.rqcHeader = { ...processConditions.rqcArea.rqcHeader, cell: { startsWith: filters.areaId } };
                applyingProcessConditions = true;
            } else {
                if (!processConditions.rqcArea) processConditions.rqcArea = {};
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

            // Determine display status
            const displayStatus = i.status === 'CAP' ? 'CAP' : 'Immediate Action';

            // Submitted logic: for IMMEDIATE_ACTION check actionPlan, for CAP check rootCause
            const isCompleted = i.status === 'CAP'
                ? !!(i.rootCause && i.rootCause.trim() !== '')
                : !!(i.actionPlan && i.actionPlan.trim() !== '');

            return {
                id: i.rqcInspectionId,
                headerId: header.rqcHeaderId,
                date: header.date,
                namaRqc: header.inspector?.namaUser || '-',
                factoryCell: `${header.factory?.factory || '-'} / ${header.cell || '-'}`,
                model: modelLabel(header.setupModel),
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

    async getTrends(filters?: { modelId?: string, areaId?: string, areaName?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string, checkingTime?: string, processName?: string }) {
        let headerConditions: any = {};
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
        } else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
            applyingHeaderConditions = true;
        } else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
            applyingHeaderConditions = true;
        }

        let processConditions: any = {};
        if (applyingHeaderConditions) {
            processConditions.rqcArea = { rqcHeader: headerConditions };
        }
        if (filters?.areaId) {
            if (['NOSEW', 'PRINTING', 'EMBOSS', 'EMBROIDERY'].includes(filters.areaId)) {
                if (!processConditions.rqcArea) processConditions.rqcArea = {};
                if (!processConditions.rqcArea.rqcHeader) processConditions.rqcArea.rqcHeader = {};
                processConditions.rqcArea.rqcHeader = { ...processConditions.rqcArea.rqcHeader, cell: { startsWith: filters.areaId } };
            } else {
                if (!processConditions.rqcArea) processConditions.rqcArea = {};
                processConditions.rqcArea.setupArea = { areaId: BigInt(filters.areaId) };
            }
        }
        if (filters?.areaName) { // Allow String-based Area queries (e.g. CUTTING, SEWING)
            if (!processConditions.rqcArea) processConditions.rqcArea = {};
            // TQC INHOUSE Edge case protection is handled by frontend cell isolation; Inline primarily targets valid master areas
            processConditions.rqcArea.setupArea = { masterArea: { area: filters.areaName } };
        }
        if (filters?.processName) { // RQC Inline: trend of the process clicked on Percentage Defect Treatment
            processConditions.setupProcess = { masterProcess: { process: filters.processName } };
        }

        const processes = await this.prisma.rqcProcess.findMany({
            where: processConditions,
            include: {
                rqcArea: { include: { rqcHeader: true } },
                rqcInspections: { select: { qtyDefect: true } }
            }
        });

        const dailyMap = new Map<string, {
            checking: number, defect: number, rqcChecking: number, rqcDefect: number,
            rqcDefectRateSum: number, rqcProcessCount: number,
            tqcProcessMap: Map<string, { defect: number, checking: number }>
        }>();
        const weeklyMap = new Map<string, { checking: number, defect: number }>();

        const getWeekStr = (d: Date) => {
            const shortMonth = d.toLocaleString('en-US', { month: 'short' });
            const year = d.getFullYear();
            const day = d.getDate();
            const w = Math.ceil(day / 7);
            return `${shortMonth} ${year} W ${w > 4 ? 4 : w}`;
        };

        // Populate TQC Records from TqcReport natively 
        if (filters?.modelId) {
            const masterModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: MODEL_MATCH_SELECT
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions: any = {
                    ...tqcWhereForModel(masterModel),
                    moduleType: 'ASSEMBLY'
                };
                if (filters?.startDate && filters?.endDate) {
                    tqcConditions.date = {
                        gte: new Date(filters.startDate),
                        lte: new Date(filters.endDate)
                    };
                } else if (filters?.startDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate) };
                } else if (filters?.endDate) {
                    tqcConditions.date = { lte: new Date(filters.endDate) };
                }

                if (filters?.cell) {
                    tqcConditions.cell = filters.cell;
                }

                const tqcRecords = await this.prisma.tqcReport.findMany({
                    where: tqcConditions
                });

                const uniqueCheckingMap = new Map<string, number>();
                // 960 per day and cell, adjusted by edited hour slots
                const dayCellChecking = tqcDayCellChecking(tqcRecords.filter(t => t.date), tqc =>
                    `${tqc.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}_${tqc.cell || tqc.building || 'no-cell'}`);

                for (const tqc of tqcRecords) {
                    const dateObj = tqc.date;
                    if (!dateObj) continue;
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const weekStr = getWeekStr(dateObj);

                    if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0, rqcDefectRateSum: 0, rqcProcessCount: 0, tqcProcessMap: new Map() });
                    if (!weeklyMap.has(weekStr)) weeklyMap.set(weekStr, { checking: 0, defect: 0 });

                    const dStats = dailyMap.get(dateStr)!;
                    const wStats = weeklyMap.get(weekStr)!;

                    // Only defects with a USP Classification count as CTQ defects; every row still marks the day/cell as checked
                    const isUspDefect = hasUspClassification(tqc);
                    if (isUspDefect) {
                        dStats.defect += (tqc.qtyDefect || 0);
                        wStats.defect += (tqc.qtyDefect || 0);
                    }

                    const cellKey = tqc.cell || tqc.building || 'no-cell';
                    // Key purely by date and cell (ignoring specific hours like 07.00/08.00)
                    const uniqueDayCellKey = `${dateStr}_${cellKey}`;

                    if (!uniqueCheckingMap.has(uniqueDayCellKey)) {
                        const qtyDiff = dayCellChecking.get(uniqueDayCellKey) ?? TQC_CHECK_PER_DAY; // 8 hours x 120 unless edited

                        uniqueCheckingMap.set(uniqueDayCellKey, qtyDiff);

                        dStats.checking += qtyDiff;
                        wStats.checking += qtyDiff;
                    }

                    if (!isUspDefect) continue;
                    const defectName = tqc.defectName || 'UNKNOWN';
                    // TQC process level map
                    if (!dStats.tqcProcessMap.has(defectName)) {
                        dStats.tqcProcessMap.set(defectName, { defect: 0, checking: 0 });
                    }
                    dStats.tqcProcessMap.get(defectName)!.defect += (tqc.qtyDefect || 0);
                    // The checking size for this "process" is linked to the total cell checking on that day
                    dStats.tqcProcessMap.get(defectName)!.checking = uniqueCheckingMap.get(uniqueDayCellKey) ?? TQC_CHECK_PER_DAY;
                }
            }
        }

        for (const p of processes) {
            const dateObj = p.rqcArea.rqcHeader.date;
            if (!dateObj) continue;

            const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const weekStr = getWeekStr(dateObj);

            if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0, rqcDefectRateSum: 0, rqcProcessCount: 0, tqcProcessMap: new Map() });
            if (!weeklyMap.has(weekStr)) weeklyMap.set(weekStr, { checking: 0, defect: 0 });

            const dStats = dailyMap.get(dateStr)!;
            const wStats = weeklyMap.get(weekStr)!;

            const chk = p.qtyChecking || 0;
            const def = p.rqcInspections.reduce((sum, i) => sum + (i.qtyDefect || 0), 0);

            dStats.rqcChecking += chk;
            dStats.rqcDefect += def;

            const processDefectRate = chk > 0 ? (def / chk) * 100 : 0;
            // Round first to match the UI chart exactly
            dStats.rqcDefectRateSum += parseFloat(processDefectRate.toFixed(2));
            dStats.rqcProcessCount += 1;

            wStats.checking += chk;
            wStats.defect += def;
        }

        const dailyTrend = Array.from(dailyMap.entries()).map(([date, stats]) => {
            let tqcDefectRateSum = 0;
            let tqcProcessCount = 0;
            for (const proc of stats.tqcProcessMap.values()) {
                // Denominator for TQC graph is the global daily checking total
                const rawRate = stats.checking > 0 ? (proc.defect / stats.checking) * 100 : 0;
                // Round to 2 decimals first to guarantee visual sum matches exactly
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
                defectRate: Number(tqcDefectRate.toFixed(2)), // TQC
                defectRateRqc: Number(rqcDefectRate.toFixed(2)), // RQC
                // Raw properties exported safely so client can calculate arbitrary Exact Ratios
                rawRqcChecking: stats.rqcChecking,
                rawRqcDefect: stats.rqcDefect
            };
        });

        const weeklyAggregator = new Map<string, { sum: number, count: number }>();
        dailyTrend.forEach(day => {
            const parsedDate = new Date(day.date);
            if (isNaN(parsedDate.getTime())) return;
            const weekStr = getWeekStr(parsedDate);

            if (!weeklyAggregator.has(weekStr)) {
                weeklyAggregator.set(weekStr, { sum: 0, count: 0 });
            }
            weeklyAggregator.get(weekStr)!.sum += day.avgDefectRate;
            weeklyAggregator.get(weekStr)!.count += 1;
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

    async getProcessDefects(filters?: { modelId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string, checkingTime?: string }) {
        let headerConditions: any = {};

        if (filters?.modelId) {
            headerConditions.setupModelId = BigInt(filters.modelId);
        }
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
        } else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        } else if (filters?.endDate) {
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

        // Fetch all RqcProcesses with full relations
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

        // Group by area → process
        const areaMap = new Map<string, {
            areaName: string;
            processMap: Map<string, {
                processName: string;
                setupProcessId: string;
                totalDefect: number;
                totalChecking: number;
                defectMap: Map<string, { defectName: string; qtyDefect: number }>;
                qtyCheckingMorning: number;
                qtyCheckingAfternoon: number;
                qtyDefectMorning: number;
                qtyDefectAfternoon: number;
                ctq: string | null;
                usp: string | null;
            }>;
        }>();

        for (const rp of rqcProcesses) {
            const areaName = rp.setupProcess?.setupArea?.masterArea?.area || 'UNKNOWN';
            const processName = rp.setupProcess?.masterProcess?.process || 'UNKNOWN';
            const setupProcessId = rp.setupProcessId.toString();
            const checkingTime = rp.rqcArea?.rqcHeader?.checkingTime || '';
            let isMorning = true;

            const upperTime = checkingTime.toUpperCase();
            if (upperTime.includes('AFTERNOON') || upperTime.includes('SORE')) {
                isMorning = false;
            } else if (upperTime.includes('MORNING') || upperTime.includes('PAGI')) {
                isMorning = true;
            } else {
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
            const areaEntry = areaMap.get(areaName)!;

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
                    // USP name only: the code is an auto number (USP-1792053029691)
                    usp: rp.setupProcess?.masterUsp?.uspName || null,
                });
            }
            const procEntry = areaEntry.processMap.get(processName)!;

            procEntry.totalChecking += qtyChecking;
            if (isMorning) {
                procEntry.qtyCheckingMorning += qtyChecking;
            } else {
                procEntry.qtyCheckingAfternoon += qtyChecking;
            }

            for (const insp of rp.rqcInspections) {
                const defectName = insp.masterDefect?.defect || 'UNKNOWN';
                const qtyDefect = insp.qtyDefect || 0;

                procEntry.totalDefect += qtyDefect;
                if (isMorning) {
                    procEntry.qtyDefectMorning += qtyDefect;
                } else {
                    procEntry.qtyDefectAfternoon += qtyDefect;
                }

                if (!procEntry.defectMap.has(defectName)) {
                    procEntry.defectMap.set(defectName, { defectName, qtyDefect: 0 });
                }
                procEntry.defectMap.get(defectName)!.qtyDefect += qtyDefect;
            }
        }

        // Convert to response shape
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

        let tqcRecords: any[] = [];
        const tqcAreas = [];
        if (filters?.modelId) {
            const masterModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: MODEL_MATCH_SELECT
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions: any = {
                    ...tqcWhereForModel(masterModel),
                    moduleType: 'ASSEMBLY'
                };
                if (filters?.startDate && filters?.endDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
                } else if (filters?.startDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate) };
                } else if (filters?.endDate) {
                    tqcConditions.date = { lte: new Date(filters.endDate) };
                }

                if (filters?.cell) {
                    tqcConditions.cell = filters.cell;
                }

                tqcRecords = await this.prisma.tqcReport.findMany({
                    where: tqcConditions,
                    select: { date: true, time: true, cell: true, building: true, qty: true, qtyDefect: true, qtyChecking: true, defectName: true, moduleType: true, ctqType: true, uspClassification: true }
                });

                // CTQ Type per defect name from Setup Defect TQC (a CTQ Type set on the row wins)
                const normDefect = (n: string) => (n || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const ctqByDefect = new Map((await this.prisma.setupDefectTqc.findMany()).map(m => [normDefect(m.defectName), m.ctqType]));

                const tqcMap = new Map<string, {
                    areaName: string;
                    processMap: Map<string, any>;
                }>();

                for (const tqc of tqcRecords) {
                    // The chart lists only defects with a USP Classification (checking below still uses every row)
                    if (!hasUspClassification(tqc)) continue;
                    const moduleName = tqc.moduleType || 'UNKNOWN TQC';
                    const defectName = tqc.defectName || 'UNKNOWN DEFECT';

                    if (!tqcMap.has(moduleName)) {
                        tqcMap.set(moduleName, { areaName: moduleName, processMap: new Map() });
                    }
                    const modEntry = tqcMap.get(moduleName)!;

                    const timeKey = tqc.time || 'no-time';
                    const cellKey = tqc.cell || tqc.building || 'no-cell';
                    const dateKey = tqc.date ? tqc.date.getTime().toString() : 'no-date';
                    const seqKey = (tqc as any).seq || '';
                    const uniqueKey = `${dateKey}_${cellKey}_${timeKey}_${seqKey}`;

                    if (!modEntry.processMap.has(defectName)) {
                        modEntry.processMap.set(defectName, {
                            processName: defectName,
                            setupProcessId: `tqc-${defectName}`,
                            totalDefect: 0,
                            totalChecking: 0,
                            defectMap: new Map(),
                            uniqueCheckingMap: new Map<string, number>(),
                            uspSet: new Set<string>(),
                            ctqSet: new Set<string>()
                        });
                    }
                    const procEntry = modEntry.processMap.get(defectName)!;
                    if (tqc.uspClassification?.trim()) procEntry.uspSet.add(tqc.uspClassification.trim());
                    const rowCtq = tqc.ctqType?.trim() || ctqByDefect.get(normDefect(defectName));
                    if (rowCtq) procEntry.ctqSet.add(rowCtq);

                    if (!procEntry.uniqueCheckingMap.has(uniqueKey)) {
                        // The user specified checking volume per hour is purely static `120` in their process model. 
                        // We strictly bypass the sometimes polluted `tqc.qty` DB column that incorrectly absorbed QTY PRODUCTION (e.g. 3600).
                        // 120 per hour unless edited (tqc.qty stays bypassed: it absorbed QTY PRODUCTION)
                        procEntry.uniqueCheckingMap.set(uniqueKey, tqc.qtyChecking ?? TQC_CHECK_PER_HOUR);
                    }

                    const qtyD = tqc.qtyDefect || 0;
                    procEntry.totalDefect += qtyD;

                    if (!procEntry.defectMap.has(defectName)) {
                        procEntry.defectMap.set(defectName, { defectName, qtyDefect: 0 });
                    }
                    procEntry.defectMap.get(defectName)!.qtyDefect += qtyD;
                }

                // Pre-calculate Global TQC Total Checking for this model/filter.
                // Standard limit rule: 1 unique cell active in a day = 960 (120 checks * 8 hours).
                const globalTqcUniqueChecks = tqcDayCellChecking(tqcRecords || [], tqc =>
                    `${tqc.date ? tqc.date.toISOString().split('T')[0] : 'no-date'}_${tqc.cell || tqc.building || 'no-cell'}`);
                let globalTqcTotalChecking = 0;
                for (const qty of globalTqcUniqueChecks.values()) globalTqcTotalChecking += qty;

                for (const modEntry of tqcMap.values()) {
                    tqcAreas.push({
                        areaName: modEntry.areaName,
                        processes: Array.from(modEntry.processMap.values()).map(proc => {
                            // User request: use the global modal summary checks denominator for individual process charts too!
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
                        }).sort((a: any, b: any) => b.defectRate - a.defectRate)
                    });
                }
            }
        }

        // --- Calculate Overall Stats for RQC and TQC ---
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

        // Evaluate numerical average of processes (Modal Sync to Daily Chart Tooltip)
        const rqcDefectRate = rqcProcessCount > 0 ? rqcDefectRateSum / rqcProcessCount : 0;
        const rqcPassRate = 100 - rqcDefectRate;

        // Re-eval TQC Total Defect for modal summary overall block:
        let tqcTotalDefect = 0;
        let tqcDefectRateSum = 0;
        let tqcProcessCount = 0;

        if (tqcRecords && tqcRecords.length > 0) {
            for (const tqc of tqcRecords) {
                if (hasUspClassification(tqc)) tqcTotalDefect += (tqc.qtyDefect || 0);
            }
            for (const tArea of tqcAreas) {
                for (const proc of tArea.processes) {
                    tqcDefectRateSum += parseFloat(proc.defectRate.toFixed(2));
                    tqcProcessCount++;
                }
            }
        }

        // Must re-evaluate global checking if modelId wasn't provided or we didn't hit the block above
        let finalTqcTotalChecking = 0;
        if (tqcRecords && tqcRecords.length > 0) {
            const finalTqcUniqueChecks = tqcDayCellChecking(tqcRecords, tqc =>
                `${tqc.date ? tqc.date.toISOString().split('T')[0] : 'no-date'}_${tqc.cell || tqc.building || 'no-cell'}`);
            for (const qty of finalTqcUniqueChecks.values()) finalTqcTotalChecking += qty;
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

    async getImmediateActionData(filters?: { modelId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string, areaName?: string }) {
        let headerConditions: any = {};
        if (filters?.modelId) headerConditions.setupModelId = BigInt(filters.modelId);
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        } else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        } else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
        }
        if (filters?.factoryId) headerConditions.factoryId = BigInt(filters.factoryId);
        if (filters?.cell) headerConditions.cell = filters.cell;

        const processConditions: any = {
            rqcArea: { rqcHeader: headerConditions }
        };

        if (filters?.areaName) { // Allow String-based Area queries (e.g. CUTTING, SEWING)
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

    async getTqcEolSummary(filters?: { modelId?: string, startDate?: string, endDate?: string, cell?: string }) {
        let tqcWhere: any = {};

        if (filters?.modelId) {
            const setupModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) },
                select: MODEL_MATCH_SELECT
            });
            if (setupModel?.modelName) {
                tqcWhere = { ...tqcWhere, ...tqcWhereForModel(setupModel) };
            } else {
                return { cells: [], passRateData: [], averagePassRate: 0, averageDefectRate: 0, topDefects: [], qtyChecking: 0, qtyDefect: 0 };
            }
        }

        if (filters?.startDate && filters?.endDate) {
            tqcWhere.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        } else if (filters?.startDate) {
            tqcWhere.date = { gte: new Date(filters.startDate) };
        } else if (filters?.endDate) {
            tqcWhere.date = { lte: new Date(filters.endDate) };
        }

        // TQC CELLS Extraction (Always fetch irrespective of current cell filter to build tabs)
        // Only consider ASSEMBLY and TREATMENT module types for EOL
        const allTqcRecordsFilterFree = await this.prisma.tqcReport.findMany({
            where: { ...tqcWhere, moduleType: { in: ['ASSEMBLY', 'TREATMENT'] } },
            select: { moduleType: true, cell: true, building: true }
        });

        const uniqueCellsSet = new Set<string>();
        let hasTreatment = false;

        allTqcRecordsFilterFree.forEach((t: any) => {
            if (t.moduleType === 'TREATMENT') hasTreatment = true;
            if (t.moduleType === 'ASSEMBLY') {
                const c = (t.cell || t.building || '').trim().toUpperCase();
                if (c) uniqueCellsSet.add(c);
            }
        });

        const cells = Array.from(uniqueCellsSet).sort();
        const tabs = hasTreatment ? ['TREATMENT', ...cells] : cells;

        // Apply cell filter to the actual data fetch
        if (filters?.cell) {
            if (filters.cell === 'TREATMENT') {
                tqcWhere.moduleType = 'TREATMENT';
            } else {
                tqcWhere.moduleType = 'ASSEMBLY';
                // Try cell OR building to accommodate TQC format
                tqcWhere.OR = [
                    { cell: filters.cell },
                    { building: filters.cell }
                ];
            }
        } else {
            // Default to first tab if no cell is provided
            if (hasTreatment) {
                tqcWhere.moduleType = 'TREATMENT';
            } else if (cells.length > 0) {
                tqcWhere.moduleType = 'ASSEMBLY';
                tqcWhere.OR = [{ cell: cells[0] }, { building: cells[0] }];
            } else {
                tqcWhere.moduleType = 'ASSEMBLY';
            }
        }

        const tqcRecords = await this.prisma.tqcReport.findMany({ where: tqcWhere });

        const dailyMap = new Map<string, {
            uniqueCells: Set<string>;
            totalDefect: number;
        }>();

        const defectMap = new Map<string, number>();
        let overallDefectCount = 0;

        tqcRecords.forEach((t: any) => {
            const dateStr = t.date ? t.date.toISOString().split('T')[0] : 'Unknown';
            const cellVal = (t.cell || t.building || 'no-cell').trim().toUpperCase();
            const defectName = t.defectName || 'UNKNOWN';

            if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { uniqueCells: new Set(), totalDefect: 0 });

            // Every row marks the day/cell as checked, but only CTQ defects (with a USP Classification) count
            const dayObj = dailyMap.get(dateStr)!;
            dayObj.uniqueCells.add(cellVal);
            if (!isCtqTqcDefect(t)) return;

            const defectQty = t.qtyDefect || 0;
            dayObj.totalDefect += defectQty;
            overallDefectCount += defectQty;

            if (!defectMap.has(defectName)) defectMap.set(defectName, 0);
            defectMap.set(defectName, defectMap.get(defectName)! + defectQty);
        });

        const passRateData: any[] = [];
        let globalChecking = 0;
        let sumDailyPassRate = 0;
        let sumDailyDefRate = 0;

        let validDays = 0;

        // 7. QTY CHECKING rule: 960 per day per cell, adjusted by edited hour slots
        const dayCellChecking = tqcDayCellChecking(tqcRecords, (t: any) =>
            `${t.date ? t.date.toISOString().split('T')[0] : 'Unknown'}_${(t.cell || t.building || 'no-cell').trim().toUpperCase()}`);
        Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, stats]) => {
            const dailyChecking = [...stats.uniqueCells].reduce((sum, c) => sum + (dayCellChecking.get(`${date}_${c}`) ?? TQC_CHECK_PER_DAY), 0);
            globalChecking += dailyChecking;

            // 3. PASS RATE PER TANGGAL (QTY CHECKING - QTY DEFECT) / QTY CHECKING
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
                // isoDate lets the page filter the other charts by the clicked day
                isoDate: date,
                date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
                passRate: Math.round((passRate + Number.EPSILON) * 100) / 100,
                defectRate: Math.round((defRate + Number.EPSILON) * 100) / 100,
                qtyChecking: dailyChecking,
                qtyDefect: stats.totalDefect
            });
        });

        // 6. DEFECT RATE TOP DEFECTS
        // Evaluate ALL defects first to calculate the exact sum of the rounded percentages
        const allDefects = Array.from(defectMap.entries()).map(([name, qty]) => {
            const rate = globalChecking > 0 ? (qty / globalChecking) * 100 : 0;
            return {
                name,
                // Not rounded, so the bars add up exactly to the TQC Defect Rate CTQ
                absoluteVal: rate,
                qty
            };
        }).sort((a, b) => b.qty - a.qty);

        // All CTQ defects, so the bars add up to the TQC Defect Rate CTQ (it used to show the top 5 only)
        const topDefects = allDefects;

        // 4 & 5. AVERAGE GRAPHICS
        // The user specifically requested that the middle box uses the global volume formula: Qty Defect / Qty Check
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

    async getCapData(filters?: { modelId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string }) {
        let headerConditions: any = {};
        if (filters?.modelId) headerConditions.setupModelId = BigInt(filters.modelId);
        if (filters?.startDate && filters?.endDate) {
            headerConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        } else if (filters?.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        } else if (filters?.endDate) {
            headerConditions.date = { lte: new Date(filters.endDate) };
        }
        if (filters?.factoryId) headerConditions.factoryId = BigInt(filters.factoryId);
        if (filters?.cell) headerConditions.cell = filters.cell;

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

    async getCtqDetails(filters: { modelId: string, ctqType: string, startDate?: string, endDate?: string }) {
        let headerConditions: any = {
            setupModelId: BigInt(filters.modelId)
        };

        if (filters.startDate && filters.endDate) {
            headerConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
        } else if (filters.startDate) {
            headerConditions.date = { gte: new Date(filters.startDate) };
        } else if (filters.endDate) {
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

        const sellingPointMap = new Map<string, { totalChecking: number, totalDefect: number }>();
        const areaMap = new Map<string, {
            areaName: string,
            processMap: Map<string, { processName: string, uspName: string, isSellingPoint: boolean, totalChecking: number, totalDefect: number }>
        }>();

        // Seed every configured process for this CTQ so processes without input in the date range still show (as 0%)
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
            const areaEntry = areaMap.get(areaName)!;
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

            // Group by USP Name
            if (!sellingPointMap.has(uspName)) {
                sellingPointMap.set(uspName, { totalChecking: 0, totalDefect: 0 });
            }
            const spEntry = sellingPointMap.get(uspName)!;
            spEntry.totalChecking += qtyChecking;
            spEntry.totalDefect += qtyDefect;

            // Group by Area -> Process
            if (!areaMap.has(areaName)) {
                areaMap.set(areaName, { areaName, processMap: new Map() });
            }
            const areaEntry = areaMap.get(areaName)!;

            if (!areaEntry.processMap.has(processName)) {
                areaEntry.processMap.set(processName, { processName, uspName, isSellingPoint, totalChecking: 0, totalDefect: 0 });
            }
            const procEntry = areaEntry.processMap.get(processName)!;
            procEntry.totalChecking += qtyChecking;
            procEntry.totalDefect += qtyDefect;
        }

        const sellingPoints = Array.from(sellingPointMap.entries()).map(([sp, stat]) => {
            const defectRate = stat.totalChecking > 0 ? (stat.totalDefect / stat.totalChecking) * 100 : 0;
            const passRate = stat.totalChecking > 0 ? 100 - defectRate : 0; // if 0 checked, technically 0% pass? Actually if 0 checked it shouldn't mathematically exist, we map it to 0.
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
            }).sort((a, b) => b.defectRate - a.defectRate) // sort highest defect first
        }));

        return this.serializeBigInt({
            uspGroups: sellingPoints,
            areas
        });
    }

    async getDefectCtqSummary(modelIdStr: string, startDate?: string, endDate?: string, cell?: string) {
        const modelId = BigInt(modelIdStr);
        let dateFilterRqc: any = undefined;
        let dateFilterTqc: any = undefined;

        if (startDate || endDate) {
            dateFilterRqc = {};
            dateFilterTqc = {};
            if (startDate) {
                dateFilterRqc.gte = new Date(startDate);
                dateFilterTqc.gte = new Date(startDate);
            }
            if (endDate) {
                dateFilterRqc.lte = new Date(`${endDate}T23:59:59.999Z`);
                // Use Next day for TQC strings or just raw string logic if stored as YYYY-MM-DD
                // Since TQC is 'DD/MM/YYYY' or parsed to Date depending on PR... wait we used Date for TQC too?
                // Let's use raw dates if TQC stores them as Date? Actually TQC dates are stored as DateTime now.
                dateFilterTqc.lte = new Date(`${endDate}T23:59:59.999Z`);
            }
        }

        const rqcWhere: any = { setupModelId: modelId };
        if (dateFilterRqc) rqcWhere.date = dateFilterRqc;
        if (cell) rqcWhere.cell = cell;

        // Fetch the model strictly for linking string names
        const model = await this.prisma.setupModel.findUnique({ where: { setupModelId: modelId }, select: MODEL_MATCH_SELECT });
        if (!model) return { usps: [], rqcData: {}, tqcData: {}, rqcTopProcesses: [], tqcTopDefects: [] };

        const tqcWhere: any = { ...tqcWhereForModel(model, 'equals') };
        if (dateFilterTqc) tqcWhere.date = dateFilterTqc;
        if (cell) tqcWhere.cell = cell;

        // Fetch Setup to map USP
        const setupProcs = await this.prisma.setupProcess.findMany({
            where: { setupArea: { setupModelId: modelId } },
            include: { masterProcess: true, masterUsp: true }
        });
        const processUspMap = new Map<bigint, string>();
        const uspsSet = new Set<string>();

        setupProcs.forEach(p => {
            if (p.masterUsp) {
                const uspName = p.masterUsp.uspName.toUpperCase();
                processUspMap.set(p.setupProcessId, uspName);
                uspsSet.add(uspName);
            }
        });

        // 1. RQC KPI & Charts Base Data
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

        const rqcUspAggregates = new Map<string, { qtyCheck: number, qtyDefect: number }>();
        const rqcProcessAggregates = new Map<string, { qtyCheck: number, qtyDefect: number, uspName: string | null, isSellingPoint: boolean }>();
        // byProcess: qty per process, so clicking a process bar can show just that process's defects
        const rqcDefectNameAggregates = new Map<string, { qtyDefect: number, uspName: string | null, isSellingPoint: boolean, byProcess: Record<string, number> }>();

        rqcHeaders.forEach(header => {
            header.rqcAreas.forEach(area => {
                area.rqcProcesses.forEach(proc => {
                    const procName = setupProcs.find(sp => sp.setupProcessId === proc.setupProcessId)?.masterProcess.process || 'UNKNOWN';
                    const uspName = processUspMap.get(proc.setupProcessId) || null;

                    const isSellingPoint = setupProcs.find(sp => sp.setupProcessId === proc.setupProcessId)?.isSellingPoint || false;

                    const qtyCheck = proc.qtyChecking;
                    let qtyDefect = 0;

                    proc.rqcInspections.forEach((ins: any) => {
                        qtyDefect += ins.qtyDefect;
                        const defectName = ins.masterDefect?.defect || 'UNKNOWN DEFECT';
                        if (!rqcDefectNameAggregates.has(defectName)) {
                            rqcDefectNameAggregates.set(defectName, { qtyDefect: 0, uspName, isSellingPoint: false, byProcess: {} });
                        }
                        const defectAgg = rqcDefectNameAggregates.get(defectName)!;
                        defectAgg.qtyDefect += ins.qtyDefect;
                        defectAgg.isSellingPoint ||= isSellingPoint;
                        defectAgg.byProcess[procName] = (defectAgg.byProcess[procName] || 0) + ins.qtyDefect;
                    });

                    // Add to process aggregation for chart
                    if (!rqcProcessAggregates.has(procName)) {
                        rqcProcessAggregates.set(procName, { qtyCheck: 0, qtyDefect: 0, uspName, isSellingPoint: false });
                    }
                    rqcProcessAggregates.get(procName)!.qtyCheck += qtyCheck;
                    rqcProcessAggregates.get(procName)!.qtyDefect += qtyDefect;
                    rqcProcessAggregates.get(procName)!.isSellingPoint ||= isSellingPoint;

                    // Add to USP aggregation for KPI Boxes
                    if (uspName) {
                        if (!rqcUspAggregates.has(uspName)) {
                            rqcUspAggregates.set(uspName, { qtyCheck: 0, qtyDefect: 0 });
                        }
                        rqcUspAggregates.get(uspName)!.qtyCheck += qtyCheck;
                        rqcUspAggregates.get(uspName)!.qtyDefect += qtyDefect;
                    }
                });
            });
        });

        // 2. TQC Base Data
        const tqcRecords = await this.prisma.tqcReport.findMany({ where: tqcWhere });
        const tqcDefectAggregates = new Map<string, { qtyDefect: number, uspName: string | null }>();
        const tqcUspAggregates = new Map<string, { qtyDefect: number }>();

        // Pre-calculate Global TQC Total Checking (960 per unique day and cell, adjusted by edited hour slots)
        const globalTqcUniqueChecks = new Map<string, number>();
        const tqcDayChecks = tqcDayCellChecking(tqcRecords, (t: any) =>
            `${t.date ? (typeof t.date === 'string' ? new Date(t.date).toISOString().split('T')[0] : t.date.toISOString().split('T')[0]) : 'no-date'}_${t.cell || t.building || 'no-cell'}`);

        tqcRecords.forEach((t: any) => {
            const cellKey = t.cell || t.building || 'no-cell';
            const dateKey = t.date ? (typeof t.date === 'string' ? new Date(t.date).toISOString().split('T')[0] : t.date.toISOString().split('T')[0]) : 'no-date';
            const uniqueDayCellKey = `${dateKey}_${cellKey}`;

            globalTqcUniqueChecks.set(uniqueDayCellKey, tqcDayChecks.get(uniqueDayCellKey) ?? TQC_CHECK_PER_DAY);

            const uspName = t.uspClassification ? t.uspClassification.toUpperCase() : null;
            if (uspName) uspsSet.add(uspName); // Register any TQC USP just in case

            const defName = t.defectName || 'Unmapped';
            const qtyDefect = t.qtyDefect || 0;

            // Add to defect aggregation for Chart (We group TQC by defect name since there's no process)
            if (!tqcDefectAggregates.has(defName)) {
                tqcDefectAggregates.set(defName, { qtyDefect: 0, uspName });
            }
            tqcDefectAggregates.get(defName)!.qtyDefect += qtyDefect;

            // Add to USP aggregation for KPI Boxes
            if (uspName) {
                if (!tqcUspAggregates.has(uspName)) {
                    tqcUspAggregates.set(uspName, { qtyDefect: 0 });
                }
                tqcUspAggregates.get(uspName)!.qtyDefect += qtyDefect;
            }
        });

        let globalTqcTotalChecking = 0;
        for (const qty of globalTqcUniqueChecks.values()) globalTqcTotalChecking += qty;

        const usps = Array.from(uspsSet).sort();

        // Format Output Logic
        const rqcData: any = {};
        const tqcData: any = {};
        const rqcTopProcessesByUsp: any = {};
        const rqcTopDefectsByUsp: any = {};
        const tqcTopDefectsByUsp: any = {};

        usps.forEach(u => {
            // RQC Data Math (Average process pass rate per user request)
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
                const pRate = v.qtyCheck > 0 ? 100 - defRate : 0; // If checked, calculate pass rate

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

            // Unrounded: the page rounds rates to 2 decimals (exact half down, e.g. 2,055 -> 2,05)
            const rqcAvgPassRate = processCount > 0 ? rqcUspsSumPassRate / processCount : 0;
            // Align Defect Rate to calculate based on Average Process Defect Rate instead of strict division
            const rqcAvgDefRate = processCount > 0 ? rqcUspsSumDefRate / processCount : 0;

            rqcData[u] = {
                passRate: processCount > 0 ? rqcAvgPassRate : 100, // Show 100 if no checks yet
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

            // TQC Data Math 
            const defectsForUsp = Array.from(tqcDefectAggregates.entries()).filter(([_, v]) => v.uspName === u);
            let tqcUspsSumCheck = globalTqcTotalChecking;
            let tqcUspsSumDefect = 0;

            const tqcAgg = tqcUspAggregates.get(u);
            if (tqcAgg) {
                tqcUspsSumDefect = tqcAgg.qtyDefect;
            }

            // Unrounded, like RQC above: the page does the rounding
            const tqcAvgDefRate = tqcUspsSumCheck > 0 ? (tqcUspsSumDefect / tqcUspsSumCheck) * 100 : 0;
            const tqcAvgPassRate = tqcUspsSumCheck > 0 ? 100 - tqcAvgDefRate : 100; // TQC calculates usually global

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

    // Utility to serialize BigInts to string for JSON responses
    private serializeBigInt(obj: any): any {
        return JSON.parse(
            JSON.stringify(obj, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            )
        );
    }
}
