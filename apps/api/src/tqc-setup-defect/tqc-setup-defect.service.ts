import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSetupDefectTqcDto, UpdateSetupDefectTqcDto } from './tqc-setup-defect.dto';

@Injectable()
export class TqcSetupDefectService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.setupDefectTqc.findMany({
            orderBy: { defectName: 'asc' },
        });
    }

    async create(dto: CreateSetupDefectTqcDto) {
        const existing = await this.prisma.setupDefectTqc.findUnique({
            where: { defectName: dto.defectName },
        });

        if (existing) {
            throw new ConflictException(`Mapping for Defect Name "${dto.defectName}" already exists.`);
        }

        return this.prisma.setupDefectTqc.create({
            data: {
                defectName: dto.defectName,
                ctqType: dto.ctqType,
            },
        });
    }

    async update(id: number, dto: UpdateSetupDefectTqcDto) {
        const record = await this.prisma.setupDefectTqc.findUnique({
            where: { setupDefectTqcId: id },
        });

        if (!record) {
            throw new NotFoundException(`SetupDefectTqc with ID ${id} not found`);
        }

        // Check if the modified defectName collides with another mapping
        if (dto.defectName !== record.defectName) {
            const collision = await this.prisma.setupDefectTqc.findUnique({
                where: { defectName: dto.defectName },
            });
            if (collision) {
                throw new ConflictException(`Mapping for Defect Name "${dto.defectName}" already exists.`);
            }
        }

        return this.prisma.setupDefectTqc.update({
            where: { setupDefectTqcId: id },
            data: dto,
        });
    }

    async remove(id: number) {
        const record = await this.prisma.setupDefectTqc.findUnique({
            where: { setupDefectTqcId: id },
        });

        if (!record) {
            throw new NotFoundException(`SetupDefectTqc with ID ${id} not found`);
        }

        return this.prisma.setupDefectTqc.delete({
            where: { setupDefectTqcId: id },
        });
    }

    async bulkCreate(data: CreateSetupDefectTqcDto[]) {
        return this.prisma.$transaction(
            data.map((item) =>
                this.prisma.setupDefectTqc.upsert({
                    where: { defectName: item.defectName },
                    update: { ctqType: item.ctqType },
                    create: {
                        defectName: item.defectName,
                        ctqType: item.ctqType,
                    },
                })
            )
        );
    }

    async clearAll() {
        return this.prisma.setupDefectTqc.deleteMany();
    }
}
