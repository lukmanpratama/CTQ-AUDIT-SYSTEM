import { NotificationsService } from './notifications.service';
import { BrowserPushSubscription, PushService } from './push.service';
declare class PushSubscribeDto {
    subscription: BrowserPushSubscription;
}
declare class PushUnsubscribeDto {
    endpoint: string;
}
export declare class NotificationsController {
    private readonly notificationsService;
    private readonly pushService;
    constructor(notificationsService: NotificationsService, pushService: PushService);
    list(afterId?: string): Promise<{
        latestId: string;
        items: import("./notifications.service").CapNotification[];
    }>;
    pushKey(): {
        publicKey: string | null;
    };
    subscribe(dto: PushSubscribeDto, userAgent?: string): Promise<{
        subscribed: boolean;
    }>;
    unsubscribe(dto: PushUnsubscribeDto): Promise<{
        subscribed: boolean;
    }>;
}
export {};
//# sourceMappingURL=notifications.controller.d.ts.map