import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { MasterService } from './master.service';
import { CreateAreaDto, CreateProcessDto, CreateDefectDto, CreateFactoryDto, CreateUserDto, CreatePoDto, UpdateAreaDto, UpdateProcessDto, UpdateDefectDto, UpdateUserDto, UpdatePoDto } from './dto/master.dto';

@Controller('master')
export class MasterController {
    constructor(private readonly masterService: MasterService) { }

    @Get('areas')
    async getAreas() { return this.masterService.findAllAreas(); }

    @Post('areas')
    async createArea(@Body() dto: CreateAreaDto) { return this.masterService.createArea(dto); }

    @Put('areas/:id')
    async updateArea(@Param('id') id: string, @Body() dto: UpdateAreaDto) { return this.masterService.updateArea(BigInt(id), dto); }

    @Delete('areas/:id')
    async deleteArea(@Param('id') id: string) { return this.masterService.deleteArea(BigInt(id)); }


    @Get('processes')
    async getProcesses() { return this.masterService.findAllProcesses(); }

    @Post('processes')
    async createProcess(@Body() dto: CreateProcessDto) { return this.masterService.createProcess(dto); }

    @Put('processes/:id')
    async updateProcess(@Param('id') id: string, @Body() dto: UpdateProcessDto) { return this.masterService.updateProcess(BigInt(id), dto); }

    @Delete('processes/:id')
    async deleteProcess(@Param('id') id: string) { return this.masterService.deleteProcess(BigInt(id)); }


    @Get('defects')
    async getDefects() { return this.masterService.findAllDefects(); }

    @Post('defects')
    async createDefect(@Body() dto: CreateDefectDto) { return this.masterService.createDefect(dto); }

    @Put('defects/:id')
    async updateDefect(@Param('id') id: string, @Body() dto: UpdateDefectDto) { return this.masterService.updateDefect(BigInt(id), dto); }

    @Delete('defects/:id')
    async deleteDefect(@Param('id') id: string) { return this.masterService.deleteDefect(BigInt(id)); }


    @Get('factories')
    async getFactories() { return this.masterService.findAllFactories(); }

    @Post('factories')
    async createFactory(@Body() dto: CreateFactoryDto) { return this.masterService.createFactory(dto); }


    @Get('pos')
    async getPos(@Query('modelLike') modelLike?: string) { return this.masterService.findAllPos(modelLike); }

    @Post('pos')
    async createPo(@Body() dto: CreatePoDto) { return this.masterService.createPo(dto); }

    @Post('pos/bulk')
    async bulkCreatePos(@Body() dtos: CreatePoDto[]) {
        return this.masterService.bulkCreatePos(dtos);
    }

    @Put('pos/:id')
    async updatePo(@Param('id') id: string, @Body() dto: UpdatePoDto) { return this.masterService.updatePo(id, dto); }

    @Delete('pos/:po')
    async deletePo(@Param('po') po: string) { return this.masterService.deletePo(po); }


    @Get('users')
    async getUsers() { return this.masterService.findAllUsers(); }

    @Post('users')
    async createUser(@Body() dto: CreateUserDto) { return this.masterService.createUser(dto); }

    @Put('users/:nik')
    async updateUser(@Param('nik') nik: string, @Body() dto: UpdateUserDto) { return this.masterService.updateUser(nik, dto); }

    @Delete('users/:nik')
    async deleteUser(@Param('nik') nik: string) { return this.masterService.deleteUser(nik); }
}
