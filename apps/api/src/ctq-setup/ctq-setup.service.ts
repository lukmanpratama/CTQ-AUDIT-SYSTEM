import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { modelLabel, parseArticles } from '../common/model-match';

// Model columns for lists: picture / internalAuditFile are replaced by file URLs (see withFileUrls)
const MODEL_LIST_SELECT = {
    setupModelId: true,
    modelName: true,
    modelNo: true,
    isActive: true,
    articles: { select: { article: true }, orderBy: { article: 'asc' } },
    // Shown and edited in the USP column of the Setup CTQ models table
    masterUsps: { select: { uspId: true, uspName: true, isActive: true }, orderBy: { uspId: 'asc' } },
} satisfies Prisma.SetupModelSelect;

/** USP names as typed: trimmed, inner spaces collapsed, blanks and repeats (any case) dropped. */
function parseUspNames(names: string[]) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
        const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
        if (!name) continue;
        if (name.length > 150) throw new BadRequestException(`USP name is too long (max 150): ${name.slice(0, 40)}...`);
        const key = name.toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
    }
    return out;
}

const FILE_EXTENSIONS: Record<string, string> = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

@Injectable()
export class CtqSetupService {
    constructor(private prisma: PrismaService) { }

    async findAllModels() {
        // Only ACTIVE models are returned for auditing
        const models = await this.prisma.setupModel.findMany({
            where: { isActive: true },
            orderBy: [{ modelName: 'asc' }, { modelNo: 'asc' }],
            select: MODEL_LIST_SELECT,
        });
        return this.serializeBigInt(await this.withFileUrls(models));
    }

