import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { IsObject, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { BrowserPushSubscription, PushService } from './push.service';

class PushSubscribeDto {
    /** PushSubscription.toJSON() from the browser; checked in PushService.subscribe */
    @IsObject()
    subscription!: BrowserPushSubscription;
}

class PushUnsubscribeDto {
    @IsString()
    endpoint!: string;
}

@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly pushService: PushService,
    ) { }

    /** CAP alerts the app polls for: newer than `afterId`, or the recent ones on a phone's first visit. */
    @Get()
    list(@Query('afterId') afterId?: string) {
        return this.notificationsService.list(afterId);
    }

    /** Public VAPID key a browser needs before it can subscribe to browser notifications. */
    @Get('push-key')
    pushKey() {
        return this.pushService.getPublicKey();
    }

    /** A browser that allowed notifications registers here to receive the CAP alerts. */
    @Post('subscribe')
    @HttpCode(200)
    subscribe(@Body() dto: PushSubscribeDto, @Headers('user-agent') userAgent?: string) {
        return this.pushService.subscribe(dto.subscription, userAgent);
    }

    /** Test endpoint to trigger a weekly CAP test notification to all subscribed devices. */
    @Post('test-weekly')
    @HttpCode(200)
    async testWeekly(@Query('defectRate') rate?: string) {
        const defectRate = rate ? parseFloat(rate) : 0.0525; // default 5.25%
        const now = new Date();
        const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
        const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
        const lastSunday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 1);
        const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const testDedupeKey = `TEST_WEEKLY:${Date.now()}`;

        await (this.notificationsService as any).insert({
            type: 'WEEKLY',
            dedupeKey: testDedupeKey,
            title: 'Rata-rata Defect Rate Minggu Lalu Melebihi 5% (TEST)',
            setupModelId: BigInt(8),
            modelLabel: 'TAEKWONDO MEI BALLET W (OQG90)',
            defectRate: defectRate,
            periodStart: ymd(lastMonday),
            periodEnd: ymd(lastSunday),
        });

        return {
            message: 'Test weekly notification dispatched to push subscriptions',
            model: 'TAEKWONDO MEI BALLET W (OQG90)',
            defectRate: (defectRate * 100).toFixed(2) + '%',
            period: `${ymd(lastMonday)} to ${ymd(lastSunday)}`
        };
    }

    @Post('unsubscribe')
    @HttpCode(200)
    unsubscribe(@Body() dto: PushUnsubscribeDto) {
        return this.pushService.unsubscribe(dto.endpoint);
    }
}
