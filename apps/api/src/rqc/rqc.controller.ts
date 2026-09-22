import { Controller, Post, Body, Param, Get, Delete, Query } from '@nestjs/common';
import { RqcService } from './rqc.service';
import { CreateHeaderDto, CreateInspectionDto } from './rqc.dto';

@Controller('rqc')
export class RqcController {
    constructor(private readonly rqcService: RqcService) { }

    @Post('headers')
    async createHeader(@Body() dto: CreateHeaderDto) {
        return this.rqcService.createHeader(dto);
    }

    @Get('kpis')
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
    async getTrends(
        @Query('modelId') modelId?: string,
        @Query('areaId') areaId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
    ) {
        return this.rqcService.getTrends({ modelId, areaId, startDate, endDate, factoryId, cell });
    }

    @Get('dashboard/cap-data')
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
    async getProcessDefects(
        @Query('modelId') modelId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('factoryId') factoryId?: string,
        @Query('cell') cell?: string,
    ) {
        return this.rqcService.getProcessDefects({ modelId, startDate, endDate, factoryId, cell });
    }

    @Get('ctq-details')
    async getCtqDetails(
        @Query('modelId') modelId: string,
        @Query('ctqType') ctqType: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.rqcService.getCtqDetails({ modelId, ctqType, startDate, endDate });
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