    async findSetupByModel(modelId: string) {
        const id = BigInt(modelId);

        const model = await this.prisma.setupModel.findUnique({
            where: { setupModelId: id },
            select: MODEL_LIST_SELECT,
        });
        if (!model) {
            throw new NotFoundException(`Model with ID ${modelId} not found`);
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

    /**
     * `picture` / `internalAuditFile` are stored as base64 data URLs of up to several MB each.
     * Lists send a URL to the file instead, so the blob is downloaded once (and cached) only
     * where it is actually shown. The `v` param changes when the stored file changes.
     */
    private async withFileUrls<T extends { setupModelId: bigint }>(models: T[]) {
        if (models.length === 0) return [];
        const sizes = await this.prisma.$queryRaw<{ id: bigint; picture: number | null; audit: number | null }[]>`
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

    /** A stored model file (picture or internal audit file) decoded from its base64 data URL. */
    async getModelFile(modelId: string, kind: 'picture' | 'internalAuditFile') {
        const model = await this.prisma.setupModel.findUnique({
            where: { setupModelId: BigInt(modelId) },
            // Only the requested blob
            select: { modelName: true, modelNo: true, picture: kind === 'picture', internalAuditFile: kind === 'internalAuditFile' },
        });
        const stored = model?.[kind];
        if (!model || !stored) throw new NotFoundException(`Model ${modelId} has no ${kind === 'picture' ? 'picture' : 'internal audit file'}`);

        // Older rows may hold a plain URL instead of a data URL
        const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(stored);
        if (!match) return { redirect: stored };
        const mime = match[1] || 'application/octet-stream';
        const body = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
        const ext = FILE_EXTENSIONS[mime] || '';
        const fileName = `${kind === 'picture' ? 'Model' : 'Audit'}_${model.modelName}${model.modelNo ? `_${model.modelNo}` : ''}${ext}`;
        return { mime, body, fileName };
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
    async createModel(data: { modelName: string; modelNo?: string; articles?: string[]; isActive?: boolean }) {
        const modelName = data.modelName.trim().toUpperCase();
        // Model No and articles are optional; an empty Model No is stored as NULL
        const modelNo = (data.modelNo ?? '').trim().toUpperCase() || null;
        if (!modelName) throw new BadRequestException('Model Name is required.');
        const articles = parseArticles(data.articles);

        if (modelNo) await this.assertModelNoFree(modelNo);
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

    async updateModel(modelId: string, data: { modelName?: string; modelNo?: string; articles?: string[]; usps?: string[] }) {
        const id = BigInt(modelId);
        const update: { modelName?: string; modelNo?: string | null } = {};
        if (data.modelName !== undefined) {
            update.modelName = data.modelName.trim().toUpperCase();
            if (!update.modelName) throw new BadRequestException('Model Name cannot be empty.');
        }
        if (data.modelNo !== undefined) {
            // An empty value clears the Model No
            update.modelNo = data.modelNo.trim().toUpperCase() || null;
            if (update.modelNo) await this.assertModelNoFree(update.modelNo, id);
        }
        const articles = data.articles !== undefined ? parseArticles(data.articles) : undefined;
        if (articles) await this.assertArticlesFree(articles, id);
        const usps = data.usps !== undefined ? parseUspNames(data.usps) : undefined;

        const model = await this.prisma.$transaction(async (tx) => {
            if (articles) {
                await tx.setupModelArticle.deleteMany({ where: { setupModelId: id } });
                if (articles.length > 0) {
                    await tx.setupModelArticle.createMany({ data: articles.map(article => ({ setupModelId: id, article })) });
                }
            }
            if (usps) await this.syncUsps(tx, id, usps);
            return tx.setupModel.update({ where: { setupModelId: id }, data: update, select: MODEL_LIST_SELECT });
        });
        return this.serializeBigInt(model);
    }

    /**
     * Makes the model's USPs match `names` (compared without case): adds the missing ones and
     * deletes the rest. Processes grouped under a deleted USP lose that grouping. Existing USPs
     * keep their id, code and active status, so a name that stays listed is left untouched.
     */
    private async syncUsps(tx: Prisma.TransactionClient, setupModelId: bigint, names: string[]) {
        const existing = await tx.masterUsp.findMany({ where: { setupModelId }, select: { uspId: true, uspName: true } });
        const wanted = new Set(names.map(n => n.toUpperCase()));
        const have = new Set(existing.map(u => u.uspName.trim().toUpperCase()));

        const removeIds = existing.filter(u => !wanted.has(u.uspName.trim().toUpperCase())).map(u => u.uspId);
        if (removeIds.length > 0) {
            await tx.setupProcess.updateMany({ where: { uspId: { in: removeIds } }, data: { uspId: null } });
            await tx.masterUsp.deleteMany({ where: { uspId: { in: removeIds } } });
        }

        const add = names.filter(n => !have.has(n.toUpperCase()));
        if (add.length > 0) {
            // Codes are unique per model and nothing shows them, so they only need to differ
            const stamp = Date.now();
            await tx.masterUsp.createMany({
                data: add.map((uspName, i) => ({ setupModelId, uspName, uspCode: `USP-${stamp}-${i + 1}`, isActive: true })),
            });
        }
    }

    private async assertModelNoFree(modelNo: string, exceptModelId?: bigint) {
        const existing = await this.prisma.setupModel.findUnique({ where: { modelNo }, select: { setupModelId: true, modelName: true } });
        if (existing && existing.setupModelId !== exceptModelId) {
            throw new ConflictException(`Model No ${modelNo} is already used by ${existing.modelName}.`);
        }
    }

    private async assertArticlesFree(articles: string[], exceptModelId?: bigint) {
        if (articles.length === 0) return;
        const taken = await this.prisma.setupModelArticle.findMany({
            where: { article: { in: articles }, ...(exceptModelId ? { setupModelId: { not: exceptModelId } } : {}) },
            include: { setupModel: { select: { modelName: true, modelNo: true } } },
        });
        if (taken.length > 0) {
            const list = taken.map(t => `${t.article} (${modelLabel(t.setupModel)})`).join(', ');
            throw new ConflictException(`These articles already belong to another Model No: ${list}.`);
        }
    }

    async updateModelPicture(modelId: string, pictureBase64: string) {
        const model = await this.prisma.setupModel.update({
            where: { setupModelId: BigInt(modelId) },
            data: { picture: pictureBase64 },
            select: MODEL_LIST_SELECT,
        });
        return this.serializeBigInt((await this.withFileUrls([model]))[0]);
    }

    async updateModelAuditFile(modelId: string, auditFileBase64: string) {
        const payload: any = { internalAuditFile: auditFileBase64 };
        const model = await this.prisma.setupModel.update({
            where: { setupModelId: BigInt(modelId) },
            data: payload,
            select: MODEL_LIST_SELECT,
        });
        return this.serializeBigInt((await this.withFileUrls([model]))[0]);
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

    async updateSetupProcess(setupProcessId: string, data: { uspId?: string | null; isSellingPoint?: boolean; ctq?: string | null; riskLevel?: string | null }) {
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
        // Per model: the same master process can have another CTQ / risk level in another model
        if (data.ctq !== undefined) updateData.ctq = data.ctq || null;
        if (data.riskLevel !== undefined) updateData.riskLevel = data.riskLevel || null;

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

    /**
     * Deletes a model with its own setup (areas / processes / defects, USPs, PO mappings, articles).
     * Refused once inspections exist for it: those reports point at the model and its setup.
     */
    async deleteModel(modelId: string) {
        const id = BigInt(modelId);
        const model = await this.prisma.setupModel.findUnique({
            where: { setupModelId: id },
            select: { modelName: true, modelNo: true, _count: { select: { rqcHeaders: true } } },
        });
        if (!model) throw new NotFoundException('Model not found.');
        if (model._count.rqcHeaders > 0) {
            throw new ConflictException(
                `${modelLabel(model)} cannot be deleted: it has ${model._count.rqcHeaders} inspection report(s).`,
            );
        }

        try {
            await this.prisma.$transaction(async (tx) => {
                const areas = await tx.setupArea.findMany({ where: { setupModelId: id }, select: { setupAreaId: true } });
                const areaIds = areas.map(a => a.setupAreaId);
                const processes = await tx.setupProcess.findMany({ where: { setupAreaId: { in: areaIds } }, select: { setupProcessId: true } });
                const processIds = processes.map(p => p.setupProcessId);

                await tx.setupDefect.deleteMany({ where: { setupProcessId: { in: processIds } } });
                await tx.setupProcess.deleteMany({ where: { setupProcessId: { in: processIds } } });
                await tx.setupArea.deleteMany({ where: { setupModelId: id } });
                await tx.masterUsp.deleteMany({ where: { setupModelId: id } });
                await tx.modelPoMapping.deleteMany({ where: { setupModelId: id } });
                // Articles go with the model (onDelete: Cascade)
                await tx.setupModel.delete({ where: { setupModelId: id } });
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                throw new ConflictException(`${modelLabel(model)} cannot be deleted: other records still refer to it.`);
            }
            throw e;
        }
        return { deleted: true, setupModelId: modelId };
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
