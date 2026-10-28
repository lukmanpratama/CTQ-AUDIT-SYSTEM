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
exports.TqcSetupDefectController = void 0;
const common_1 = require("@nestjs/common");
const tqc_setup_defect_service_1 = require("./tqc-setup-defect.service");
const tqc_setup_defect_dto_1 = require("./tqc-setup-defect.dto");
let TqcSetupDefectController = class TqcSetupDefectController {
    constructor(tqcSetupDefectService) {
        this.tqcSetupDefectService = tqcSetupDefectService;
    }
    findAll() {
        return this.tqcSetupDefectService.findAll();
    }
    create(createDto) {
        return this.tqcSetupDefectService.create(createDto);
    }
    bulkCreate(createDtos) {
        return this.tqcSetupDefectService.bulkCreate(createDtos);
    }
    update(id, updateDto) {
        return this.tqcSetupDefectService.update(id, updateDto);
    }
    clearAll() {
        return this.tqcSetupDefectService.clearAll();
    }
    remove(id) {
        return this.tqcSetupDefectService.remove(id);
    }
};
exports.TqcSetupDefectController = TqcSetupDefectController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TqcSetupDefectController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tqc_setup_defect_dto_1.CreateSetupDefectTqcDto]),
    __metadata("design:returntype", void 0)
], TqcSetupDefectController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], TqcSetupDefectController.prototype, "bulkCreate", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, tqc_setup_defect_dto_1.UpdateSetupDefectTqcDto]),
    __metadata("design:returntype", void 0)
], TqcSetupDefectController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('bulk'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TqcSetupDefectController.prototype, "clearAll", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TqcSetupDefectController.prototype, "remove", null);
exports.TqcSetupDefectController = TqcSetupDefectController = __decorate([
    (0, common_1.Controller)('tqc-setup-defect'),
    __metadata("design:paramtypes", [tqc_setup_defect_service_1.TqcSetupDefectService])
], TqcSetupDefectController);
//# sourceMappingURL=tqc-setup-defect.controller.js.map