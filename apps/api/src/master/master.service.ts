import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { modelNameContainsWhere, poWhereForModel } from '../common/model-match';

@Injectable()
export class MasterService {
    constructor(private readonly prisma: PrismaService) { }

    // --- AREAS ---
    async findAllAreas() { return this.prisma.masterArea.findMany({ orderBy: { areaId: 'asc' } }); }
    async createArea(data: { area: string }) { return this.prisma.masterArea.create({ data }); }
    async updateArea(areaId: bigint, data: { area: string }) { return this.prisma.masterArea.update({ where: { areaId }, data }); }
    async deleteArea(areaId: bigint) {
        try { return await this.prisma.masterArea.delete({ where: { areaId } }); }
        catch (e) { throw new BadRequestException('Cannot delete area; it might be in use within CTQ configurations.'); }
    }

    // --- PROCESSES ---
    async findAllProcesses() { return this.prisma.masterProcess.findMany({ orderBy: { processId: 'asc' } }); }
    async createProcess(data: { process: string; ctq?: string; riskLevel?: string }) { return this.prisma.masterProcess.create({ data }); }
    async updateProcess(processId: bigint, data: { process?: string; ctq?: string; riskLevel?: string; sellingPoint?: string }) { return this.prisma.masterProcess.update({ where: { processId }, data }); }
    async deleteProcess(processId: bigint) {
        try { return await this.prisma.masterProcess.delete({ where: { processId } }); }
        catch (e) { throw new BadRequestException('Cannot delete process; it might be in use.'); }
    }

    // --- DEFECTS ---
    async findAllDefects() { return this.prisma.masterDefect.findMany({ orderBy: { defectId: 'asc' } }); }
    async createDefect(data: { defect: string }) { return this.prisma.masterDefect.create({ data }); }
    async updateDefect(defectId: bigint, data: { defect: string }) { return this.prisma.masterDefect.update({ where: { defectId }, data }); }
    async deleteDefect(defectId: bigint) {
        try { return await this.prisma.masterDefect.delete({ where: { defectId } }); }
        catch (e) { throw new BadRequestException('Cannot delete defect; it might be in use.'); }
    }

    // --- FACTORIES ---
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
    async createFactory(data: { factory: string }) { return this.prisma.masterFactory.create({ data }); }

    // --- POS ---
    private buildModelLikeWhere(modelLike?: string) {
        if (!modelLike) return undefined;
        // Excel imports often contain Non-Breaking Spaces (\xA0) instead of normal spaces.
        // A direct string match (e.g. 'BAD BUNNY') will fail if the DB has 'BAD\xA0BUNNY'.
        // Solution: split the search phrase by any space character and require ALL terms to match.
        return modelNameContainsWhere(modelLike);
    }

    async findAllPos(modelLike?: string, setupModelId?: string) {
        // With a Setup CTQ model, match its articles so models sharing a name get only their own POs
        if (setupModelId) {
            const model = await this.prisma.setupModel.findUnique({
                where: { setupModelId: BigInt(setupModelId) },
                select: { modelName: true, articles: { select: { article: true } } }
            });
            if (!model) return [];
            return this.prisma.masterPo.findMany({ where: poWhereForModel(model), orderBy: { po: 'desc' } });
        }
        return this.prisma.masterPo.findMany({
            where: this.buildModelLikeWhere(modelLike),
            orderBy: { po: 'desc' }
        });
    }

    async findPosPaged(page = 1, limit = 100, modelLike?: string) {
        const take = Math.min(Math.max(limit || 100, 1), 500);
        const currentPage = Math.max(page || 1, 1);
        const where = this.buildModelLikeWhere(modelLike);
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
    async createPo(data: { po: string; article: string; model: string; qtyOrder: number; destination?: string }) { return this.prisma.masterPo.create({ data }); }

    async bulkCreatePos(data: { po: string; article: string; model: string; qtyOrder: number; destination?: string }[]) {
        const chunkSize = 50;
        let processed = 0;

        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await this.prisma.$transaction(
                chunk.map(poData => this.prisma.masterPo.upsert({
                    where: { po: poData.po },
                    update: { article: poData.article, model: poData.model, qtyOrder: Number(poData.qtyOrder), destination: poData.destination },
                    create: { po: poData.po, article: poData.article, model: poData.model, qtyOrder: Number(poData.qtyOrder), destination: poData.destination }
                }))
            );
            processed += chunk.length;
        }
        return { success: true, processed };
    }

