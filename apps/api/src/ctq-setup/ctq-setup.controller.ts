import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CreateModelDto, LinkAreaDto, LinkProcessDto, LinkDefectDto, UploadPictureDto, UpdateModelNameDto, UploadAuditFileDto, UpdateSetupProcessDto } from './dto/ctq-setup.dto';
import { CtqSetupService } from './ctq-setup.service';

@Controller('ctq-setup')
export class CtqSetupController {
    constructor(private readonly ctqSetupService: CtqSetupService) { }

    @Get('models')
    async getModels() {
        return this.ctqSetupService.findAllModels();
    }

    @Get('models/:modelId/tree')
    async getModelTree(@Param('modelId') modelId: string) {
        return this.ctqSetupService.findSetupByModel(modelId);
    }

    @Get('models/:modelId/validate-po')
    async validatePo(
        @Param('modelId') modelId: string,
        @Query('po') po: string,
    ) {
        return this.ctqSetupService.validatePo(modelId, po);
    }

    @Post('models')
    async createModel(@Body() body: CreateModelDto) {
        return this.ctqSetupService.createModel(body);
    }

    @Post('models/:modelId/picture')
    async uploadPicture(@Param('modelId') modelId: string, @Body() body: UploadPictureDto) {
        return this.ctqSetupService.updateModelPicture(modelId, body.pictureBase64);
    }

    @Post('models/:modelId/audit-file')
    async uploadAuditFile(@Param('modelId') modelId: string, @Body() body: UploadAuditFileDto) {
        return this.ctqSetupService.updateModelAuditFile(modelId, body.auditFileBase64);
    }

    @Patch('models/:modelId')
    async updateModelName(@Param('modelId') modelId: string, @Body() body: UpdateModelNameDto) {
        return this.ctqSetupService.updateModelName(modelId, body.modelName);
    }

    @Post('models/:modelId/areas')
    async linkArea(@Param('modelId') modelId: string, @Body() body: LinkAreaDto) {
        return this.ctqSetupService.linkAreaToModel(modelId, body.areaId);
    }

    @Post('areas/:setupAreaId/processes')
    async linkProcess(@Param('setupAreaId') setupAreaId: string, @Body() body: LinkProcessDto) {
        return this.ctqSetupService.linkProcessToArea(setupAreaId, body.processId);
    }

    @Patch('processes/:setupProcessId')
    async updateProcess(@Param('setupProcessId') setupProcessId: string, @Body() body: UpdateSetupProcessDto) {
        return this.ctqSetupService.updateSetupProcess(setupProcessId, body);
    }

    @Post('processes/:setupProcessId/defects')
    async linkDefect(@Param('setupProcessId') setupProcessId: string, @Body() body: LinkDefectDto) {
        return this.ctqSetupService.linkDefectToProcess(setupProcessId, body.defectId);
    }

    @Delete('areas/:setupAreaId')
    async removeArea(@Param('setupAreaId') setupAreaId: string) {
        return this.ctqSetupService.removeSetupArea(setupAreaId);
    }

    @Delete('processes/:setupProcessId')
    async removeProcess(@Param('setupProcessId') setupProcessId: string) {
        return this.ctqSetupService.removeSetupProcess(setupProcessId);
    }

    @Delete('defects/:setupDefectId')
    async removeDefect(@Param('setupDefectId') setupDefectId: string) {
        return this.ctqSetupService.removeSetupDefect(setupDefectId);
    }
}
