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
var DataChangeInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataVersionModule = exports.DataVersionController = exports.DataChangeInterceptor = exports.DataVersionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cache_manager_1 = require("@nestjs/cache-manager");
const rxjs_1 = require("rxjs");
const notifications_module_1 = require("../notifications/notifications.module");
const notifications_service_1 = require("../notifications/notifications.service");
const IGNORED_WRITE_PATHS = ['/api/auth/', '/api/files/upload', '/api/notifications/'];
let DataVersionService = class DataVersionService {
    constructor() {
        this.bootId = Date.now().toString(36);
        this.counter = 0;
        this.changedAt = new Date().toISOString();
    }
    get current() {
        return { version: `${this.bootId}-${this.counter}`, changedAt: this.changedAt };
    }
    bump() {
        this.counter++;
        this.changedAt = new Date().toISOString();
    }
};
exports.DataVersionService = DataVersionService;
exports.DataVersionService = DataVersionService = __decorate([
    (0, common_1.Injectable)()
], DataVersionService);
let DataChangeInterceptor = DataChangeInterceptor_1 = class DataChangeInterceptor {
    constructor(dataVersion, cache) {
        this.dataVersion = dataVersion;
        this.cache = cache;
        this.logger = new common_1.Logger(DataChangeInterceptor_1.name);
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        const path = (req.originalUrl || req.url || '').split('?')[0];
        if (!isWrite || IGNORED_WRITE_PATHS.some(p => path.startsWith(p)))
            return next.handle();
        return next.handle().pipe((0, rxjs_1.tap)(async () => {
            this.dataVersion.bump();
            try {
                await this.cache.reset();
            }
            catch (err) {
                this.logger.warn(`Cache reset failed: ${err instanceof Error ? err.message : err}`);
            }
        }));
    }
};
exports.DataChangeInterceptor = DataChangeInterceptor;
exports.DataChangeInterceptor = DataChangeInterceptor = DataChangeInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [DataVersionService, Object])
], DataChangeInterceptor);
let DataVersionController = class DataVersionController {
    constructor(dataVersion, notifications) {
        this.dataVersion = dataVersion;
        this.notifications = notifications;
    }
    get() {
        return { ...this.dataVersion.current, alertId: this.notifications.latestId };
    }
};
exports.DataVersionController = DataVersionController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DataVersionController.prototype, "get", null);
exports.DataVersionController = DataVersionController = __decorate([
    (0, common_1.Controller)('data-version'),
    __metadata("design:paramtypes", [DataVersionService,
        notifications_service_1.NotificationsService])
], DataVersionController);
let DataVersionModule = class DataVersionModule {
};
exports.DataVersionModule = DataVersionModule;
exports.DataVersionModule = DataVersionModule = __decorate([
    (0, common_1.Module)({
        imports: [notifications_module_1.NotificationsModule],
        controllers: [DataVersionController],
        providers: [
            DataVersionService,
            { provide: core_1.APP_INTERCEPTOR, useClass: DataChangeInterceptor },
        ],
    })
], DataVersionModule);
//# sourceMappingURL=data-version.module.js.map