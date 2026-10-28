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
exports.TqcSetupDefectService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TqcSetupDefectService = class TqcSetupDefectService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.setupDefectTqc.findMany({
            orderBy: { defectName: 'asc' },
        });
    }
    async create(dto) {
        const existing = await this.prisma.setupDefectTqc.findUnique({
            where: { defectName: dto.defectName },
        });
        if (existing) {
            throw new common_1.ConflictException(`Mapping for Defect Name "${dto.defectName}" already exists.`);
        }
        return this.prisma.setupDefectTqc.create({
            data: {
                defectName: dto.defectName,
                ctqType: dto.ctqType,
            },
        });
    }
    async update(id, dto) {
        const record = await this.prisma.setupDefectTqc.findUnique({
            where: { setupDefectTqcId: id },
        });
        if (!record) {
            throw new common_1.NotFoundException(`SetupDefectTqc with ID ${id} not found`);
        }
        if (dto.defectName !== record.defectName) {
            const collision = await this.prisma.setupDefectTqc.findUnique({
                where: { defectName: dto.defectName },
            });
            if (collision) {
                throw new common_1.ConflictException(`Mapping for Defect Name "${dto.defectName}" already exists.`);
            }
        }
        return this.prisma.setupDefectTqc.update({
            where: { setupDefectTqcId: id },
            data: dto,
        });
    }
    async remove(id) {
        const record = await this.prisma.setupDefectTqc.findUnique({
            where: { setupDefectTqcId: id },
        });
        if (!record) {
            throw new common_1.NotFoundException(`SetupDefectTqc with ID ${id} not found`);
        }
        return this.prisma.setupDefectTqc.delete({
            where: { setupDefectTqcId: id },
        });
    }
    async bulkCreate(data) {
        return this.prisma.$transaction(data.map((item) => this.prisma.setupDefectTqc.upsert({
            where: { defectName: item.defectName },
            update: { ctqType: item.ctqType },
            create: {
                defectName: item.defectName,
                ctqType: item.ctqType,
            },
        })));
    }
    async clearAll() {
        return this.prisma.setupDefectTqc.deleteMany();
    }
};
exports.TqcSetupDefectService = TqcSetupDefectService;
exports.TqcSetupDefectService = TqcSetupDefectService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TqcSetupDefectService);
//# sourceMappingURL=tqc-setup-defect.service.js.map