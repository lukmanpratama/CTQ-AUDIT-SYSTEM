import { Module } from '@nestjs/common';
import { TqcSetupDefectService } from './tqc-setup-defect.service';
import { TqcSetupDefectController } from './tqc-setup-defect.controller';

@Module({
  providers: [TqcSetupDefectService],
  controllers: [TqcSetupDefectController]
})
export class TqcSetupDefectModule {}
