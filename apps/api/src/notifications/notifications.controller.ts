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

    @Post('unsubscribe')
    @HttpCode(200)
    unsubscribe(@Body() dto: PushUnsubscribeDto) {
        return this.pushService.unsubscribe(dto.endpoint);
    }
}
