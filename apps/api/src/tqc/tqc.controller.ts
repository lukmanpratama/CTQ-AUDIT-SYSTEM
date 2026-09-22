import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { TqcService } from './tqc.service';

@Controller('tqc')
export class TqcController {
    constructor(private readonly tqcService: TqcService) { }

    @Post(':moduleType/upload')
    async uploadExcelData(
        @Param('moduleType') moduleType: string,
        @Body() body: any[]
    ) {
        return this.tqcService.createMany(body, moduleType);
    }

    @Get(':moduleType')
    async getReportsByModule(
        @Param('moduleType') moduleType: string
    ) {
        return this.tqcService.getByModule(moduleType);
    }

    @Delete(':id')
    async deleteRecord(@Param('id') id: string) {
        return this.tqcService.deleteRecord(parseInt(id, 10));
    }

    @Delete('bulk/:moduleType')
    async deleteByModule(@Param('moduleType') moduleType: string) {
        return this.tqcService.deleteByModule(moduleType);
    }
}
