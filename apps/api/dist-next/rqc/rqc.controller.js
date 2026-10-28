"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RqcController = void 0;
const common_1 = require("@nestjs/common");
const rqc_service_1 = require("./rqc.service");
const rqc_dto_1 = require("./rqc.dto");
const rqc_import_service_1 = require("./rqc-import.service");
const cache_manager_1 = require("@nestjs/cache-manager");
let RqcController = class RqcController {
    constructor(rqcService, rqcImportService) {
        this.rqcService = rqcService;
        this.rqcImportService = rqcImportService;
    }
    async createHeader(dto) {
        return this.rqcService.createHeader(dto);
    }
    async importInspections(dto) {
        return this.rqcImportService.importInspections(dto.rows, dto.apply === true);
    }
    async getKpis(modelId, areaId, startDate, endDate, checkingTime, factoryId, cell) {
        return this.rqcService.getDashboardKpis({ modelId, areaId, startDate, endDate, checkingTime, factoryId, cell });
    }
    async getTrends(modelId, areaId, areaName, startDate, endDate, factoryId, cell, checkingTime, processName) {
        return this.rqcService.getTrends({ modelId, areaId, areaName, startDate, endDate, factoryId, cell, checkingTime, processName });
    }
    async getCapData(modelId, startDate, endDate, factoryId, cell) {
        return this.rqcService.getCapData({ modelId, startDate, endDate, factoryId, cell });
    }
    async getProcessDefects(modelId, startDate, endDate, factoryId, cell, checkingTime) {
        return this.rqcService.getProcessDefects({ modelId, startDate, endDate, factoryId, cell, checkingTime });
    }
    async getDefectCtqSummary(modelId, startDate, endDate, cell) {
        if (!modelId)
            throw new Error('Model ID is required');
        return this.rqcService.getDefectCtqSummary(modelId, startDate, endDate, cell);
    }
    async getCtqDetails(modelId, ctqType, startDate, endDate) {
        return this.rqcService.getCtqDetails({ modelId, ctqType, startDate, endDate });
    }
    async getTqcEolSummary(modelId, startDate, endDate, cell) {
        return this.rqcService.getTqcEolSummary({ modelId, startDate, endDate, cell });
    }
    async getRecentInspections(modelId, areaId, startDate, endDate, checkingTime, factoryId, cell) {
        return this.rqcService.getRecentInspections({ modelId, areaId, startDate, endDate, checkingTime, factoryId, cell });
    }
    async getHeaderCells(modelId) {
        return this.rqcService.getHeaderCells(modelId);
    }
    async getFilters() {
        return this.rqcService.getDashboardFilterOptions();
    }
    async getImmediateActions(modelId, startDate, endDate, factoryId, cell, areaName) {
        return this.rqcService.getImmediateActionData({ modelId, startDate, endDate, factoryId, cell, areaName });
    }
    async getAllHeaders(model, modelId, startDate, endDate, checkingTime, inspector, factoryId, cell) {
        return this.rqcService.getAllHeaders({ model, modelId, startDate, endDate, checkingTime, inspector, factoryId, cell });
    }
    async getHeadersByModel(model, modelId, startDate, endDate, checkingTime, inspector, factoryId, cell, groupModelId, page, pageSize) {
        return this.rqcService.getHeadersByModel({ model, modelId, startDate, endDate, checkingTime, inspector, factoryId, cell, groupModelId, page, pageSize });
    }
    async updateHeader(headerId, dto) {
        return this.rqcService.updateHeader(headerId, dto);
    }
    async deleteHeader(headerId) {
        return this.rqcService.deleteHeader(headerId);
    }
    async submitInspection(headerId, areaId, processId, dto) {
        return this.rqcService.submitProcessInspection(headerId, areaId, processId, dto);
    }
    async deleteInspection(headerId, areaId, processId) {
        return this.rqcService.deleteProcessInspection(headerId, areaId, processId);
    }
    async getHeader(headerId) {
        return this.rqcService.getHeaderSession(headerId);
    }
};
exports.RqcController = RqcController;
__decorate([
    (0, common_1.Post)('headers'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rqc_dto_1.CreateHeaderDto]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "createHeader", null);
__decorate([
    (0, common_1.Post)('import'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rqc_dto_1.ImportInspectionsDto]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "importInspections", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('areaId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('checkingTime')),
    __param(5, (0, common_1.Query)('factoryId')),
    __param(6, (0, common_1.Query)('cell')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getKpis", null);
__decorate([
    (0, common_1.Get)('trends'),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('areaId')),
    __param(2, (0, common_1.Query)('areaName')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __param(5, (0, common_1.Query)('factoryId')),
    __param(6, (0, common_1.Query)('cell')),
    __param(7, (0, common_1.Query)('checkingTime')),
    __param(8, (0, common_1.Query)('processName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getTrends", null);
__decorate([
    (0, common_1.Get)('dashboard/cap-data'),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('factoryId')),
    __param(4, (0, common_1.Query)('cell')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getCapData", null);
__decorate([
    (0, common_1.Get)('process-defects'),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('factoryId')),
    __param(4, (0, common_1.Query)('cell')),
    __param(5, (0, common_1.Query)('checkingTime')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getProcessDefects", null);
__decorate([
    (0, common_1.Get)('defect-ctq-summary'),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('cell')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getDefectCtqSummary", null);
__decorate([
    (0, common_1.Get)('ctq-details'),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('ctqType')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getCtqDetails", null);
__decorate([
    (0, common_1.Get)('tqc-eol-summary'),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('cell')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getTqcEolSummary", null);
__decorate([
    (0, common_1.Get)('recent-inspections'),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('areaId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('checkingTime')),
    __param(5, (0, common_1.Query)('factoryId')),
    __param(6, (0, common_1.Query)('cell')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getRecentInspections", null);
__decorate([
    (0, common_1.Get)('header-cells'),
    __param(0, (0, common_1.Query)('modelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getHeaderCells", null);
__decorate([
    (0, common_1.Get)('filters'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getFilters", null);
__decorate([
    (0, common_1.Get)('immediate-actions'),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('factoryId')),
    __param(4, (0, common_1.Query)('cell')),
    __param(5, (0, common_1.Query)('areaName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getImmediateActions", null);
__decorate([
    (0, common_1.Get)('headers'),
    __param(0, (0, common_1.Query)('model')),
    __param(1, (0, common_1.Query)('modelId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('checkingTime')),
    __param(5, (0, common_1.Query)('inspector')),
    __param(6, (0, common_1.Query)('factoryId')),
    __param(7, (0, common_1.Query)('cell')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getAllHeaders", null);
__decorate([
    (0, common_1.Get)('headers/by-model'),
    __param(0, (0, common_1.Query)('model')),
    __param(1, (0, common_1.Query)('modelId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('checkingTime')),
    __param(5, (0, common_1.Query)('inspector')),
    __param(6, (0, common_1.Query)('factoryId')),
    __param(7, (0, common_1.Query)('cell')),
    __param(8, (0, common_1.Query)('groupModelId')),
    __param(9, (0, common_1.Query)('page')),
    __param(10, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getHeadersByModel", null);
__decorate([
    (0, common_1.Put)('headers/:headerId'),
    __param(0, (0, common_1.Param)('headerId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rqc_dto_1.UpdateHeaderDto]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "updateHeader", null);
__decorate([
    (0, common_1.Delete)('headers/:headerId'),
    __param(0, (0, common_1.Param)('headerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "deleteHeader", null);
__decorate([
    (0, common_1.Post)('headers/:headerId/areas/:areaId/processes/:processId/inspections'),
    __param(0, (0, common_1.Param)('headerId')),
    __param(1, (0, common_1.Param)('areaId')),
    __param(2, (0, common_1.Param)('processId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, rqc_dto_1.CreateInspectionDto]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "submitInspection", null);
__decorate([
    (0, common_1.Delete)('headers/:headerId/areas/:areaId/processes/:processId/inspections'),
    __param(0, (0, common_1.Param)('headerId')),
    __param(1, (0, common_1.Param)('areaId')),
    __param(2, (0, common_1.Param)('processId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "deleteInspection", null);
__decorate([
    (0, common_1.Get)('headers/:headerId'),
    __param(0, (0, common_1.Param)('headerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RqcController.prototype, "getHeader", null);
exports.RqcController = RqcController = __decorate([
    (0, common_1.Controller)('rqc'),
    __metadata("design:paramtypes", [rqc_service_1.RqcService,
        rqc_import_service_1.RqcImportService])
], RqcController);
//# sourceMappingURL=rqc.controller.js.map