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
exports.TqcController = void 0;
const common_1 = require("@nestjs/common");
const tqc_service_1 = require("./tqc.service");
const tqc_dto_1 = require("./tqc.dto");
let TqcController = class TqcController {
    constructor(tqcService) {
        this.tqcService = tqcService;
    }
    async uploadExcelData(moduleType, body) {
        return this.tqcService.createMany(body, moduleType);
    }
    async getReportsByModule(moduleType) {
        return this.tqcService.getByModule(moduleType);
    }
    async updateUspClassification(id, body) {
        return this.tqcService.updateUspClassification(parseInt(id, 10), body?.uspClassification);
    }
    async updateRecord(id, body) {
        return this.tqcService.updateRecord(parseInt(id, 10), body);
    }
    async deleteRecord(id) {
        return this.tqcService.deleteRecord(parseInt(id, 10));
    }
    async deleteByModule(moduleType) {
        return this.tqcService.deleteByModule(moduleType);
    }
};
exports.TqcController = TqcController;
__decorate([
    (0, common_1.Post)(':moduleType/upload'),
    __param(0, (0, common_1.Param)('moduleType')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], TqcController.prototype, "uploadExcelData", null);
__decorate([
    (0, common_1.Get)(':moduleType'),
    __param(0, (0, common_1.Param)('moduleType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TqcController.prototype, "getReportsByModule", null);
__decorate([
    (0, common_1.Patch)(':id/usp'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TqcController.prototype, "updateUspClassification", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, tqc_dto_1.UpdateTqcRecordDto]),
    __metadata("design:returntype", Promise)
], TqcController.prototype, "updateRecord", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TqcController.prototype, "deleteRecord", null);
__decorate([
    (0, common_1.Delete)('bulk/:moduleType'),
    __param(0, (0, common_1.Param)('moduleType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TqcController.prototype, "deleteByModule", null);
exports.TqcController = TqcController = __decorate([
    (0, common_1.Controller)('tqc'),
    __metadata("design:paramtypes", [tqc_service_1.TqcService])
], TqcController);
//# sourceMappingURL=tqc.controller.js.map