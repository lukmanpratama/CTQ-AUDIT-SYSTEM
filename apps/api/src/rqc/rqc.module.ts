import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RqcController } from './rqc.controller';
import { RqcService } from './rqc.service';
import { RqcImportService } from './rqc-import.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PrismaModule, NotificationsModule],
    controllers: [RqcController],
    providers: [RqcService, RqcImportService],
})
export class RqcModule { }
