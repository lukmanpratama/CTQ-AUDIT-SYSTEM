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
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super({
            log: process.env.NODE_ENV === 'development'
                ? [
                    { emit: 'stdout', level: 'error' },
                    { emit: 'stdout', level: 'warn' },
                ]
                : [{ emit: 'stdout', level: 'error' }],
        });
        this.logger = new common_1.Logger(PrismaService_1.name);
    }
    async onModuleInit() {
        const maxAttempts = 30;
        for (let attempt = 1;; attempt++) {
            try {
                await this.$connect();
                this.logger.log('✅ Prisma connected to PostgreSQL');
                return;
            }
            catch (error) {
                if (attempt >= maxAttempts)
                    throw error;
                const message = error instanceof Error ? error.message.split('\n').pop() : String(error);
                this.logger.warn(`PostgreSQL not reachable (attempt ${attempt}/${maxAttempts}): ${message}. Retrying in 5s...`);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Prisma disconnected from PostgreSQL');
    }
    async cleanDatabase() {
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('cleanDatabase() can only be called in test environment');
        }
        const tableNames = [
            'rqc_inspection',
            'rqc_process',
            'rqc_area',
            'rqc_header',
            'setup_defect',
            'setup_process',
            'setup_area',
            'model_po_mapping',
            'setup_model',
            'master_po',
            'master_user',
            'master_factory',
            'master_defect',
            'master_process',
            'master_area',
            'file_asset',
        ];
        for (const table of tableNames) {
            await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
        }
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map