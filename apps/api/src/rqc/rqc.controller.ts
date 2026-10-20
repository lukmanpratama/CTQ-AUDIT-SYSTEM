import { Controller, Post, Put, Body, Param, Get, Delete, Query, UseInterceptors } from '@nestjs/common';
import { RqcService } from './rqc.service';
import { CreateHeaderDto, CreateInspectionDto, UpdateHeaderDto, ImportInspectionsDto } from './rqc.dto';
import { RqcImportService } from './rqc-import.service';
import { CacheInterceptor } from '@nestjs/cache-manager';

@Controller('rqc')
export class RqcController {
    constructor(
        private readonly rqcService: RqcService,
        private readonly rqcImportService: RqcImportService,
    ) { }

    @Post('headers')
    async createHeader(@Body() dto: CreateHeaderDto) {
        return this.rqcService.createHeader(dto);
    }

    /** Bulk import from the Excel template. apply=false (default) only validates and returns a preview. */
    @Post('import')
    async importInspections(@Body() dto: ImportInspectionsDto) {
        return this.rqcImportService.importInspections(dto.rows, dto.apply === true);
    }

    @Get('kpis')
    @UseInterceptors(CacheInterceptor)
    async getKpis(
        @Query('modelId') modelId?: string,
        @Query('areaId') areaId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('checkingTime') checkingTime?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
    ) {
        return this.rqcService.getDashboardKpis({ modelId, areaId, startDate, endDate, checkingTime, factoryId, cell });
    }

    @Get('trends')
    @UseInterceptors(CacheInterceptor)
    async getTrends(
        @Query('modelId') modelId?: string,
        @Query('areaId') areaId?: string,
        @Query('areaName') areaName?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
        @Query('checkingTime') checkingTime?: string,
        @Query('processName') processName?: string,
    ) {
        return this.rqcService.getTrends({ modelId, areaId, areaName, startDate, endDate, factoryId, cell, checkingTime, processName });
    }

    @Get('dashboard/cap-data')
    @UseInterceptors(CacheInterceptor)
    async getCapData(
        @Query('modelId') modelId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
    ) {
        return this.rqcService.getCapData({ modelId, startDate, endDate, factoryId, cell });
    }

    @Get('process-defects')
    @UseInterceptors(CacheInterceptor)
    async getProcessDefects(
        @Query('modelId') modelId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
        @Query('checkingTime') checkingTime?: string,
    ) {
        return this.rqcService.getProcessDefects({ modelId, startDate, endDate, factoryId, cell, checkingTime });
    }

    @Get('defect-ctq-summary')
    @UseInterceptors(CacheInterceptor)
    async getDefectCtqSummary(
        @Query('modelId') modelId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('cell') cell?: string
    ) {
        if (!modelId) throw new Error('Model ID is required');
        return this.rqcService.getDefectCtqSummary(modelId, startDate, endDate, cell);
    }

    @Get('ctq-details')
    @UseInterceptors(CacheInterceptor)
    async getCtqDetails(
        @Query('modelId') modelId: string,
        @Query('ctqType') ctqType: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.rqcService.getCtqDetails({ modelId, ctqType, startDate, endDate });
    }

    @Get('tqc-eol-summary')
    async getTqcEolSummary(
        @Query('modelId') modelId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('cell') cell?: string
    ) {
        return this.rqcService.getTqcEolSummary({ modelId, startDate, endDate, cell });
    }

    @Get('recent-inspections')
    async getRecentInspections(
        @Query('modelId') modelId?: string,
        @Query('areaId') areaId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('checkingTime') checkingTime?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
    ) {
        return this.rqcService.getRecentInspections({ modelId, areaId, startDate, endDate, checkingTime, factoryId, cell });
    }

    @Get('filters')
    async getFilters() {
        return this.rqcService.getDashboardFilterOptions();
    }

    @Get('immediate-actions')
    async getImmediateActions(
        @Query('modelId') modelId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
        @Query('areaName') areaName?: string,
    ) {
        return this.rqcService.getImmediateActionData({ modelId, startDate, endDate, factoryId, cell, areaName });
    }

    @Get('headers')
    async getAllHeaders(
        @Query('model') model?: string,
        @Query('modelId') modelId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('checkingTime') checkingTime?: string,
        @Query('inspector') inspector?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string
    ) {
        return this.rqcService.getAllHeaders({ model, modelId, startDate, endDate, checkingTime, inspector, factoryId, cell });
    }

    @Put('headers/:headerId')
    async updateHeader(@Param('headerId') headerId: string, @Body() dto: UpdateHeaderDto) {
        return this.rqcService.updateHeader(headerId, dto);
    }

    @Delete('headers/:headerId')
    async deleteHeader(@Param('headerId') headerId: string) {
        return this.rqcService.deleteHeader(headerId);
    }

    @Post('headers/:headerId/areas/:areaId/processes/:processId/inspections')
    async submitInspection(
        @Param('headerId') headerId: string,
        @Param('areaId') areaId: string,
        @Param('processId') processId: string,
        @Body() dto: CreateInspectionDto
    ) {
        return this.rqcService.submitProcessInspection(
            headerId,
            areaId,
            processId,
            dto
        );
    }

    @Delete('headers/:headerId/areas/:areaId/processes/:processId/inspections')
    async deleteInspection(
        @Param('headerId') headerId: string,
        @Param('areaId') areaId: string,
        @Param('processId') processId: string
    ) {
        return this.rqcService.deleteProcessInspection(
            headerId,
            areaId,
            processId
        );
    }
    @Get('headers/:headerId')
    async getHeader(@Param('headerId') headerId: string) {
        return this.rqcService.getHeaderSession(headerId);
    }
}
