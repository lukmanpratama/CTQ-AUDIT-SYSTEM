import { Module } from '@nestjs/common';
import { TqcController } from './tqc.controller';
import { TqcService } from './tqc.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [TqcController],
    providers: [TqcService],
})
export class TqcModule { }
