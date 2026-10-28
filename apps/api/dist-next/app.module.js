"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const cache_manager_1 = require("@nestjs/cache-manager");
const prisma_module_1 = require("./prisma/prisma.module");
const health_module_1 = require("./health/health.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const models_module_1 = require("./models/models.module");
const po_module_1 = require("./po/po.module");
const master_module_1 = require("./master/master.module");
const ctq_setup_module_1 = require("./ctq-setup/ctq-setup.module");
const rqc_module_1 = require("./rqc/rqc.module");
const files_module_1 = require("./files/files.module");
const tqc_module_1 = require("./tqc/tqc.module");
const tqc_setup_defect_module_1 = require("./tqc-setup-defect/tqc-setup-defect.module");
const notifications_module_1 = require("./notifications/notifications.module");
const data_version_module_1 = require("./data-version/data-version.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env', '../../.env'],
            }),
            cache_manager_1.CacheModule.register({
                isGlobal: true,
                ttl: 60 * 1000,
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 100,
                },
            ]),
            prisma_module_1.PrismaModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            master_module_1.MasterModule,
            models_module_1.ModelsModule,
            po_module_1.PoModule,
            ctq_setup_module_1.CtqSetupModule,
            rqc_module_1.RqcModule,
            files_module_1.FilesModule,
            tqc_module_1.TqcModule,
            tqc_setup_defect_module_1.TqcSetupDefectModule,
            data_version_module_1.DataVersionModule,
            notifications_module_1.NotificationsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map