import { Controller, Get, Post, Body, Put, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { TqcSetupDefectService } from './tqc-setup-defect.service';
import { CreateSetupDefectTqcDto, UpdateSetupDefectTqcDto } from './tqc-setup-defect.dto';

@Controller('tqc-setup-defect')
export class TqcSetupDefectController {
    constructor(private readonly tqcSetupDefectService: TqcSetupDefectService) { }

    @Get()
    findAll() {
        return this.tqcSetupDefectService.findAll();
    }

    @Post()
    create(@Body() createDto: CreateSetupDefectTqcDto) {
        return this.tqcSetupDefectService.create(createDto);
    }

    @Post('bulk')
    bulkCreate(@Body() createDtos: CreateSetupDefectTqcDto[]) {
        return this.tqcSetupDefectService.bulkCreate(createDtos);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateSetupDefectTqcDto) {
        return this.tqcSetupDefectService.update(id, updateDto);
    }

    @Delete('bulk')
    clearAll() {
        return this.tqcSetupDefectService.clearAll();
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.tqcSetupDefectService.remove(id);
    }
}
