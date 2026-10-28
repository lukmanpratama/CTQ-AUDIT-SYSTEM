// How a queued change alters a header, the same way the API stores it. Used to show changes not
// sent yet (inspection-repository) and to fold a sent change into the copy kept on the device
// (sync-engine), so it doesn't vanish when the connection drops again before a refresh.

import type { SyncMutation } from './db';

// Same rule as the API (CAP_DAILY_THRESHOLD): a defect above 20% is a CAP
export const CAP_DAILY_RATE = 0.20;

/** Photo value of an inspection whose file is still only on the device (`local-photo:<photoId>`). */
export const LOCAL_PHOTO = 'local-photo:';

/** Applies one change to `view` (a header shaped like GET /api/rqc/headers/:id), in place. */
export function applyMutation(view: any, item: SyncMutation) {
    view.rqcAreas = view.rqcAreas || [];

    if (item.type === 'updateHeader') {
        Object.assign(view, item.payload, {
            date: `${item.payload.date}T00:00:00.000Z`,
            factory: { ...(view.factory || {}), factoryId: item.payload.factoryId, factory: item.display?.factoryName ?? view.factory?.factory },
        });
        return;
    }
    if (item.type !== 'saveProcess' && item.type !== 'deleteProcess') return;

    let area = view.rqcAreas.find((a: any) => String(a.setupAreaId) === String(item.setupAreaId));
    if (item.type === 'deleteProcess') {
        if (area) area.rqcProcesses = (area.rqcProcesses || []).filter((p: any) => String(p.setupProcessId) !== String(item.setupProcessId));
        return;
    }
    if (!area) {
        area = { rqcAreaId: `local-area-${item.setupAreaId}`, setupAreaId: item.setupAreaId, rqcProcesses: [] };
        view.rqcAreas.push(area);
    }
    area.rqcProcesses = area.rqcProcesses || [];
    let proc = area.rqcProcesses.find((p: any) => String(p.setupProcessId) === String(item.setupProcessId));
    if (!proc) {
        proc = {
            rqcProcessId: `local-process-${item.setupProcessId}`,
            setupProcessId: item.setupProcessId,
            rqcInspections: [],
            setupProcess: { masterProcess: { process: item.display?.processName } },
        };
        area.rqcProcesses.push(proc);
    }
    const { qtyChecking, defects } = item.payload;
    proc.qtyChecking = qtyChecking;
    proc.rqcInspections = proc.rqcInspections || [];
    // Same rule as the API: only the defects sent are inserted / updated, missing fields are kept
    for (const d of defects) {
        const defectRate = qtyChecking > 0 ? d.qtyDefect / qtyChecking : 0;
        let insp = proc.rqcInspections.find((i: any) => String(i.defectId) === String(d.defectId));
        if (!insp) {
            insp = { rqcInspectionId: `local-${item.setupProcessId}-${d.defectId}`, defectId: d.defectId };
            proc.rqcInspections.push(insp);
        }
        Object.assign(insp, {
            qtyDefect: d.qtyDefect,
            defectRate,
            passRate: Math.max(0, 1 - defectRate),
            status: defectRate > CAP_DAILY_RATE ? 'CAP' : 'IMMEDIATE_ACTION',
        });
        for (const key of ['actionPlan', 'rootCause', 'corrective', 'durasiStopline', 'photoDefect', 'photoAfterActionPlan'] as const) {
            if (d[key] !== undefined) insp[key] = d[key];
        }
    }
}
