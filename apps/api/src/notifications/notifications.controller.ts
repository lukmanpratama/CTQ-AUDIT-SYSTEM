import { Controller, Get, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    /** CAP alerts the app polls for: newer than `afterId`, or the recent ones on a phone's first visit. */
    @Get()
    list(@Query('afterId') afterId?: string) {
        return this.notificationsService.list(afterId);
    }
}
