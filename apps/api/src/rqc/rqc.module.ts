import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RqcController } from './rqc.controller';
import { RqcService } from './rqc.service';
import { RqcImportService } from './rqc-import.service';

@Module({
    imports: [PrismaModule],
    controllers: [RqcController],
    providers: [RqcService, RqcImportService],
})
export class RqcModule { }
