import { PrismaService } from '../prisma/prisma.service';
export declare class HealthController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    check(): {
        status: string;
        timestamp: string;
        service: string;
        version: string;
    };
    checkDb(): Promise<{
        status: string;
        timestamp: string;
        database: string;
        error?: undefined;
    } | {
        status: string;
        timestamp: string;
        database: string;
        error: string;
    }>;
}
//# sourceMappingURL=health.controller.d.ts.map