import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHeaderDto, CreateInspectionDto } from './rqc.dto';

@Injectable()
export class RqcService {
    constructor(private prisma: PrismaService) { }

    async createHeader(dto: CreateHeaderDto) {
        // Resolve PO to snapshot data (to satisfy historical integrity requirement)
        const poData = await this.prisma.masterPo.findUnique({
            where: { po: dto.po }
        });

        if (!poData) {
            throw new NotFoundException(`PO ${dto.po} not found in master data.`);
        }

        let resolvedFactoryId: bigint;
        if (dto.factoryId === 'INHOUSE') {
            let inhouseFactory = await this.prisma.masterFactory.findUnique({
                where: { factory: 'INHOUSE' }
            });
            if (!inhouseFactory) {
                inhouseFactory = await this.prisma.masterFactory.create({
                    data: { factory: 'INHOUSE' }
                });
            }
            resolvedFactoryId = inhouseFactory.factoryId;
        } else {
            resolvedFactoryId = BigInt(dto.factoryId);
        }

        const header = await this.prisma.rqcHeader.create({
            data: {
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
    }

    async submitProcessInspection(
        headerId: string,
        setupAreaId: string,
        setupProcessId: string,
        dto: CreateInspectionDto
    ) {
        const areaIdBigInt = BigInt(setupAreaId);
        const processIdBigInt = BigInt(setupProcessId);

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
            const status = defectRate > 0.20 ? 'CAP' : 'IMMEDIATE_ACTION';

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
                rqcAreas: {
                    include: {
                        rqcProcesses: {
                            include: {
                                rqcInspections: true,
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

    async getAllHeaders(filters: { model?: string; modelId?: string; startDate?: string; endDate?: string; checkingTime?: string; inspector?: string; factoryId?: string; cell?: string }) {
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

        const headers = await this.prisma.rqcHeader.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                setupModel: true,
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

    async getDashboardFilterOptions() {
        // Query distinct models that have RQC Headers
        const models = await this.prisma.setupModel.findMany({
            where: { rqcHeaders: { some: {} } },
            select: { setupModelId: true, modelName: true },
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
                where: { setupModelId: BigInt(filters.modelId) }
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions: any = {
                    model: {
                        contains: masterModel.modelName,
                        mode: 'insensitive'
                    },
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
                    select: { date: true, time: true, cell: true, building: true, qty: true, qtyDefect: true }
                });

                const uniqueCheckingMap = new Map<string, number>();
                for (const tqc of tqcRecords) {
                    tqcQtyDefect += (tqc.qtyDefect || 0);

                    const timeKey = tqc.time || 'no-time';
                    const cellKey = tqc.cell || tqc.building || 'no-cell';
                    const dateKey = tqc.date ? tqc.date.getTime().toString() : 'no-date';
                    const uniqueKey = `${dateKey}_${cellKey}_${timeKey}`;

                    if (!uniqueCheckingMap.has(uniqueKey)) {
                        uniqueCheckingMap.set(uniqueKey, 120);
                    }
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
                                        setupModel: true,
                                        factory: true,
                                        inspector: true
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
                namaRqc: header.inspector?.namaUser || '-',
                factoryCell: `${header.factory?.factory || '-'} / ${header.cell || '-'}`,
                model: header.setupModel.modelName,
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

    async getTrends(filters?: { modelId?: string, areaId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string }) {
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

        const processes = await this.prisma.rqcProcess.findMany({
            where: processConditions,
            include: {
                rqcArea: { include: { rqcHeader: true } },
                rqcInspections: { select: { qtyDefect: true } }
            }
        });

        const dailyMap = new Map<string, { checking: number, defect: number, rqcChecking: number, rqcDefect: number }>();
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
                where: { setupModelId: BigInt(filters.modelId) }
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions: any = {
                    model: {
                        contains: masterModel.modelName,
                        mode: 'insensitive'
                    },
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
                    where: tqcConditions
                });

                const uniqueCheckingMap = new Map<string, number>();

                for (const tqc of tqcRecords) {
                    const dateObj = tqc.date;
                    if (!dateObj) continue;
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const weekStr = getWeekStr(dateObj);

                    if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0 });
                    if (!weeklyMap.has(weekStr)) weeklyMap.set(weekStr, { checking: 0, defect: 0 });

                    const dStats = dailyMap.get(dateStr)!;
                    const wStats = weeklyMap.get(weekStr)!;

                    dStats.defect += (tqc.qtyDefect || 0);
                    wStats.defect += (tqc.qtyDefect || 0);

                    const cellKey = tqc.cell || tqc.building || 'no-cell';
                    // Key purely by date and cell (ignoring specific hours like 07.00/08.00)
                    const uniqueDayCellKey = `${dateStr}_${cellKey}`;

                    if (!uniqueCheckingMap.has(uniqueDayCellKey)) {
                        const qtyDiff = 120 * 8; // Standard 8 hours capacity

                        uniqueCheckingMap.set(uniqueDayCellKey, qtyDiff);

                        dStats.checking += qtyDiff;
                        wStats.checking += qtyDiff;
                    }
                }
            }
        }

        for (const p of processes) {
            const dateObj = p.rqcArea.rqcHeader.date;
            if (!dateObj) continue;

            const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const weekStr = getWeekStr(dateObj);

            if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0 });
            if (!weeklyMap.has(weekStr)) weeklyMap.set(weekStr, { checking: 0, defect: 0 });

            const dStats = dailyMap.get(dateStr)!;
            const wStats = weeklyMap.get(weekStr)!;

            const chk = p.qtyChecking || 0;
            const def = p.rqcInspections.reduce((sum, i) => sum + (i.qtyDefect || 0), 0);

            dStats.rqcChecking += chk;
            dStats.rqcDefect += def;

            wStats.checking += chk;
            wStats.defect += def;
        }

        const dailyTrend = Array.from(dailyMap.entries()).map(([date, stats]) => {
            const tqcDefectRate = stats.checking > 0 ? (stats.defect / stats.checking) * 100 : 0;
            const rqcDefectRate = stats.rqcChecking > 0 ? (stats.rqcDefect / stats.rqcChecking) * 100 : 0;
            const passRate = ((100 - tqcDefectRate) + (100 - rqcDefectRate)) / 2;

            return {
                date,
                passRate: Number(passRate.toFixed(2)),
                defectRate: Number(tqcDefectRate.toFixed(2)), // TQC
                defectRateRqc: Number(rqcDefectRate.toFixed(2)) // RQC
            };
        });

        const weeklyTrend = Array.from(weeklyMap.entries()).map(([week, stats]) => {
            const defectRate = stats.checking > 0 ? (stats.defect / stats.checking) * 100 : 0;
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

    async getProcessDefects(filters?: { modelId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string }) {
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
            })).sort((a, b) => b.defectRate - a.defectRate)
        }));

        let tqcRecords: any[] = [];
        const tqcAreas = [];
        if (filters?.modelId) {
            const masterModel = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(filters.modelId) }
            });
            if (masterModel && masterModel.modelName) {
                const tqcConditions: any = {
                    model: { contains: masterModel.modelName, mode: 'insensitive' },
                    moduleType: 'ASSEMBLY'
                };
                if (filters?.startDate && filters?.endDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
                } else if (filters?.startDate) {
                    tqcConditions.date = { gte: new Date(filters.startDate) };
                } else if (filters?.endDate) {
                    tqcConditions.date = { lte: new Date(filters.endDate) };
                }

                tqcRecords = await this.prisma.tqcReport.findMany({
                    where: tqcConditions,
                    select: { date: true, time: true, cell: true, building: true, qty: true, qtyDefect: true, defectName: true, moduleType: true }
                });

                const tqcMap = new Map<string, {
                    areaName: string;
                    processMap: Map<string, any>;
                }>();

                for (const tqc of tqcRecords) {
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
                            uniqueCheckingMap: new Map<string, number>()
                        });
                    }
                    const procEntry = modEntry.processMap.get(defectName)!;

