import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

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
    async findAllPos(modelLike?: string) {
        if (modelLike) {
            // Excel imports often contain Non-Breaking Spaces (\xA0) instead of normal spaces.
            // A direct string match (e.g. 'BAD BUNNY') will fail if the DB has 'BAD\xA0BUNNY'.
            // Solution: split the search phrase by any space character and require ALL terms to match.
            const searchWords = modelLike.split(/\s+/).map(w => w.trim()).filter(w => w.length > 0);

            return this.prisma.masterPo.findMany({
                where: searchWords.length > 0 ? {
                    AND: searchWords.map(word => ({
                        model: { contains: word, mode: 'insensitive' }
                    }))
                } : undefined,
                orderBy: { po: 'desc' }
            });
        }
        return this.prisma.masterPo.findMany({ orderBy: { po: 'desc' } });
    }
    async createPo(data: { po: string; article: string; model: string; qtyOrder: number; destination?: string }) { return this.prisma.masterPo.create({ data }); }

    async bulkCreatePos(data: { po: string; article: string; model: string; qtyOrder: number; destination?: string }[]) {
        return this.prisma.$transaction(
            data.map(poData => this.prisma.masterPo.upsert({
                where: { po: poData.po },
                update: { article: poData.article, model: poData.model, qtyOrder: Number(poData.qtyOrder), destination: poData.destination },
                create: { po: poData.po, article: poData.article, model: poData.model, qtyOrder: Number(poData.qtyOrder), destination: poData.destination }
            }))
        );
    }

    async updatePo(po: string, data: { article?: string; model?: string; qtyOrder?: number; destination?: string }) { return this.prisma.masterPo.update({ where: { po }, data }); }
    async deletePo(po: string) {
        try { return await this.prisma.masterPo.delete({ where: { po } }); }
        catch (e) { throw new BadRequestException('Cannot delete PO; it may be tied to existing RQC transactions.'); }
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
}
