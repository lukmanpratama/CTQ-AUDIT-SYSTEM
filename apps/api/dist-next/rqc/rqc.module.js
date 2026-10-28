"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RqcModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const rqc_controller_1 = require("./rqc.controller");
const rqc_service_1 = require("./rqc.service");
const rqc_import_service_1 = require("./rqc-import.service");
const notifications_module_1 = require("../notifications/notifications.module");
let RqcModule = class RqcModule {
};
exports.RqcModule = RqcModule;
exports.RqcModule = RqcModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, notifications_module_1.NotificationsModule],
        controllers: [rqc_controller_1.RqcController],
        providers: [rqc_service_1.RqcService, rqc_import_service_1.RqcImportService],
    })
], RqcModule);
//# sourceMappingURL=rqc.module.js.map