import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RqcController } from './rqc.controller';
import { RqcService } from './rqc.service';

@Module({
    imports: [PrismaModule],
    controllers: [RqcController],
    providers: [RqcService],
})
export class RqcModule { }
