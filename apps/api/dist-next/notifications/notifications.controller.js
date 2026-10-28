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
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const notifications_service_1 = require("./notifications.service");
const push_service_1 = require("./push.service");
class PushSubscribeDto {
}
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PushSubscribeDto.prototype, "subscription", void 0);
class PushUnsubscribeDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PushUnsubscribeDto.prototype, "endpoint", void 0);
let NotificationsController = class NotificationsController {
    constructor(notificationsService, pushService) {
        this.notificationsService = notificationsService;
        this.pushService = pushService;
    }
    list(afterId) {
        return this.notificationsService.list(afterId);
    }
    pushKey() {
        return this.pushService.getPublicKey();
    }
    subscribe(dto, userAgent) {
        return this.pushService.subscribe(dto.subscription, userAgent);
    }
    unsubscribe(dto) {
        return this.pushService.unsubscribe(dto.endpoint);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('afterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('push-key'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "pushKey", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PushSubscribeDto, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Post)('unsubscribe'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PushUnsubscribeDto]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "unsubscribe", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService,
        push_service_1.PushService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map