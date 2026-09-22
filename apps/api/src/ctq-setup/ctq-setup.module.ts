import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CtqSetupController } from './ctq-setup.controller';
import { CtqSetupService } from './ctq-setup.service';

@Module({
    imports: [PrismaModule],
    controllers: [CtqSetupController],
    providers: [CtqSetupService],
})
export class CtqSetupModule { }
