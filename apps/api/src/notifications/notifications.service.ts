import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CAP_DAILY_THRESHOLD, CAP_WEEKLY_THRESHOLD } from '../common/cap-thresholds';
import { modelLabel } from '../common/model-match';
import { PushService } from './push.service';

/** One alert as the app shows it in the "QDRS — ALERT DEFECT RATE" popup. */
export interface CapNotification {
    id: string;
    type: 'DAILY' | 'WEEKLY';
    title: string;
    setupModelId: string | null;
    modelLabel: string | null;
    factory: string | null;
    cell: string | null;
    process: string | null;
    defect: string | null;
    defectRate: number;
    inspectionDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    rqcHeaderId: string | null;
    createdAt: string;
}

// Weekly check interval: Monday's alert appears within this time, and late entries for last week still count
const WEEKLY_CHECK_MS = 15 * 60 * 1000;

/** Local calendar date as YYYY-MM-DD (the server runs in the factory's time zone). */
const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const pct = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;
const shortDate = (ymdStr: string) =>
    new Date(`${ymdStr}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * CAP alerts for everyone who has the app open.
 * DAILY: written when an inspection is saved with a defect above CAP_DAILY_THRESHOLD.
 * WEEKLY: written once per model per week when last week's average is above CAP_WEEKLY_THRESHOLD.
 * The table is created here (like TqcService's columns) so no Prisma migration / generate is needed.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(NotificationsService.name);
    private weeklyTimer?: NodeJS.Timeout;

    /** Newest alert id, sent with GET /data-version so open pages notice new alerts on their usual poll. */
    latestId = '0';

    constructor(private readonly prisma: PrismaService, private readonly push: PushService) { }

    async onModuleInit() {
        try {
            await this.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS cap_notification (
                    id BIGSERIAL PRIMARY KEY,
                    type VARCHAR(10) NOT NULL,
                    dedupe_key VARCHAR(200) NOT NULL UNIQUE,
                    title VARCHAR(200) NOT NULL,
                    setup_model_id BIGINT,
                    model_label VARCHAR(200),
                    factory VARCHAR(100),
                    cell VARCHAR(50),
                    process VARCHAR(150),
                    defect VARCHAR(200),
                    defect_rate NUMERIC(8,5) NOT NULL,
                    inspection_date DATE,
                    period_start DATE,
                    period_end DATE,
                    rqc_header_id UUID,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )`);
            await this.prisma.$executeRawUnsafe(
                `CREATE INDEX IF NOT EXISTS idx_cap_notification_created ON cap_notification (created_at)`,
            );
            this.logger.log('DB migration: cap_notification table ensured');
            const [{ max }] = await this.prisma.$queryRaw<{ max: bigint | null }[]>`SELECT MAX(id) AS max FROM cap_notification`;
            this.latestId = String(max ?? 0);
        } catch (e: any) {
            this.logger.warn('cap_notification table check skipped: ' + e.message);
        }

        // Catch up at startup (the PC may have been off on Monday), then keep checking
        this.runWeeklyCheck();
        this.weeklyTimer = setInterval(() => this.runWeeklyCheck(), WEEKLY_CHECK_MS);
    }

    onModuleDestroy() {
        if (this.weeklyTimer) clearInterval(this.weeklyTimer);
    }

    /**
     * DAILY CAP: one alert per defect of this process whose rate is above the daily threshold.
     * Saving the same process again (an edit) doesn't repeat an alert (dedupe on process + defect).
     */
    async notifyDailyCap(rqcProcessId: string) {
        const rows = await this.prisma.rqcInspection.findMany({
            where: { rqcProcessId, defectRate: { gt: CAP_DAILY_THRESHOLD } },
            select: {
                defectId: true,
                defectRate: true,
                masterDefect: { select: { defect: true } },
                rqcProcess: {
                    select: {
                        setupProcess: { select: { masterProcess: { select: { process: true } } } },
                        rqcArea: {
                            select: {
                                rqcHeader: {
                                    select: {
                                        rqcHeaderId: true, date: true, cell: true, setupModelId: true,
                                        factory: { select: { factory: true } },
                                        setupModel: { select: { modelName: true, modelNo: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        for (const row of rows) {
            const header = row.rqcProcess.rqcArea.rqcHeader;
            await this.insert({
                type: 'DAILY',
                dedupeKey: `DAILY:${rqcProcessId}:${row.defectId}`,
                title: `Defect Rate Melebihi ${CAP_DAILY_THRESHOLD * 100}%`,
                setupModelId: header.setupModelId,
                modelLabel: modelLabel(header.setupModel),
                factory: header.factory?.factory ?? null,
                cell: header.cell,
                process: row.rqcProcess.setupProcess.masterProcess.process,
                defect: row.masterDefect.defect,
                defectRate: Number(row.defectRate),
                inspectionDate: header.date.toISOString().slice(0, 10),
                rqcHeaderId: header.rqcHeaderId,
            });
        }
    }

    /**
     * WEEKLY CAP: last week's (Mon–Sun) average RQC defect rate per model — total defects /
     * total checked. One alert per model per week; checked repeatedly, so data entered late
     * for last week still counts, and a missed Monday is caught up on the next run.
     */
    async runWeeklyCheck(now = new Date()) {
        try {
            const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
            const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
            const lastSunday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 1);
            const [start, end] = [ymd(lastMonday), ymd(lastSunday)];

            const models = await this.prisma.$queryRaw<{ setup_model_id: bigint; checks: number; defects: number }[]>`
                SELECT h.setup_model_id,
                       COALESCE(SUM(p.qty_checking), 0)::int AS checks,
                       COALESCE(SUM((SELECT SUM(i.qty_defect) FROM rqc_inspection i WHERE i.rqc_process_id = p.rqc_process_id)), 0)::int AS defects
                FROM rqc_header h
                JOIN rqc_area a ON a.rqc_header_id = h.rqc_header_id
                JOIN rqc_process p ON p.rqc_area_id = a.rqc_area_id
                WHERE h.date BETWEEN ${start}::date AND ${end}::date
                GROUP BY h.setup_model_id`;

            const over = models.filter(m => m.checks > 0 && m.defects / m.checks > CAP_WEEKLY_THRESHOLD);
            if (over.length === 0) return;
            const labels = await this.prisma.setupModel.findMany({
                where: { setupModelId: { in: over.map(m => m.setup_model_id) } },
                select: { setupModelId: true, modelName: true, modelNo: true },
            });
            const labelById = new Map(labels.map(l => [String(l.setupModelId), modelLabel(l)]));

            for (const m of over) {
                await this.insert({
                    type: 'WEEKLY',
                    dedupeKey: `WEEKLY:${m.setup_model_id}:${start}`,
                    title: `Rata-rata Defect Rate Minggu Lalu Melebihi ${CAP_WEEKLY_THRESHOLD * 100}%`,
                    setupModelId: m.setup_model_id,
                    modelLabel: labelById.get(String(m.setup_model_id)) ?? null,
                    defectRate: m.defects / m.checks,
                    periodStart: start,
                    periodEnd: end,
                });
            }
        } catch (e: any) {
            this.logger.warn('Weekly CAP check failed: ' + e.message);
        }
    }

    /**
     * Alerts for the popup. With `afterId`: everything newer (what this phone hasn't seen).
     * Without (first visit on this phone): today's-ish daily alerts (last 24h) and this week's weekly alerts.
     */
    async list(afterId?: string): Promise<{ latestId: string; items: CapNotification[] }> {
        const after = afterId && /^\d+$/.test(afterId) ? BigInt(afterId) : null;
        // Start of this week in the server's (factory's) time zone; Postgres runs in UTC
        const now = new Date();
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
        const rows = after !== null
            ? await this.prisma.$queryRaw<any[]>`
                SELECT * FROM cap_notification WHERE id > ${after} ORDER BY id LIMIT 50`
            : await this.prisma.$queryRaw<any[]>`
                SELECT * FROM cap_notification
                WHERE (type = 'DAILY' AND created_at > now() - interval '24 hours')
                   OR (type = 'WEEKLY' AND created_at >= ${weekStart})
                ORDER BY id LIMIT 50`;
        const date = (v: Date | null) => (v ? v.toISOString().slice(0, 10) : null);
        return {
            latestId: this.latestId,
            items: rows.map(r => ({
                id: String(r.id),
                type: r.type,
                title: r.title,
                setupModelId: r.setup_model_id != null ? String(r.setup_model_id) : null,
                modelLabel: r.model_label,
                factory: r.factory,
                cell: r.cell,
                process: r.process,
                defect: r.defect,
                defectRate: Number(r.defect_rate),
                inspectionDate: date(r.inspection_date),
                periodStart: date(r.period_start),
                periodEnd: date(r.period_end),
                rqcHeaderId: r.rqc_header_id,
                createdAt: new Date(r.created_at).toISOString(),
            })),
        };
    }

    private async insert(n: {
        type: 'DAILY' | 'WEEKLY'; dedupeKey: string; title: string; setupModelId: bigint | null; modelLabel: string | null;
        factory?: string | null; cell?: string | null; process?: string | null; defect?: string | null; defectRate: number;
        inspectionDate?: string | null; periodStart?: string | null; periodEnd?: string | null; rqcHeaderId?: string | null;
    }) {
        // ON CONFLICT: an alert that already exists (same dedupe key) is not sent again
        const inserted = await this.prisma.$queryRaw<{ id: bigint }[]>`
            INSERT INTO cap_notification
                (type, dedupe_key, title, setup_model_id, model_label, factory, cell, process, defect, defect_rate,
                 inspection_date, period_start, period_end, rqc_header_id)
            VALUES
                (${n.type}, ${n.dedupeKey}, ${n.title}, ${n.setupModelId}, ${n.modelLabel}, ${n.factory ?? null}, ${n.cell ?? null},
                 ${n.process ?? null}, ${n.defect ?? null}, ${n.defectRate},
                 ${n.inspectionDate ?? null}::date, ${n.periodStart ?? null}::date, ${n.periodEnd ?? null}::date, ${n.rqcHeaderId ?? null}::uuid)
            ON CONFLICT (dedupe_key) DO NOTHING
            RETURNING id`;
        if (inserted.length === 0) return;
        const id = String(inserted[0].id);
        this.latestId = id;
        this.logger.log(`CAP ${n.type} alert: ${n.modelLabel} ${n.process ?? ''} ${(n.defectRate * 100).toFixed(2)}%`);

        // Browser notification on every subscribed phone. Not awaited: saving an inspection must not
        // wait on push services, and a push failure must not fail the save.
        const lines = n.type === 'DAILY'
            ? [
                n.title,
                `Factory/Cell: ${[n.factory, n.cell].filter(Boolean).join(' / ') || '-'}`,
                `Model: ${n.modelLabel || '-'}`,
                `Proses: ${n.process || '-'} — ${pct(n.defectRate)}`,
                ...(n.defect ? [`Defect: ${n.defect}`] : []),
            ]
            : [
                n.title,
                `Model: ${n.modelLabel || '-'}`,
                ...(n.periodStart && n.periodEnd ? [`Periode: ${shortDate(n.periodStart)} – ${shortDate(n.periodEnd)}`] : []),
                `Avg Defect Rate: ${pct(n.defectRate)}`,
            ];
        this.push.sendToAll({
            title: 'QDRS — ALERT DEFECT RATE',
            body: lines.join('\n'),
            url: n.type === 'DAILY' && n.rqcHeaderId ? `/audit/session/${n.rqcHeaderId}/summary?view=true` : '/',
            tag: `cap-${id}`,
        }).catch(e => this.logger.warn('Push send failed: ' + e.message));
    }
}
