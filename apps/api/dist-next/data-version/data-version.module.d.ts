import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
export declare class DataVersionService {
    private readonly bootId;
    private counter;
    private changedAt;
    get current(): {
        version: string;
        changedAt: string;
    };
    bump(): void;
}
export declare class DataChangeInterceptor implements NestInterceptor {
    private readonly dataVersion;
    private readonly cache;
    private readonly logger;
    constructor(dataVersion: DataVersionService, cache: Cache);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
export declare class DataVersionController {
    private readonly dataVersion;
    private readonly notifications;
    constructor(dataVersion: DataVersionService, notifications: NotificationsService);
    get(): {
        alertId: string;
        version: string;
        changedAt: string;
    };
}
export declare class DataVersionModule {
}
//# sourceMappingURL=data-version.module.d.ts.map