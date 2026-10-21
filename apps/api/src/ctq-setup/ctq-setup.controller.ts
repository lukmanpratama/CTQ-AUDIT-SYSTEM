import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CreateModelDto, LinkAreaDto, LinkProcessDto, LinkDefectDto, UploadPictureDto, UpdateModelDto, UploadAuditFileDto, UpdateSetupProcessDto } from './dto/ctq-setup.dto';
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

    // Model picture / internal audit file as real files, so lists only carry their URLs
    @Get('models/:modelId/picture')
    async getPicture(@Param('modelId') modelId: string, @Res() res: Response) {
        return this.sendModelFile(res, await this.ctqSetupService.getModelFile(modelId, 'picture'));
    }

    @Get('models/:modelId/audit-file')
    async getAuditFile(@Param('modelId') modelId: string, @Res() res: Response) {
        return this.sendModelFile(res, await this.ctqSetupService.getModelFile(modelId, 'internalAuditFile'));
    }

    private sendModelFile(res: Response, file: { redirect?: string; mime?: string; body?: Buffer; fileName?: string }) {
        if (file.redirect) return res.redirect(file.redirect);
        // The URL carries ?v=<stored size>, so a changed file gets a new URL; a day of caching is safe
        res.set({
            'Content-Type': file.mime!,
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName!)}`,
            'Cache-Control': 'private, max-age=86400',
        });
        return res.send(file.body);
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
    async updateModel(@Param('modelId') modelId: string, @Body() body: UpdateModelDto) {
        return this.ctqSetupService.updateModel(modelId, body);
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
