"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CtqSetupModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const ctq_setup_controller_1 = require("./ctq-setup.controller");
const ctq_setup_service_1 = require("./ctq-setup.service");
let CtqSetupModule = class CtqSetupModule {
};
exports.CtqSetupModule = CtqSetupModule;
exports.CtqSetupModule = CtqSetupModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [ctq_setup_controller_1.CtqSetupController],
        providers: [ctq_setup_service_1.CtqSetupService],
    })
], CtqSetupModule);
//# sourceMappingURL=ctq-setup.module.js.map