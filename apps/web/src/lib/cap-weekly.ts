// Weekly CAP: a defect in a process whose defect rate over one week (Mon-Sun, total defects /
// total checked of that process, all audits of the model) is above 5% needs a CAP.
// (Same threshold as the Monday alert: apps/api/src/common/cap-thresholds.ts.)
// The four stages of a CAP are the CAP fields of an inspection row (lib/followup.ts).

export const CAP_WEEKLY_RATE = 0.05;

export const CAP_STAGES = ['Foto defect', 'Root cause', 'Corrective action', 'Foto setelah action'] as const;

const filled = (v?: string | null) => !!v && String(v).trim() !== '';

/** The Monday (YYYY-MM-DD) of the week a day (YYYY-MM-DD) is in. */
export function weekStart(day: string): string {
    const d = new Date(day.slice(0, 10) + 'T00:00:00Z');
    const back = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - back);
    return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

export interface WeeklyCapRow {
    header: any;
    area: any;
    process: any;
    insp: any;
}

export interface WeeklyCapItem {
    key: string;
    week: string; // Monday
    setupAreaId: string;
    setupProcessId: string;
    defectId: string;
    checks: number;
    defects: number;
    rate: number;
    rows: WeeklyCapRow[]; // newest audit first
    /** Value of each stage: the newest non-empty one among the rows */
    values: { photoDefect: string; rootCause: string; corrective: string; photoAfterActionPlan: string };
    stages: boolean[]; // CAP_STAGES order
    progress: number;
}

/** Every (week, process, defect) with a defect, and its weekly rate. Items above the CAP rate are `isCap`. */
export function computeWeeklyCap(headers: any[]): WeeklyCapItem[] {
    type Acc = { checks: Map<string, number>; items: Map<string, WeeklyCapItem> };
    const weeks = new Map<string, Acc>();
    const sorted = [...(Array.isArray(headers) ? headers : [])].sort((a, b) =>
        String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));

    for (const h of sorted) {
        const week = weekStart(String(h.date));
        const acc = weeks.get(week) ?? { checks: new Map(), items: new Map() };
        weeks.set(week, acc);
        for (const area of h.rqcAreas ?? []) {
            for (const p of area.rqcProcesses ?? []) {
                const pk = String(p.setupProcessId);
                acc.checks.set(pk, (acc.checks.get(pk) ?? 0) + (p.qtyChecking || 0));
                for (const insp of p.rqcInspections ?? []) {
                    if (!(insp.qtyDefect > 0)) continue;
                    const key = `${week}|${pk}|${insp.defectId}`;
                    let it = acc.items.get(key);
                    if (!it) {
                        it = {
                            key, week, setupAreaId: String(area.setupAreaId), setupProcessId: pk, defectId: String(insp.defectId),
                            checks: 0, defects: 0, rate: 0, rows: [],
                            values: { photoDefect: '', rootCause: '', corrective: '', photoAfterActionPlan: '' },
                            stages: [false, false, false, false], progress: 0,
                        };
                        acc.items.set(key, it);
                    }
                    it.defects += insp.qtyDefect;
                    it.rows.push({ header: h, area, process: p, insp });
                    // rows are visited newest first: the first non-empty value is the newest
                    (Object.keys(it.values) as (keyof typeof it.values)[]).forEach(f => {
                        if (!it!.values[f] && filled(insp[f])) it!.values[f] = insp[f];
                    });
                }
            }
        }
    }

    const out: WeeklyCapItem[] = [];
    weeks.forEach(acc => acc.items.forEach(it => {
        it.checks = acc.checks.get(it.setupProcessId) ?? 0;
        it.rate = it.checks > 0 ? it.defects / it.checks : 0;
        it.stages = [!!it.values.photoDefect, !!it.values.rootCause, !!it.values.corrective, !!it.values.photoAfterActionPlan];
        it.progress = it.stages.filter(Boolean).length;
        out.push(it);
    }));
    return out;
}

/** Identifies one inspection row (a defect in a process of an audit). */
export const inspKey = (headerId: string, setupProcessId: string | number, defectId: string | number) =>
    `${headerId}|${setupProcessId}|${defectId}`;

export const isWeeklyCap = (it: WeeklyCapItem) => it.rate > CAP_WEEKLY_RATE;

/** Keys (inspKey) of the inspection rows that count as CAP (weekly rate above 5%). */
export function weeklyCapInspectionIds(items: WeeklyCapItem[]): Set<string> {
    const ids = new Set<string>();
    items.filter(isWeeklyCap).forEach(it => it.rows.forEach(r => ids.add(inspKey(r.header.rqcHeaderId, r.process.setupProcessId, r.insp.defectId))));
    return ids;
}
