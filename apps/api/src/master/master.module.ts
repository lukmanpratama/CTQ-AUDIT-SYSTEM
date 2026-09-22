import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

@Module({
    imports: [PrismaModule],
    controllers: [MasterController],
    providers: [MasterService],
})
export class MasterModule { }
