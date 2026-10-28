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
exports.MasterController = void 0;
const common_1 = require("@nestjs/common");
const master_service_1 = require("./master.service");
const master_dto_1 = require("./dto/master.dto");
let MasterController = class MasterController {
    constructor(masterService) {
        this.masterService = masterService;
    }
    async getAreas() { return this.masterService.findAllAreas(); }
    async createArea(dto) { return this.masterService.createArea(dto); }
    async updateArea(id, dto) { return this.masterService.updateArea(BigInt(id), dto); }
    async deleteArea(id) { return this.masterService.deleteArea(BigInt(id)); }
    async getProcesses() { return this.masterService.findAllProcesses(); }
    async createProcess(dto) { return this.masterService.createProcess(dto); }
    async updateProcess(id, dto) { return this.masterService.updateProcess(BigInt(id), dto); }
    async deleteProcess(id) { return this.masterService.deleteProcess(BigInt(id)); }
    async getDefects() { return this.masterService.findAllDefects(); }
    async createDefect(dto) { return this.masterService.createDefect(dto); }
    async updateDefect(id, dto) { return this.masterService.updateDefect(BigInt(id), dto); }
    async deleteDefect(id) { return this.masterService.deleteDefect(BigInt(id)); }
    async getFactories() { return this.masterService.findAllFactories(); }
    async createFactory(dto) { return this.masterService.createFactory(dto); }
    async getPos(modelLike, setupModelId) { return this.masterService.findAllPos(modelLike, setupModelId); }
    async getPoFilterOptions(field, search, q, po, article, model, destination) {
        return this.masterService.findPoFilterOptions(field, search, { q, po, article, model, destination });
    }
    async getPosPaged(page, limit, q, po, article, model, destination) {
        return this.masterService.findPosPaged(parseInt(page || '1', 10), parseInt(limit || '100', 10), { q, po, article, model, destination });
    }
    async createPo(dto) { return this.masterService.createPo(dto); }
    async bulkCreatePos(dtos) {
        return this.masterService.bulkCreatePos(dtos);
    }
    async deleteAllPos() { return this.masterService.deleteAllPos(); }
    async updatePo(id, dto) { return this.masterService.updatePo(id, dto); }
    async deletePo(po) { return this.masterService.deletePo(po); }
    async getUsers() { return this.masterService.findAllUsers(); }
    async createUser(dto) { return this.masterService.createUser(dto); }
    async updateUser(nik, dto) { return this.masterService.updateUser(nik, dto); }
    async deleteUser(nik) { return this.masterService.deleteUser(nik); }
    async getUsps(modelId, status) {
        return this.masterService.findAllUsps(modelId ? BigInt(modelId) : undefined, status);
    }
    async createUsp(dto) { return this.masterService.createUsp(dto); }
    async updateUsp(id, dto) { return this.masterService.updateUsp(BigInt(id), dto); }
    async deleteUsp(id) { return this.masterService.deleteUsp(BigInt(id)); }
};
exports.MasterController = MasterController;
__decorate([
    (0, common_1.Get)('areas'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getAreas", null);
__decorate([
    (0, common_1.Post)('areas'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_dto_1.CreateAreaDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "createArea", null);
__decorate([
    (0, common_1.Put)('areas/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, master_dto_1.UpdateAreaDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "updateArea", null);
__decorate([
    (0, common_1.Delete)('areas/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "deleteArea", null);
__decorate([
    (0, common_1.Get)('processes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getProcesses", null);
__decorate([
    (0, common_1.Post)('processes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_dto_1.CreateProcessDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "createProcess", null);
__decorate([
    (0, common_1.Put)('processes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, master_dto_1.UpdateProcessDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "updateProcess", null);
__decorate([
    (0, common_1.Delete)('processes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "deleteProcess", null);
__decorate([
    (0, common_1.Get)('defects'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getDefects", null);
__decorate([
    (0, common_1.Post)('defects'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_dto_1.CreateDefectDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "createDefect", null);
__decorate([
    (0, common_1.Put)('defects/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, master_dto_1.UpdateDefectDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "updateDefect", null);
__decorate([
    (0, common_1.Delete)('defects/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "deleteDefect", null);
__decorate([
    (0, common_1.Get)('factories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getFactories", null);
__decorate([
    (0, common_1.Post)('factories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_dto_1.CreateFactoryDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "createFactory", null);
__decorate([
    (0, common_1.Get)('pos'),
    __param(0, (0, common_1.Query)('modelLike')),
    __param(1, (0, common_1.Query)('setupModelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getPos", null);
__decorate([
    (0, common_1.Get)('pos/filter-options'),
    __param(0, (0, common_1.Query)('field')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('po')),
    __param(4, (0, common_1.Query)('article')),
    __param(5, (0, common_1.Query)('model')),
    __param(6, (0, common_1.Query)('destination')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getPoFilterOptions", null);
__decorate([
    (0, common_1.Get)('pos/paged'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('po')),
    __param(4, (0, common_1.Query)('article')),
    __param(5, (0, common_1.Query)('model')),
    __param(6, (0, common_1.Query)('destination')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getPosPaged", null);
__decorate([
    (0, common_1.Post)('pos'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_dto_1.CreatePoDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "createPo", null);
__decorate([
    (0, common_1.Post)('pos/bulk'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "bulkCreatePos", null);
__decorate([
    (0, common_1.Delete)('pos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "deleteAllPos", null);
__decorate([
    (0, common_1.Put)('pos/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, master_dto_1.UpdatePoDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "updatePo", null);
__decorate([
    (0, common_1.Delete)('pos/:po'),
    __param(0, (0, common_1.Param)('po')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "deletePo", null);
__decorate([
    (0, common_1.Get)('users'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Post)('users'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "createUser", null);
__decorate([
    (0, common_1.Put)('users/:nik'),
    __param(0, (0, common_1.Param)('nik')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, master_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Delete)('users/:nik'),
    __param(0, (0, common_1.Param)('nik')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "deleteUser", null);
__decorate([
    (0, common_1.Get)('usps'),
    __param(0, (0, common_1.Query)('modelId')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "getUsps", null);
__decorate([
    (0, common_1.Post)('usps'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_dto_1.CreateUspDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "createUsp", null);
__decorate([
    (0, common_1.Put)('usps/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, master_dto_1.UpdateUspDto]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "updateUsp", null);
__decorate([
    (0, common_1.Delete)('usps/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "deleteUsp", null);
exports.MasterController = MasterController = __decorate([
    (0, common_1.Controller)('master'),
    __metadata("design:paramtypes", [master_service_1.MasterService])
], MasterController);
//# sourceMappingURL=master.controller.js.map