                    if (!procEntry.uniqueCheckingMap.has(uniqueKey)) {
                        // The user specified checking volume per hour is purely static `120` in their process model. 
                        // We strictly bypass the sometimes polluted `tqc.qty` DB column that incorrectly absorbed QTY PRODUCTION (e.g. 3600).
                        procEntry.uniqueCheckingMap.set(uniqueKey, 120);
                    }

                    const qtyD = tqc.qtyDefect || 0;
                    procEntry.totalDefect += qtyD;

                    if (!procEntry.defectMap.has(defectName)) {
                        procEntry.defectMap.set(defectName, { defectName, qtyDefect: 0 });
                    }
                    procEntry.defectMap.get(defectName)!.qtyDefect += qtyD;
                }

                // Pre-calculate Global TQC Total Checking for this model/filter.
                // As defined by standard, 1 day = 8 hours * 120 qty check/hour = 960 checking qty per cell per day.
                const globalTqcUniqueChecks = new Map<string, number>();
                if (tqcRecords && tqcRecords.length > 0) {
                    for (const tqc of tqcRecords) {
                        const cellKey = tqc.cell || tqc.building || 'no-cell';
                        const dateKey = tqc.date ? tqc.date.getTime().toString() : 'no-date';
                        const uniqueDayCellKey = `${dateKey}_${cellKey}`;
                        globalTqcUniqueChecks.set(uniqueDayCellKey, 120 * 8);
                    }
                }
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
                                qtyCheckingMorning: 0, qtyCheckingAfternoon: 0, qtyDefectMorning: 0, qtyDefectAfternoon: 0
                            };
                        }).sort((a: any, b: any) => b.defectRate - a.defectRate)
                    });
                }
            }
        }

        // --- Calculate Overall Stats for RQC and TQC ---
        let rqcTotalDefect = 0;
        let rqcTotalChecking = 0;
        for (const area of areas) {
            for (const proc of area.processes) {
                rqcTotalDefect += proc.totalDefect;
                rqcTotalChecking += proc.totalChecking;
            }
        }
        const rqcDefectRate = rqcTotalChecking > 0 ? (rqcTotalDefect / rqcTotalChecking) * 100 : 0;
        const rqcPassRate = 100 - rqcDefectRate;

        // Re-eval TQC Total Defect for modal summary overall block:
        let tqcTotalDefect = 0;
        if (tqcRecords && tqcRecords.length > 0) {
            for (const tqc of tqcRecords) {
                tqcTotalDefect += (tqc.qtyDefect || 0);
            }
        }

        // Must re-evaluate global checking if modelId wasn't provided or we didn't hit the block above
        let finalTqcTotalChecking = 0;
        if (tqcRecords && tqcRecords.length > 0) {
            const finalTqcUniqueChecks = new Map<string, number>();
            for (const tqc of tqcRecords) {
                const cellKey = tqc.cell || tqc.building || 'no-cell';
                const dateKey = tqc.date ? tqc.date.getTime().toString() : 'no-date';
                const uniqueDayCellKey = `${dateKey}_${cellKey}`;
                finalTqcUniqueChecks.set(uniqueDayCellKey, 120 * 8);
            }
            for (const qty of finalTqcUniqueChecks.values()) finalTqcTotalChecking += qty;
        }

        const tqcDefectRate = finalTqcTotalChecking > 0 ? (tqcTotalDefect / finalTqcTotalChecking) * 100 : 0;
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
                        setupArea: { include: { masterArea: true } }
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
            processMap: Map<string, { processName: string, sellingPoint: string, totalChecking: number, totalDefect: number }>
        }>();

        for (const rp of rqcProcesses) {
            const areaName = rp.setupProcess?.setupArea?.masterArea?.area || 'UNKNOWN';
            const processName = rp.setupProcess?.masterProcess?.process || 'UNKNOWN';
            const sellingPoint = rp.setupProcess?.masterProcess?.sellingPoint || '-';
            const qtyChecking = rp.qtyChecking || 0;
            const qtyDefect = rp.rqcInspections.reduce((sum, insp) => sum + (insp.qtyDefect || 0), 0);

            // Group by Selling Point
            if (!sellingPointMap.has(sellingPoint)) {
                sellingPointMap.set(sellingPoint, { totalChecking: 0, totalDefect: 0 });
            }
            const spEntry = sellingPointMap.get(sellingPoint)!;
            spEntry.totalChecking += qtyChecking;
            spEntry.totalDefect += qtyDefect;

            // Group by Area -> Process
            if (!areaMap.has(areaName)) {
                areaMap.set(areaName, { areaName, processMap: new Map() });
            }
            const areaEntry = areaMap.get(areaName)!;

            if (!areaEntry.processMap.has(processName)) {
                areaEntry.processMap.set(processName, { processName, sellingPoint, totalChecking: 0, totalDefect: 0 });
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
                defectRate
            };
        });

        const areas = Array.from(areaMap.values()).map(area => ({
            areaName: area.areaName,
            processes: Array.from(area.processMap.values()).map(proc => {
                const defectRate = proc.totalChecking > 0 ? (proc.totalDefect / proc.totalChecking) * 100 : 0;
                const passRate = proc.totalChecking > 0 ? 100 - defectRate : 0;
                return {
                    processName: proc.processName,
                    sellingPoint: proc.sellingPoint,
                    passRate,
                    defectRate
                };
            }).sort((a, b) => b.defectRate - a.defectRate) // sort highest defect first
        }));

        return this.serializeBigInt({
            sellingPoints,
            areas
        });
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
