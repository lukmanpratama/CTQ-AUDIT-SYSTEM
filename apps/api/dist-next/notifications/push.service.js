"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const common_1 = require("@nestjs/common");
const webpush = __importStar(require("web-push"));
const prisma_service_1 = require("../prisma/prisma.service");
let PushService = PushService_1 = class PushService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(PushService_1.name);
        this.publicKey = null;
    }
    async onModuleInit() {
        try {
            await this.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS push_vapid (
                    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
                    public_key TEXT NOT NULL,
                    private_key TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )`);
            await this.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS push_subscription (
                    id BIGSERIAL PRIMARY KEY,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    user_agent TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    last_sent_at TIMESTAMPTZ
                )`);
            const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
            const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
            let [keys] = envPublic && envPrivate
                ? [{ public_key: envPublic, private_key: envPrivate }]
                : await this.prisma.$queryRaw `
                    SELECT public_key, private_key FROM push_vapid WHERE id = 1`;
            if (!keys) {
                const generated = webpush.generateVAPIDKeys();
                await this.prisma.$executeRaw `
                    INSERT INTO push_vapid (id, public_key, private_key)
                    VALUES (1, ${generated.publicKey}, ${generated.privateKey})
                    ON CONFLICT (id) DO NOTHING`;
                [keys] = await this.prisma.$queryRaw `
                    SELECT public_key, private_key FROM push_vapid WHERE id = 1`;
                this.logger.log('Generated the Web Push (VAPID) key pair');
            }
            webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@nihonesia.online', keys.public_key, keys.private_key);
            this.publicKey = keys.public_key;
            this.logger.log(`Web Push ready (VAPID keys from ${envPublic && envPrivate ? '.env' : 'database'})`);
        }
        catch (e) {
            this.logger.warn('Web Push setup skipped: ' + e.message);
        }
    }
    getPublicKey() {
        return { publicKey: this.publicKey };
    }
    async subscribe(subscription, userAgent) {
        const { endpoint, keys } = subscription ?? {};
        if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
            throw new common_1.BadRequestException('Invalid push subscription.');
        }
        await this.prisma.$executeRaw `
            INSERT INTO push_subscription (endpoint, p256dh, auth, user_agent)
            VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth}, ${userAgent ?? null})
            ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`;
        return { subscribed: true };
    }
    async unsubscribe(endpoint) {
        if (typeof endpoint === 'string') {
            await this.prisma.$executeRaw `DELETE FROM push_subscription WHERE endpoint = ${endpoint}`;
        }
        return { subscribed: false };
    }
    async sendToAll(payload) {
        if (!this.publicKey)
            return;
        const subs = await this.prisma.$queryRaw `
            SELECT id, endpoint, p256dh, auth FROM push_subscription`;
        if (subs.length === 0)
            return;
        const body = JSON.stringify(payload);
        const results = await Promise.allSettled(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 24 * 60 * 60, urgency: 'high' })));
        let sent = 0;
        const gone = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                sent++;
                return;
            }
            const status = r.reason?.statusCode;
            if (status === 404 || status === 410)
                gone.push(subs[i].id);
            else
                this.logger.warn(`Push to ${new URL(subs[i].endpoint).host} failed: ${status ?? ''} ${r.reason?.message}`);
        });
        if (gone.length > 0) {
            await this.prisma.$executeRaw `DELETE FROM push_subscription WHERE id = ANY(${gone}::bigint[])`;
        }
        if (sent > 0) {
            await this.prisma.$executeRaw `
                UPDATE push_subscription SET last_sent_at = now()
                WHERE id = ANY(${subs.filter((_, i) => results[i].status === 'fulfilled').map(s => s.id)}::bigint[])`;
        }
        this.logger.log(`Push "${payload.tag}": ${sent}/${subs.length} sent, ${gone.length} expired removed`);
    }
};
exports.PushService = PushService;
exports.PushService = PushService = PushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PushService);
//# sourceMappingURL=push.service.js.map