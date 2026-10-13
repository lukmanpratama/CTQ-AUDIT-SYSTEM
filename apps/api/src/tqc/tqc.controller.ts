import { Controller, Post, Body, Get, Param, Delete, Patch } from '@nestjs/common';
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

    @Patch(':id/usp')
    async updateUspClassification(
        @Param('id') id: string,
        @Body() body: { uspClassification: string }
    ) {
        return this.tqcService.updateUspClassification(parseInt(id, 10), body?.uspClassification);
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
