// apps/api/src/data-version/data-version.module.ts
// Tells open pages when data was added, changed or deleted, so they can refresh themselves.

import { CallHandler, Controller, ExecutionContext, Get, Inject, Injectable, Logger, Module, NestInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable, tap } from 'rxjs';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';

/** Writes that change no records the pages show: logging in, uploading a photo before its record is saved. */
const IGNORED_WRITE_PATHS = ['/api/auth/', '/api/files/upload'];

@Injectable()
export class DataVersionService {
    // A new id per API start, so pages also refresh after a restart (the counter starts over)
    private readonly bootId = Date.now().toString(36);
    private counter = 0;
    private changedAt = new Date().toISOString();

    get current() {
        return { version: `${this.bootId}-${this.counter}`, changedAt: this.changedAt };
    }

    bump() {
        this.counter++;
        this.changedAt = new Date().toISOString();
    }
}

/**
 * After every successful POST / PUT / PATCH / DELETE: clears the response cache (dashboard
 * endpoints were cached for 60s, so new data stayed invisible) and bumps the data version.
 */
@Injectable()
export class DataChangeInterceptor implements NestInterceptor {
    private readonly logger = new Logger(DataChangeInterceptor.name);

    constructor(
        private readonly dataVersion: DataVersionService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const req = context.switchToHttp().getRequest<{ method: string; originalUrl?: string; url: string }>();
        const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        const path = (req.originalUrl || req.url || '').split('?')[0];
        if (!isWrite || IGNORED_WRITE_PATHS.some(p => path.startsWith(p))) return next.handle();

        return next.handle().pipe(
            tap(async () => {
                this.dataVersion.bump();
                try {
                    await this.cache.reset();
                } catch (err) {
                    this.logger.warn(`Cache reset failed: ${err instanceof Error ? err.message : err}`);
                }
            }),
        );
    }
}

@Controller('data-version')
export class DataVersionController {
    constructor(
        private readonly dataVersion: DataVersionService,
        private readonly notifications: NotificationsService,
    ) { }

    /**
     * Polled by open pages (every ~15s); when `version` changes they reload their data.
     * `alertId` is the newest CAP alert: when it grows, the app fetches and pops up the new ones.
     */
    @Get()
    get() {
        return { ...this.dataVersion.current, alertId: this.notifications.latestId };
    }
}

@Module({
    imports: [NotificationsModule],
    controllers: [DataVersionController],
    providers: [
        DataVersionService,
        { provide: APP_INTERCEPTOR, useClass: DataChangeInterceptor },
    ],
})
export class DataVersionModule { }
