"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const argon2 = __importStar(require("argon2"));
const model_match_1 = require("../common/model-match");
let MasterService = class MasterService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllAreas() { return this.prisma.masterArea.findMany({ orderBy: { areaId: 'asc' } }); }
    async createArea(data) { return this.prisma.masterArea.create({ data }); }
    async updateArea(areaId, data) { return this.prisma.masterArea.update({ where: { areaId }, data }); }
    async deleteArea(areaId) {
        try {
            return await this.prisma.masterArea.delete({ where: { areaId } });
        }
        catch (e) {
            throw new common_1.BadRequestException('Cannot delete area; it might be in use within CTQ configurations.');
        }
    }
    async findAllProcesses() { return this.prisma.masterProcess.findMany({ orderBy: { processId: 'asc' } }); }
    async createProcess(data) { return this.prisma.masterProcess.create({ data }); }
    async updateProcess(processId, data) { return this.prisma.masterProcess.update({ where: { processId }, data }); }
    async deleteProcess(processId) {
        try {
            return await this.prisma.masterProcess.delete({ where: { processId } });
        }
        catch (e) {
            throw new common_1.BadRequestException('Cannot delete process; it might be in use.');
        }
    }
    async findAllDefects() { return this.prisma.masterDefect.findMany({ orderBy: { defectId: 'asc' } }); }
    async createDefect(data) { return this.prisma.masterDefect.create({ data }); }
    async updateDefect(defectId, data) { return this.prisma.masterDefect.update({ where: { defectId }, data }); }
    async deleteDefect(defectId) {
        try {
            return await this.prisma.masterDefect.delete({ where: { defectId } });
        }
        catch (e) {
            throw new common_1.BadRequestException('Cannot delete defect; it might be in use.');
        }
    }
    async findAllFactories() {
        const factories = await this.prisma.masterFactory.findMany({ orderBy: { factoryId: 'asc' } });
        const needed = ['Factory 1', 'Factory 2', 'Factory 3', 'Factory 4'];
        const existingNames = factories.map(f => f.factory.toLowerCase());
        let added = false;
        for (const name of needed) {
            if (!existingNames.includes(name.toLowerCase())) {
                await this.prisma.masterFactory.create({ data: { factory: name } });
                added = true;
            }
        }
        if (added) {
            return this.prisma.masterFactory.findMany({ orderBy: { factoryId: 'asc' } });
        }
        return factories;
    }
    async createFactory(data) { return this.prisma.masterFactory.create({ data }); }
    buildModelLikeWhere(modelLike) {
        if (!modelLike)
            return undefined;
        return (0, model_match_1.modelNameContainsWhere)(modelLike);
    }
    async findAllPos(modelLike, setupModelId) {
        if (setupModelId) {
            const model = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(setupModelId) },
                select: { modelName: true, articles: { select: { article: true } } }
            });
            if (!model)
                return [];
            return this.prisma.masterPo.findMany({ where: (0, model_match_1.poWhereForModel)(model), orderBy: { po: 'desc' } });
        }
        return this.prisma.masterPo.findMany({
            where: this.buildModelLikeWhere(modelLike),
            orderBy: { po: 'desc' }
        });
    }
    searchWords(text) {
        return (text || '').split(/\s+/).map(w => w.trim()).filter(w => w.length > 0);
    }
    buildPoWhere(filters, except) {
        const and = [];
        for (const word of this.searchWords(filters.q)) {
            and.push({
                OR: ['po', 'article', 'model', 'destination'].map(field => ({
                    [field]: { contains: word, mode: 'insensitive' },
                })),
            });
        }
        for (const field of ['po', 'article', 'model', 'destination']) {
            if (field !== except && filters[field])
                and.push({ [field]: filters[field] });
        }
        return and.length ? { AND: and } : undefined;
    }
    async findPoFilterOptions(field, search, filters) {
        const allowed = ['po', 'article', 'model', 'destination'];
        if (!allowed.includes(field))
            throw new common_1.BadRequestException(`Unknown filter field "${field}".`);
        const col = field;
        const and = [];
        const base = this.buildPoWhere(filters, col);
        if (base)
            and.push(base);
        if (col === 'destination')
            and.push({ destination: { not: null } });
        for (const word of this.searchWords(search))
            and.push({ [col]: { contains: word, mode: 'insensitive' } });
        const LIMIT = 200;
        const groups = await this.prisma.masterPo.groupBy({
            by: [col],
            where: { AND: and },
            _count: { _all: true },
            orderBy: { [col]: col === 'po' ? 'desc' : 'asc' },
            take: LIMIT + 1,
        });
        return {
            options: groups.slice(0, LIMIT).map(g => ({ value: g[col], count: g._count._all })),
            truncated: groups.length > LIMIT,
        };
    }
    async findPosPaged(page = 1, limit = 100, filters = {}) {
        const take = Math.min(Math.max(limit || 100, 1), 500);
        const currentPage = Math.max(page || 1, 1);
        const where = this.buildPoWhere(filters);
        const [data, total] = await this.prisma.$transaction([
            this.prisma.masterPo.findMany({
                where,
                orderBy: { po: 'desc' },
                skip: (currentPage - 1) * take,
                take
            }),
            this.prisma.masterPo.count({ where })
        ]);
        return { data, total, page: currentPage, limit: take };
    }
    async createPo(data) {
        const po = data.po.trim();
        if (!po)
            throw new common_1.BadRequestException('PO Number is required.');
        const existing = await this.prisma.masterPo.findUnique({ where: { po }, select: { po: true } });
        if (existing)
            throw new common_1.ConflictException(`PO ${po} already exists. Search for it and use Edit to change it.`);
        return this.prisma.masterPo.create({
            data: { ...data, po, article: data.article.trim(), model: data.model.trim(), destination: data.destination?.trim() || null },
        });
    }
    async bulkCreatePos(data) {
        const chunkSize = 50;
        let processed = 0;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await this.prisma.$transaction(chunk.map(poData => this.prisma.masterPo.upsert({
                where: { po: poData.po },
                update: { article: poData.article, model: poData.model, qtyOrder: Number(poData.qtyOrder), destination: poData.destination },
                create: { po: poData.po, article: poData.article, model: poData.model, qtyOrder: Number(poData.qtyOrder), destination: poData.destination }
            })));
            processed += chunk.length;
        }
        return { success: true, processed };
    }
    async updatePo(po, data) {
        const existing = await this.prisma.masterPo.findUnique({ where: { po }, select: { po: true } });
        if (!existing)
            throw new common_1.NotFoundException(`PO ${po} not found.`);
        return this.prisma.masterPo.update({ where: { po }, data });
    }
    async deletePo(po) {
        try {
            return await this.prisma.masterPo.delete({ where: { po } });
        }
        catch (e) {
            throw new common_1.BadRequestException('Cannot delete PO; it may be tied to existing RQC transactions.');
        }
    }
    async deleteAllPos() {
        try {
            const res = await this.prisma.masterPo.deleteMany({});
            return { message: 'All POs deleted successfully', deletedCount: res.count };
        }
        catch (e) {
            throw new common_1.BadRequestException('Cannot delete all POs; some may be tied to existing RQC transactions.');
        }
    }
    async findAllUsers() { return this.prisma.masterUser.findMany({ select: { nik: true, namaUser: true, role: true, isActive: true }, orderBy: { nik: 'asc' } }); }
    async createUser(data) {
        const passwordHash = data.password ? await argon2.hash(data.password) : await argon2.hash('123456');
        return this.prisma.masterUser.create({ data: { nik: data.nik, namaUser: data.namaUser, passwordHash, role: data.role || 'RQC' }, select: { nik: true, namaUser: true, role: true, isActive: true } });
    }
    async updateUser(nik, data) {
        const updateData = { namaUser: data.namaUser, role: data.role, isActive: data.isActive };
        if (data.password)
            updateData.passwordHash = await argon2.hash(data.password);
        return this.prisma.masterUser.update({ where: { nik }, data: updateData, select: { nik: true, namaUser: true, role: true, isActive: true } });
    }
    async deleteUser(nik) {
        if (nik === 'admin')
            throw new common_1.BadRequestException('Cannot delete the root administrator.');
        try {
            return await this.prisma.masterUser.delete({ where: { nik } });
        }
        catch (e) {
            throw new common_1.BadRequestException('Cannot delete user; historical transactions restrict deletion. Consider toggling Inactive instead.');
        }
    }
    async findAllUsps(modelId, status) {
        let where = {};
        if (modelId !== undefined) {
            where.setupModelId = modelId;
        }
        if (status === 'ACTIVE')
            where.isActive = true;
        if (status === 'INACTIVE')
            where.isActive = false;
        const usps = await this.prisma.masterUsp.findMany({
            where,
            include: { setupModel: { select: { modelName: true, modelNo: true } } },
            orderBy: [{ setupModelId: 'asc' }, { uspCode: 'asc' }]
        });
        return this.serializeBigInt(usps);
    }
    async createUsp(data) {
        try {
            const res = await this.prisma.masterUsp.create({
                data: {
                    setupModelId: BigInt(data.setupModelId),
                    uspCode: data.uspCode,
                    uspName: data.uspName,
                    description: data.description || null,
                    isActive: data.isActive
                },
                include: { setupModel: { select: { modelName: true, modelNo: true } } }
            });
            return this.serializeBigInt(res);
        }
        catch (e) {
            if (e.code === 'P2002')
                throw new common_1.BadRequestException('USP Code or USP Name already exists for this Model.');
            throw new common_1.BadRequestException('Failed to create USP. Ensure Model exists.');
        }
    }
    async updateUsp(uspId, data) {
        const updateData = {};
        if (data.setupModelId !== undefined)
            updateData.setupModelId = BigInt(data.setupModelId);
        if (data.uspCode !== undefined)
            updateData.uspCode = data.uspCode;
        if (data.uspName !== undefined)
            updateData.uspName = data.uspName;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.isActive !== undefined)
            updateData.isActive = data.isActive;
        try {
            const res = await this.prisma.masterUsp.update({
                where: { uspId },
                data: updateData,
                include: { setupModel: { select: { modelName: true, modelNo: true } } }
            });
            return this.serializeBigInt(res);
        }
        catch (e) {
            if (e.code === 'P2002')
                throw new common_1.BadRequestException('USP Code or USP Name conflicts in this Model.');
            throw new common_1.BadRequestException('Failed to update USP.');
        }
    }
    async deleteUsp(uspId) {
        try {
            const res = await this.prisma.masterUsp.delete({ where: { uspId } });
            return this.serializeBigInt(res);
        }
        catch (e) {
            throw new common_1.BadRequestException('This USP cannot be deleted because it is already used by another configuration or transaction.');
        }
    }
    serializeBigInt(obj) {
        return JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));
    }
};
exports.MasterService = MasterService;
exports.MasterService = MasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MasterService);
//# sourceMappingURL=master.service.js.map