    async updatePo(po: string, data: { article?: string; model?: string; qtyOrder?: number; destination?: string }) { return this.prisma.masterPo.update({ where: { po }, data }); }
    async deletePo(po: string) {
        try { return await this.prisma.masterPo.delete({ where: { po } }); }
        catch (e) { throw new BadRequestException('Cannot delete PO; it may be tied to existing RQC transactions.'); }
    }

    async deleteAllPos() {
        try {
            const res = await this.prisma.masterPo.deleteMany({});
            return { message: 'All POs deleted successfully', deletedCount: res.count };
        }
        catch (e) { throw new BadRequestException('Cannot delete all POs; some may be tied to existing RQC transactions.'); }
    }

    // --- USERS ---
    async findAllUsers() { return this.prisma.masterUser.findMany({ select: { nik: true, namaUser: true, role: true, isActive: true }, orderBy: { nik: 'asc' } }); }
    async createUser(data: { nik: string; namaUser: string; password?: string; role?: string }) {
        const passwordHash = data.password ? await argon2.hash(data.password) : await argon2.hash('123456');
        return this.prisma.masterUser.create({ data: { nik: data.nik, namaUser: data.namaUser, passwordHash, role: data.role || 'RQC' }, select: { nik: true, namaUser: true, role: true, isActive: true } });
    }
    async updateUser(nik: string, data: { namaUser: string; role: string; isActive: boolean; password?: string }) {
        const updateData: any = { namaUser: data.namaUser, role: data.role, isActive: data.isActive };
        if (data.password) updateData.passwordHash = await argon2.hash(data.password);
        return this.prisma.masterUser.update({ where: { nik }, data: updateData, select: { nik: true, namaUser: true, role: true, isActive: true } });
    }
    async deleteUser(nik: string) {
        if (nik === 'admin') throw new BadRequestException('Cannot delete the root administrator.');
        try { return await this.prisma.masterUser.delete({ where: { nik } }); }
        catch (e) { throw new BadRequestException('Cannot delete user; historical transactions restrict deletion. Consider toggling Inactive instead.'); }
    }
    // --- USPs (Selling Points) ---
    async findAllUsps(modelId?: bigint, status?: string) {
        let where: any = {};
        if (modelId !== undefined) {
            where.setupModelId = modelId;
        }
        if (status === 'ACTIVE') where.isActive = true;
        if (status === 'INACTIVE') where.isActive = false;

        const usps = await this.prisma.masterUsp.findMany({
            where,
            include: { setupModel: { select: { modelName: true, modelNo: true } } },
            orderBy: [{ setupModelId: 'asc' }, { uspCode: 'asc' }]
        });
        return this.serializeBigInt(usps);
    }

    async createUsp(data: { setupModelId: string | bigint | number; uspCode: string; uspName: string; description?: string; isActive: boolean }) {
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
        } catch (e: any) {
            if (e.code === 'P2002') throw new BadRequestException('USP Code or USP Name already exists for this Model.');
            throw new BadRequestException('Failed to create USP. Ensure Model exists.');
        }
    }

    async updateUsp(uspId: bigint, data: { setupModelId?: string | bigint | number; uspCode?: string; uspName?: string; description?: string; isActive?: boolean }) {
        const updateData: any = {};
        if (data.setupModelId !== undefined) updateData.setupModelId = BigInt(data.setupModelId);
        if (data.uspCode !== undefined) updateData.uspCode = data.uspCode;
        if (data.uspName !== undefined) updateData.uspName = data.uspName;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        try {
            const res = await this.prisma.masterUsp.update({
                where: { uspId },
                data: updateData,
                include: { setupModel: { select: { modelName: true, modelNo: true } } }
            });
            return this.serializeBigInt(res);
        } catch (e: any) {
            if (e.code === 'P2002') throw new BadRequestException('USP Code or USP Name conflicts in this Model.');
            throw new BadRequestException('Failed to update USP.');
        }
    }

    async deleteUsp(uspId: bigint) {
        // Soft delete constraint handling. 
        // Currently architecture does not attach RqcProcess explicitly via DB constraint, 
        // but we'll soft deactivate if standard deletion is enforced in business term
        try {
            const res = await this.prisma.masterUsp.delete({ where: { uspId } });
            return this.serializeBigInt(res);
        } catch (e) {
            throw new BadRequestException('This USP cannot be deleted because it is already used by another configuration or transaction.');
        }
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
