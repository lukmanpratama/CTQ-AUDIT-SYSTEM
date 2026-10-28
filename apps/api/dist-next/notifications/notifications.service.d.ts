import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
export interface CapNotification {
    id: string;
    type: 'DAILY' | 'WEEKLY';
    title: string;
    setupModelId: string | null;
    modelLabel: string | null;
    factory: string | null;
    cell: string | null;
    process: string | null;
    defect: string | null;
    defectRate: number;
    inspectionDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    rqcHeaderId: string | null;
    createdAt: string;
}
export declare class NotificationsService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly push;
    private readonly logger;
    private weeklyTimer?;
    latestId: string;
    constructor(prisma: PrismaService, push: PushService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    notifyDailyCap(rqcProcessId: string): Promise<void>;
    runWeeklyCheck(now?: Date): Promise<void>;
    list(afterId?: string): Promise<{
        latestId: string;
        items: CapNotification[];
    }>;
    private insert;
}
//# sourceMappingURL=notifications.service.d.ts.map