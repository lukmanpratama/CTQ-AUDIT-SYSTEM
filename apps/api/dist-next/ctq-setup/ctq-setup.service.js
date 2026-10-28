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
exports.CtqSetupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const model_match_1 = require("../common/model-match");
const MODEL_LIST_SELECT = {
    setupModelId: true,
    modelName: true,
    modelNo: true,
    isActive: true,
    articles: { select: { article: true }, orderBy: { article: 'asc' } },
};
const FILE_EXTENSIONS = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};
let CtqSetupService = class CtqSetupService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllModels() {
        const models = await this.prisma.setupModel.findMany({
            where: { isActive: true },
            orderBy: [{ modelName: 'asc' }, { modelNo: 'asc' }],
            select: MODEL_LIST_SELECT,
        });
        return this.serializeBigInt(await this.withFileUrls(models));
    }
    async findSetupByModel(modelId) {
        const id = BigInt(modelId);
        const model = await this.prisma.setupModel.findUnique({
            where: { setupModelId: id },
            select: MODEL_LIST_SELECT,
        });
        if (!model) {
            throw new common_1.NotFoundException(`Model with ID ${modelId} not found`);
        }
        const [modelWithUrls] = await this.withFileUrls([model]);
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
            model: modelWithUrls,
            areas: tree,
        });
    }
    async withFileUrls(models) {
        if (models.length === 0)
            return [];
        const sizes = await this.prisma.$queryRaw `
            SELECT setup_model_id AS id, pg_column_size(picture) AS picture, pg_column_size(internal_audit_file) AS audit
            FROM setup_model WHERE setup_model_id = ANY(${models.map(m => m.setupModelId)}::bigint[])`;
        const byId = new Map(sizes.map(s => [String(s.id), s]));
        return models.map(m => {
            const s = byId.get(String(m.setupModelId));
            const base = `/api/ctq-setup/models/${m.setupModelId}`;
            return {
                ...m,
                picture: s?.picture ? `${base}/picture?v=${s.picture}` : null,
                internalAuditFile: s?.audit ? `${base}/audit-file?v=${s.audit}` : null,
            };
        });
    }
    async getModelFile(modelId, kind) {
        const model = await this.prisma.setupModel.findUnique({
            where: { setupModelId: BigInt(modelId) },
            select: { modelName: true, modelNo: true, picture: kind === 'picture', internalAuditFile: kind === 'internalAuditFile' },
        });
        const stored = model?.[kind];
        if (!model || !stored)
            throw new common_1.NotFoundException(`Model ${modelId} has no ${kind === 'picture' ? 'picture' : 'internal audit file'}`);
        const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(stored);
        if (!match)
            return { redirect: stored };
        const mime = match[1] || 'application/octet-stream';
        const body = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
        const ext = FILE_EXTENSIONS[mime] || '';
        const fileName = `${kind === 'picture' ? 'Model' : 'Audit'}_${model.modelName}${model.modelNo ? `_${model.modelNo}` : ''}${ext}`;
        return { mime, body, fileName };
    }
    async validatePo(modelId, po) {
        const id = BigInt(modelId);
        const poRecord = await this.prisma.masterPo.findUnique({
            where: { po },
        });
        if (!poRecord) {
            return { isValid: false, reason: 'PO_NOT_FOUND' };
        }
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
    async createModel(data) {
        const modelName = data.modelName.trim().toUpperCase();
        const modelNo = (data.modelNo ?? '').trim().toUpperCase() || null;
        if (!modelName)
            throw new common_1.BadRequestException('Model Name is required.');
        const articles = (0, model_match_1.parseArticles)(data.articles);
        if (modelNo)
            await this.assertModelNoFree(modelNo);
        await this.assertArticlesFree(articles);
        const model = await this.prisma.setupModel.create({
            data: {
                modelName,
                modelNo,
                isActive: data.isActive ?? true,
                articles: { create: articles.map(article => ({ article })) },
            },
            include: { articles: true },
        });
        return this.serializeBigInt(model);
    }
    async updateModel(modelId, data) {
        const id = BigInt(modelId);
        const update = {};
        if (data.modelName !== undefined) {
            update.modelName = data.modelName.trim().toUpperCase();
            if (!update.modelName)
                throw new common_1.BadRequestException('Model Name cannot be empty.');
        }
        if (data.modelNo !== undefined) {
            update.modelNo = data.modelNo.trim().toUpperCase() || null;
            if (update.modelNo)
                await this.assertModelNoFree(update.modelNo, id);
        }
        const articles = data.articles !== undefined ? (0, model_match_1.parseArticles)(data.articles) : undefined;
        if (articles)
            await this.assertArticlesFree(articles, id);
        const model = await this.prisma.$transaction(async (tx) => {
            if (articles) {
                await tx.setupModelArticle.deleteMany({ where: { setupModelId: id } });
                if (articles.length > 0) {
                    await tx.setupModelArticle.createMany({ data: articles.map(article => ({ setupModelId: id, article })) });
                }
            }
            return tx.setupModel.update({ where: { setupModelId: id }, data: update, select: MODEL_LIST_SELECT });
        });
        return this.serializeBigInt(model);
    }
    async assertModelNoFree(modelNo, exceptModelId) {
        const existing = await this.prisma.setupModel.findUnique({ where: { modelNo }, select: { setupModelId: true, modelName: true } });
        if (existing && existing.setupModelId !== exceptModelId) {
            throw new common_1.ConflictException(`Model No ${modelNo} is already used by ${existing.modelName}.`);
        }
    }
    async assertArticlesFree(articles, exceptModelId) {
        if (articles.length === 0)
            return;
        const taken = await this.prisma.setupModelArticle.findMany({
            where: { article: { in: articles }, ...(exceptModelId ? { setupModelId: { not: exceptModelId } } : {}) },
            include: { setupModel: { select: { modelName: true, modelNo: true } } },
        });
        if (taken.length > 0) {
            const list = taken.map(t => `${t.article} (${(0, model_match_1.modelLabel)(t.setupModel)})`).join(', ');
            throw new common_1.ConflictException(`These articles already belong to another Model No: ${list}.`);
        }
    }
    async updateModelPicture(modelId, pictureBase64) {
        const model = await this.prisma.setupModel.update({
            where: { setupModelId: BigInt(modelId) },
            data: { picture: pictureBase64 },
            select: MODEL_LIST_SELECT,
        });
        return this.serializeBigInt((await this.withFileUrls([model]))[0]);
    }
    async updateModelAuditFile(modelId, auditFileBase64) {
        const payload = { internalAuditFile: auditFileBase64 };
        const model = await this.prisma.setupModel.update({
            where: { setupModelId: BigInt(modelId) },
            data: payload,
            select: MODEL_LIST_SELECT,
        });
        return this.serializeBigInt((await this.withFileUrls([model]))[0]);
    }
    async linkAreaToModel(modelId, areaId) {
        const setupArea = await this.prisma.setupArea.create({
            data: {
                setupModelId: BigInt(modelId),
                areaId: BigInt(areaId),
            },
        });
        return this.serializeBigInt(setupArea);
    }
    async linkProcessToArea(setupAreaId, processId) {
        const setupProcess = await this.prisma.setupProcess.create({
            data: {
                setupAreaId: BigInt(setupAreaId),
                processId: BigInt(processId),
            },
        });
        return this.serializeBigInt(setupProcess);
    }
    async linkDefectToProcess(setupProcessId, defectId) {
        const setupDefect = await this.prisma.setupDefect.create({
            data: {
                setupProcessId: BigInt(setupProcessId),
                defectId: BigInt(defectId),
            },
        });
        return this.serializeBigInt(setupDefect);
    }
    async updateSetupProcess(setupProcessId, data) {
        const id = BigInt(setupProcessId);
        if (data.uspId) {
            const setupProc = await this.prisma.setupProcess.findUnique({
                where: { setupProcessId: id },
                include: { setupArea: true }
            });
            if (!setupProc)
                throw new common_1.NotFoundException('Setup Process not found.');
            const usp = await this.prisma.masterUsp.findUnique({
                where: { uspId: BigInt(data.uspId) }
            });
            if (!usp)
                throw new common_1.NotFoundException('Selected USP not found.');
            if (usp.setupModelId !== setupProc.setupArea.setupModelId) {
                throw new Error('Selected USP does not belong to the current Model.');
            }
        }
        const updateData = {};
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
    async removeSetupArea(setupAreaId) {
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
    async removeSetupProcess(setupProcessId) {
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
    async removeSetupDefect(setupDefectId) {
        return this.prisma.setupDefect.delete({ where: { setupDefectId: BigInt(setupDefectId) } });
    }
    serializeBigInt(obj) {
        return JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));
    }
};
exports.CtqSetupService = CtqSetupService;
exports.CtqSetupService = CtqSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CtqSetupService);
//# sourceMappingURL=ctq-setup.service.js.map