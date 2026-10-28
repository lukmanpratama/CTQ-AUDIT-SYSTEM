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
exports.CtqSetupController = void 0;
const common_1 = require("@nestjs/common");
const ctq_setup_dto_1 = require("./dto/ctq-setup.dto");
const ctq_setup_service_1 = require("./ctq-setup.service");
let CtqSetupController = class CtqSetupController {
    constructor(ctqSetupService) {
        this.ctqSetupService = ctqSetupService;
    }
    async getModels() {
        return this.ctqSetupService.findAllModels();
    }
    async getModelTree(modelId) {
        return this.ctqSetupService.findSetupByModel(modelId);
    }
    async getPicture(modelId, res) {
        return this.sendModelFile(res, await this.ctqSetupService.getModelFile(modelId, 'picture'));
    }
    async getAuditFile(modelId, res) {
        return this.sendModelFile(res, await this.ctqSetupService.getModelFile(modelId, 'internalAuditFile'));
    }
    sendModelFile(res, file) {
        if (file.redirect)
            return res.redirect(file.redirect);
        res.set({
            'Content-Type': file.mime,
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
            'Cache-Control': 'private, max-age=86400',
        });
        return res.send(file.body);
    }
    async validatePo(modelId, po) {
        return this.ctqSetupService.validatePo(modelId, po);
    }
    async createModel(body) {
        return this.ctqSetupService.createModel(body);
    }
    async uploadPicture(modelId, body) {
        return this.ctqSetupService.updateModelPicture(modelId, body.pictureBase64);
    }
    async uploadAuditFile(modelId, body) {
        return this.ctqSetupService.updateModelAuditFile(modelId, body.auditFileBase64);
    }
    async updateModel(modelId, body) {
        return this.ctqSetupService.updateModel(modelId, body);
    }
    async linkArea(modelId, body) {
        return this.ctqSetupService.linkAreaToModel(modelId, body.areaId);
    }
    async linkProcess(setupAreaId, body) {
        return this.ctqSetupService.linkProcessToArea(setupAreaId, body.processId);
    }
    async updateProcess(setupProcessId, body) {
        return this.ctqSetupService.updateSetupProcess(setupProcessId, body);
    }
    async linkDefect(setupProcessId, body) {
        return this.ctqSetupService.linkDefectToProcess(setupProcessId, body.defectId);
    }
    async removeArea(setupAreaId) {
        return this.ctqSetupService.removeSetupArea(setupAreaId);
    }
    async removeProcess(setupProcessId) {
        return this.ctqSetupService.removeSetupProcess(setupProcessId);
    }
    async removeDefect(setupDefectId) {
        return this.ctqSetupService.removeSetupDefect(setupDefectId);
    }
};
exports.CtqSetupController = CtqSetupController;
__decorate([
    (0, common_1.Get)('models'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "getModels", null);
__decorate([
    (0, common_1.Get)('models/:modelId/tree'),
    __param(0, (0, common_1.Param)('modelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "getModelTree", null);
__decorate([
    (0, common_1.Get)('models/:modelId/picture'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "getPicture", null);
__decorate([
    (0, common_1.Get)('models/:modelId/audit-file'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "getAuditFile", null);
__decorate([
    (0, common_1.Get)('models/:modelId/validate-po'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Query)('po')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "validatePo", null);
__decorate([
    (0, common_1.Post)('models'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ctq_setup_dto_1.CreateModelDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "createModel", null);
__decorate([
    (0, common_1.Post)('models/:modelId/picture'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ctq_setup_dto_1.UploadPictureDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "uploadPicture", null);
__decorate([
    (0, common_1.Post)('models/:modelId/audit-file'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ctq_setup_dto_1.UploadAuditFileDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "uploadAuditFile", null);
__decorate([
    (0, common_1.Patch)('models/:modelId'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ctq_setup_dto_1.UpdateModelDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "updateModel", null);
__decorate([
    (0, common_1.Post)('models/:modelId/areas'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ctq_setup_dto_1.LinkAreaDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "linkArea", null);
__decorate([
    (0, common_1.Post)('areas/:setupAreaId/processes'),
    __param(0, (0, common_1.Param)('setupAreaId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ctq_setup_dto_1.LinkProcessDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "linkProcess", null);
__decorate([
    (0, common_1.Patch)('processes/:setupProcessId'),
    __param(0, (0, common_1.Param)('setupProcessId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ctq_setup_dto_1.UpdateSetupProcessDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "updateProcess", null);
__decorate([
    (0, common_1.Post)('processes/:setupProcessId/defects'),
    __param(0, (0, common_1.Param)('setupProcessId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ctq_setup_dto_1.LinkDefectDto]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "linkDefect", null);
__decorate([
    (0, common_1.Delete)('areas/:setupAreaId'),
    __param(0, (0, common_1.Param)('setupAreaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "removeArea", null);
__decorate([
    (0, common_1.Delete)('processes/:setupProcessId'),
    __param(0, (0, common_1.Param)('setupProcessId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "removeProcess", null);
__decorate([
    (0, common_1.Delete)('defects/:setupDefectId'),
    __param(0, (0, common_1.Param)('setupDefectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CtqSetupController.prototype, "removeDefect", null);
exports.CtqSetupController = CtqSetupController = __decorate([
    (0, common_1.Controller)('ctq-setup'),
    __metadata("design:paramtypes", [ctq_setup_service_1.CtqSetupService])
], CtqSetupController);
//# sourceMappingURL=ctq-setup.controller.js.map