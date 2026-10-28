import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export interface PushPayload {
    title: string;
    body: string;
    url: string;
    tag: string;
}
export interface BrowserPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export declare class PushService implements OnModuleInit {
    private readonly prisma;
    private readonly logger;
    private publicKey;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    getPublicKey(): {
        publicKey: string | null;
    };
    subscribe(subscription: BrowserPushSubscription, userAgent?: string): Promise<{
        subscribed: boolean;
    }>;
    unsubscribe(endpoint: string): Promise<{
        subscribed: boolean;
    }>;
    sendToAll(payload: PushPayload): Promise<void>;
}
//# sourceMappingURL=push.service.d.ts.map