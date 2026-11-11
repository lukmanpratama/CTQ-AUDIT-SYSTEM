import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CAP_DAILY_THRESHOLD, CAP_WEEKLY_THRESHOLD } from '../common/cap-thresholds';
import { modelLabel } from '../common/model-match';
import { PushService } from './push.service';

/** One alert as the app shows it in the "CAP — ALERT DEFECT RATE" popup. */
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

    /**
     * Inserts a weekly CAP notification if defect rate exceeds threshold.
     */
    async notifyWeeklyCap(data: {
        setupModelId: bigint;
        modelLabel: string | null;
        defectRate: number;
        periodStart: string;
        periodEnd: string;
        threshold: number;
    }) {
        await this.insert({
            type: 'WEEKLY',
            dedupeKey: `WEEKLY:${data.setupModelId}:${data.periodStart}`,
            title: `Rata-rata Defect Rate Minggu Lalu Melebihi ${data.threshold * 100}%`,
            setupModelId: data.setupModelId,
            modelLabel: data.modelLabel,
            defectRate: data.defectRate,
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
        });
    }

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

            // Find distinct models with RQC headers in the period
            const distinctModels = await this.prisma.$queryRaw<{ setup_model_id: bigint }[]>`
                SELECT DISTINCT h.setup_model_id
                FROM rqc_header h
                WHERE h.date BETWEEN ${start}::date AND ${end}::date`;

            if (distinctModels.length === 0) return;

            // Compute weekly defect rate using the exact formula of the dashboard weeklyTrend (avg of daily avgDefectRate)
            for (const dm of distinctModels) {
                const modelId = dm.setup_model_id;

                // 1. Fetch RqcProcesses in range
                const processes = await this.prisma.rqcProcess.findMany({
                    where: {
                        rqcArea: {
                            rqcHeader: {
                                setupModelId: modelId,
                                date: { gte: new Date(start), lte: new Date(end) }
                            }
                        }
                    },
                    include: {
                        rqcArea: { include: { rqcHeader: true } },
                        rqcInspections: { select: { qtyDefect: true } }
                    }
                });

                // 2. Fetch TQC records for this model in range
                const masterModel = await this.prisma.setupModel.findUnique({
                    where: { setupModelId: modelId },
                    select: { setupModelId: true, modelName: true, modelNo: true }
                });
                if (!masterModel) continue;

                const dailyMap = new Map<string, {
                    checking: number, defect: number, rqcChecking: number, rqcDefect: number,
                    rqcDefectRateSum: number, rqcProcessCount: number,
                    tqcProcessMap: Map<string, { defect: number, checking: number }>
                }>();

                if (masterModel.modelName) {
                    const { tqcWhereForModel } = require('../common/model-match');
                    const { tqcDayCellChecking, TQC_CHECK_PER_DAY } = require('../common/tqc-checking');

                    const tqcRecords = await this.prisma.tqcReport.findMany({
                        where: {
                            ...tqcWhereForModel(masterModel),
                            moduleType: 'ASSEMBLY',
                            date: { gte: new Date(start), lte: new Date(end) }
                        }
                    });

                    const dayCellChecking = tqcDayCellChecking(tqcRecords.filter((t: any) => t.date), (tqc: any) =>
                        `${tqc.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}_${tqc.cell || tqc.building || 'no-cell'}`);
                    const uniqueCheckingMap = new Map<string, number>();

                    for (const tqc of tqcRecords) {
                        const dateObj = tqc.date;
                        if (!dateObj) continue;
                        const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                        if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0, rqcDefectRateSum: 0, rqcProcessCount: 0, tqcProcessMap: new Map() });
                        const dStats = dailyMap.get(dateStr)!;

                        const isUspDefect = !!tqc.uspClassification?.trim();
                        if (isUspDefect) dStats.defect += (tqc.qtyDefect || 0);

                        const cellKey = tqc.cell || tqc.building || 'no-cell';
                        const uniqueDayCellKey = `${dateStr}_${cellKey}`;
                        if (!uniqueCheckingMap.has(uniqueDayCellKey)) {
                            const qtyDiff = dayCellChecking.get(uniqueDayCellKey) ?? TQC_CHECK_PER_DAY;
                            uniqueCheckingMap.set(uniqueDayCellKey, qtyDiff);
                            dStats.checking += qtyDiff;
                        }

                        if (!isUspDefect) continue;
                        const defectName = tqc.defectName || 'UNKNOWN';
                        if (!dStats.tqcProcessMap.has(defectName)) {
                            dStats.tqcProcessMap.set(defectName, { defect: 0, checking: 0 });
                        }
                        dStats.tqcProcessMap.get(defectName)!.defect += (tqc.qtyDefect || 0);
                        dStats.tqcProcessMap.get(defectName)!.checking = uniqueCheckingMap.get(uniqueDayCellKey) ?? TQC_CHECK_PER_DAY;
                    }
                }

                // 3. Aggregate RQC processes into dailyMap
                for (const p of processes) {
                    const dateObj = p.rqcArea?.rqcHeader?.date;
                    if (!dateObj) continue;
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                    if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { checking: 0, defect: 0, rqcChecking: 0, rqcDefect: 0, rqcDefectRateSum: 0, rqcProcessCount: 0, tqcProcessMap: new Map() });
                    const dStats = dailyMap.get(dateStr)!;

                    const chk = p.qtyChecking || 0;
                    const def = p.rqcInspections.reduce((sum, i) => sum + (i.qtyDefect || 0), 0);
                    dStats.rqcChecking += chk;
                    dStats.rqcDefect += def;

                    const processDefectRate = chk > 0 ? (def / chk) * 100 : 0;
                    dStats.rqcDefectRateSum += parseFloat(processDefectRate.toFixed(2));
                    dStats.rqcProcessCount += 1;
                }

                if (dailyMap.size === 0) continue;

                // 4. Calculate daily avgDefectRate (dashboard formula)
                let weeklySum = 0;
                let dayCount = 0;
                for (const stats of dailyMap.values()) {
                    let tqcTotalDailyDefect = 0;
                    for (const proc of stats.tqcProcessMap.values()) {
                        tqcTotalDailyDefect += proc.defect;
                    }
                    const tqcDefectRate = stats.checking > 0 ? (tqcTotalDailyDefect / stats.checking) * 100 : 0;
                    const rqcDefectRate = stats.rqcProcessCount > 0 ? (stats.rqcDefectRateSum / stats.rqcProcessCount) : 0;
                    const avgDefectRate = (tqcDefectRate + rqcDefectRate) / 2;

                    weeklySum += avgDefectRate;
                    dayCount += 1;
                }

                const weeklyDefectRatePct = dayCount > 0 ? (weeklySum / dayCount) : 0;
                const weeklyDefectRateRatio = weeklyDefectRatePct / 100;

                if (weeklyDefectRateRatio > CAP_WEEKLY_THRESHOLD) {
                    await this.insert({
                        type: 'WEEKLY',
                        dedupeKey: `WEEKLY:${modelId}:${start}`,
                        title: `Rata-rata Defect Rate Minggu Lalu Melebihi ${CAP_WEEKLY_THRESHOLD * 100}%`,
                        setupModelId: modelId,
                        modelLabel: modelLabel(masterModel),
                        defectRate: weeklyDefectRateRatio,
                        periodStart: start,
                        periodEnd: end,
                    });
                }
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
            title: 'CAP — ALERT DEFECT RATE',
            body: lines.join('\n'),
            url: n.type === 'DAILY' && n.rqcHeaderId ? `/audit/session/${n.rqcHeaderId}/summary?view=true` : '/',
            tag: `cap-${id}`,
        }).catch(e => this.logger.warn('Push send failed: ' + e.message));
    }
}
