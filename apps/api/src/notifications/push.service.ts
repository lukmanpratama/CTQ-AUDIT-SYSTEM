import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

/** What the browser's service worker turns into a system notification (see apps/web/public/sw.js). */
export interface PushPayload {
    title: string;
    body: string;
    /** Page opened when the notification is tapped */
    url: string;
    /** Same tag = replaces the older notification instead of stacking a duplicate */
    tag: string;
}

/** A browser's PushSubscription as JSON (subscription.toJSON()). */
export interface BrowserPushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

/**
 * Browser (Web Push) notifications: the phone shows them like an app notification, also when
 * the app is closed. Each browser that allowed notifications stores a subscription here; every
 * CAP alert is pushed to all of them.
 * The VAPID key pair that signs the pushes is generated once and kept in the database, so no
 * .env setup is needed. Changing it would invalidate every subscription.
 */
@Injectable()
export class PushService implements OnModuleInit {
    private readonly logger = new Logger(PushService.name);
    private publicKey: string | null = null;

    constructor(private readonly prisma: PrismaService) { }

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

            let [keys] = await this.prisma.$queryRaw<{ public_key: string; private_key: string }[]>`
                SELECT public_key, private_key FROM push_vapid WHERE id = 1`;
            if (!keys) {
                const generated = webpush.generateVAPIDKeys();
                // ON CONFLICT: a second API instance starting at the same time keeps the first pair
                await this.prisma.$executeRaw`
                    INSERT INTO push_vapid (id, public_key, private_key)
                    VALUES (1, ${generated.publicKey}, ${generated.privateKey})
                    ON CONFLICT (id) DO NOTHING`;
                [keys] = await this.prisma.$queryRaw<{ public_key: string; private_key: string }[]>`
                    SELECT public_key, private_key FROM push_vapid WHERE id = 1`;
                this.logger.log('Generated the Web Push (VAPID) key pair');
            }

            // Push services (Apple's included) want a contact URL or mailto: in the signed token
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'https://github.com/lukmanpratama/CTQ-AUDIT-SYSTEM',
                keys.public_key,
                keys.private_key,
            );
            this.publicKey = keys.public_key;
            this.logger.log('Web Push ready');
        } catch (e: any) {
            this.logger.warn('Web Push setup skipped: ' + e.message);
        }
    }

    /** Public VAPID key the browser needs to subscribe (null if push could not be set up). */
    getPublicKey() {
        return { publicKey: this.publicKey };
    }

    async subscribe(subscription: BrowserPushSubscription, userAgent?: string) {
        const { endpoint, keys } = subscription ?? ({} as BrowserPushSubscription);
        if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
            throw new BadRequestException('Invalid push subscription.');
        }
        // Re-subscribing (new keys for the same endpoint) replaces the old row
        await this.prisma.$executeRaw`
            INSERT INTO push_subscription (endpoint, p256dh, auth, user_agent)
            VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth}, ${userAgent ?? null})
            ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`;
        return { subscribed: true };
    }

    async unsubscribe(endpoint: string) {
        if (typeof endpoint === 'string') {
            await this.prisma.$executeRaw`DELETE FROM push_subscription WHERE endpoint = ${endpoint}`;
        }
        return { subscribed: false };
    }

    /**
     * Sends one notification to every subscribed browser. Never throws: a phone that is offline
     * gets it when it comes back (TTL), and a subscription the push service says is gone
     * (404/410: notifications turned off, app removed) is deleted.
     */
    async sendToAll(payload: PushPayload) {
        if (!this.publicKey) return;
        const subs = await this.prisma.$queryRaw<{ id: bigint; endpoint: string; p256dh: string; auth: string }[]>`
            SELECT id, endpoint, p256dh, auth FROM push_subscription`;
        if (subs.length === 0) return;

        const body = JSON.stringify(payload);
        const results = await Promise.allSettled(subs.map(s =>
            webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                body,
                { TTL: 24 * 60 * 60, urgency: 'high' },
            )));

        let sent = 0;
        const gone: bigint[] = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') { sent++; return; }
            const status = (r.reason as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) gone.push(subs[i].id);
            else this.logger.warn(`Push to ${new URL(subs[i].endpoint).host} failed: ${status ?? ''} ${(r.reason as Error)?.message}`);
        });
        if (gone.length > 0) {
            await this.prisma.$executeRaw`DELETE FROM push_subscription WHERE id = ANY(${gone}::bigint[])`;
        }
        if (sent > 0) {
            await this.prisma.$executeRaw`
                UPDATE push_subscription SET last_sent_at = now()
                WHERE id = ANY(${subs.filter((_, i) => results[i].status === 'fulfilled').map(s => s.id)}::bigint[])`;
        }
        this.logger.log(`Push "${payload.tag}": ${sent}/${subs.length} sent, ${gone.length} expired removed`);
    }
}
