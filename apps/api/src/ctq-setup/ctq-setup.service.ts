import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CtqSetupService {
    constructor(private prisma: PrismaService) { }

    async findAllModels() {
        // Only ACTIVE models are returned for auditing
        const models = await this.prisma.setupModel.findMany({
            where: { isActive: true },
            orderBy: { modelName: 'asc' },
        });
        return this.serializeBigInt(models);
    }

    async findSetupByModel(modelId: string) {
        const id = BigInt(modelId);

        const model = await this.prisma.setupModel.findUnique({
            where: { setupModelId: id },
        });
        if (!model) {
            throw new NotFoundException(`Model with ID ${modelId} not found`);
        }

        const tree = await this.prisma.setupArea.findMany({
            where: { setupModelId: id },
            include: {
                masterArea: true,
                setupProcesses: {
                    include: {
                        masterProcess: true,
                        setupDefects: {
                            include: {
                                masterDefect: true,
                            },
                        },
                    },
                },
            },
        });

        return this.serializeBigInt({
            model,
            areas: tree,
        });
    }

    async validatePo(modelId: string, po: string) {
        const id = BigInt(modelId);

        // According to PRD, we validate through model matching policy
        const poRecord = await this.prisma.masterPo.findUnique({
            where: { po },
        });

        if (!poRecord) {
            return { isValid: false, reason: 'PO_NOT_FOUND' };
        }

        // Checking if there is a mapping
        const mapping = await this.prisma.modelPoMapping.findFirst({
            where: {
                setupModelId: id,
                poModelPattern: poRecord.model,
                isActive: true,
            },
        });

        if (!mapping) {
            return { isValid: false, reason: 'MODEL_MISMATCH' };
        }

        return this.serializeBigInt({ isValid: true, po: poRecord, mapping });
    }

    // Builder CRUD methods
    async createModel(data: { modelName: string; isActive?: boolean }) {
        const model = await this.prisma.setupModel.create({
            data: { modelName: data.modelName, isActive: data.isActive ?? true },
        });
        return this.serializeBigInt(model);
    }

    async updateModelPicture(modelId: string, pictureBase64: string) {
        const model = await this.prisma.setupModel.update({
            where: { setupModelId: BigInt(modelId) },
            data: { picture: pictureBase64 },
        });
        return this.serializeBigInt(model);
    }

    async updateModelAuditFile(modelId: string, auditFileBase64: string) {
        const payload: any = { internalAuditFile: auditFileBase64 };
        const model = await this.prisma.setupModel.update({
            where: { setupModelId: BigInt(modelId) },
            data: payload,
        });
        return this.serializeBigInt(model);
    }

    async updateModelName(modelId: string, modelName: string) {
        const model = await this.prisma.setupModel.update({
            where: { setupModelId: BigInt(modelId) },
            data: { modelName: modelName.toUpperCase() },
        });
        return this.serializeBigInt(model);
    }

    async linkAreaToModel(modelId: string, areaId: string) {
        const setupArea = await this.prisma.setupArea.create({
            data: {
                setupModelId: BigInt(modelId),
                areaId: BigInt(areaId),
            },
        });
        return this.serializeBigInt(setupArea);
    }

    async linkProcessToArea(setupAreaId: string, processId: string) {
        const setupProcess = await this.prisma.setupProcess.create({
            data: {
                setupAreaId: BigInt(setupAreaId),
                processId: BigInt(processId),
            },
        });
        return this.serializeBigInt(setupProcess);
    }

    async linkDefectToProcess(setupProcessId: string, defectId: string) {
        const setupDefect = await this.prisma.setupDefect.create({
            data: {
                setupProcessId: BigInt(setupProcessId),
                defectId: BigInt(defectId),
            },
        });
        return this.serializeBigInt(setupDefect);
    }

    async updateSetupProcess(setupProcessId: string, data: { uspId?: string | null; isSellingPoint?: boolean }) {
        const id = BigInt(setupProcessId);

        if (data.uspId) {
            // Validate that the chosen USP actually belongs to the same Model as the SetupProcess
            const setupProc = await this.prisma.setupProcess.findUnique({
                where: { setupProcessId: id },
                include: { setupArea: true }
            });
            if (!setupProc) throw new NotFoundException('Setup Process not found.');

            const usp = await this.prisma.masterUsp.findUnique({
                where: { uspId: BigInt(data.uspId) }
            });
            if (!usp) throw new NotFoundException('Selected USP not found.');

            if (usp.setupModelId !== setupProc.setupArea.setupModelId) {
                throw new Error('Selected USP does not belong to the current Model.');
            }
        }

        const updateData: any = {};
        if (data.uspId !== undefined) {
            updateData.uspId = data.uspId ? BigInt(data.uspId) : null;
        }
        if (data.isSellingPoint !== undefined) {
            updateData.isSellingPoint = data.isSellingPoint;
        }

        const updated = await this.prisma.setupProcess.update({
            where: { setupProcessId: id },
            data: updateData
        });
        return this.serializeBigInt(updated);
    }

    async removeSetupArea(setupAreaId: string) {
        const id = BigInt(setupAreaId);

        const processes = await this.prisma.setupProcess.findMany({ where: { setupAreaId: id } });
        const processIds = processes.map(p => p.setupProcessId);

        if (processIds.length > 0) {
            const rqcProcs = await this.prisma.rqcProcess.findMany({ where: { setupProcessId: { in: processIds } } });
            const rqcProcIds = rqcProcs.map(p => p.rqcProcessId);
            if (rqcProcIds.length > 0) {
                await this.prisma.rqcInspection.deleteMany({ where: { rqcProcessId: { in: rqcProcIds } } });
            }
            await this.prisma.rqcProcess.deleteMany({ where: { setupProcessId: { in: processIds } } });
            await this.prisma.setupDefect.deleteMany({ where: { setupProcessId: { in: processIds } } });
            await this.prisma.setupProcess.deleteMany({ where: { setupAreaId: id } });
        }

        await this.prisma.rqcArea.deleteMany({ where: { setupAreaId: id } });
        return this.prisma.setupArea.delete({ where: { setupAreaId: id } });
    }

    async removeSetupProcess(setupProcessId: string) {
        const id = BigInt(setupProcessId);

        const rqcProcs = await this.prisma.rqcProcess.findMany({ where: { setupProcessId: id } });
        const rqcProcIds = rqcProcs.map(p => p.rqcProcessId);
        if (rqcProcIds.length > 0) {
            await this.prisma.rqcInspection.deleteMany({ where: { rqcProcessId: { in: rqcProcIds } } });
            await this.prisma.rqcProcess.deleteMany({ where: { setupProcessId: id } });
        }

        await this.prisma.setupDefect.deleteMany({ where: { setupProcessId: id } });
        return this.prisma.setupProcess.delete({ where: { setupProcessId: id } });
    }

    async removeSetupDefect(setupDefectId: string) {
        return this.prisma.setupDefect.delete({ where: { setupDefectId: BigInt(setupDefectId) } });
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
