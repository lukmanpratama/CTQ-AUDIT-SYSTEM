import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RqcImportRow } from './rqc.dto';
import { modelLabel, normalizeArticle } from '../common/model-match';

const MAX_ROWS = 5000;
const MAX_ERRORS = 200;

// Loose key for matching names typed in Excel against master/setup data:
// ignores case, spaces, hyphens and non-breaking spaces ("RE CUTTING" == "RE-CUTTING", "NO SEW" == "NOSEW").
const looseKey = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const clean = (s: unknown) => {
    const v = String(s ?? '').replace(/ /g, ' ').trim();
    return v ? v : null;
};

interface PlannedDefect { rowNo: number; defectId: bigint; defectName: string; qtyDefect: number; actionPlan: string | null; rootCause: string | null; corrective: string | null; durasiStopline: number | null; photoDefect: string | null; photoAfterActionPlan: string | null; }
interface PlannedProcess { setupAreaId: bigint; setupProcessId: bigint; processName: string; qtyChecking: number; defects: Map<string, PlannedDefect>; }
interface PlannedAudit { key: string; rowNos: number[]; date: string; checkingTime: string; nik: string; setupModelId: bigint; modelName: string; po: string; factoryName: string; cell: string; processes: Map<string, PlannedProcess>; }

/**
 * Bulk import of RQC audits from the Excel template on the admin Inspection Report page.
 * Always validates everything first; writes only when `apply` is true and there are no errors,
 * in a single transaction. Audits that already exist (same model, date, checking time,
 * factory, cell and PO) are skipped, so the same file can be imported twice safely.
 */
@Injectable()
export class RqcImportService {
    private readonly logger = new Logger(RqcImportService.name);

    constructor(private readonly prisma: PrismaService) { }

    async importInspections(rows: RqcImportRow[], apply: boolean) {
        if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('No rows to import.');
        if (rows.length > MAX_ROWS) throw new BadRequestException(`Too many rows (${rows.length}). Maximum is ${MAX_ROWS} per import.`);

        const errors: { row: number; message: string }[] = [];
        let errorCount = 0; // counts every error, also the ones beyond MAX_ERRORS that are not returned
        const addError = (row: number, message: string) => { errorCount++; if (errors.length < MAX_ERRORS) errors.push({ row, message }); };

        // ---- Reference data ----------------------------------------------------
        const models = await this.prisma.setupModel.findMany({
            include: {
                articles: { select: { article: true } },
                setupAreas: {
                    include: {
                        masterArea: true,
                        setupProcesses: { include: { masterProcess: true, setupDefects: true } },
                    },
                },
            },
        });
        // Several Model Nos can share one name; the PO's article (or a Model No typed in MODEL) decides which one
        type SetupModelRef = typeof models[number];
        const modelsByName = new Map<string, SetupModelRef[]>();
        for (const m of models) {
            const k = looseKey(m.modelName);
            modelsByName.set(k, [...(modelsByName.get(k) || []), m]);
        }
        const modelByNo = new Map(models.filter(m => m.modelNo).map(m => [looseKey(m.modelNo), m]));
        const modelByArticle = new Map(models.flatMap(m => m.articles.map(a => [normalizeArticle(a.article), m] as const)));
        const resolveModel = (input: unknown, poArticle?: string): { model?: SetupModelRef; error?: string } => {
            const key = looseKey(input);
            const byNo = modelByNo.get(key);
            if (byNo) return { model: byNo };
            const candidates = modelsByName.get(key) || [];
            if (candidates.length === 0) return { error: `Model "${input}" is not in Setup CTQ.` };
            const byArticle = poArticle ? modelByArticle.get(normalizeArticle(poArticle)) : undefined;
            if (byArticle && candidates.includes(byArticle)) return { model: byArticle };
            if (candidates.length === 1) return { model: candidates[0] };
            return {
                error: `Model "${input}" has several Model Nos (${candidates.map(c => c.modelNo || 'no Model No').join(', ')}). ` +
                    `Add article ${poArticle || '(of this PO)'} to the right one in Setup CTQ, or put the Model No in MODEL.`,
            };
        };
        const masterDefects = await this.prisma.masterDefect.findMany();
        const defectByKey = new Map(masterDefects.map(d => [looseKey(d.defect), d]));
        const factories = await this.prisma.masterFactory.findMany();
        const factoryByKey = new Map(factories.map(f => [looseKey(f.factory), f]));
        const niks = [...new Set(rows.map(r => clean(r.nik)).filter(Boolean) as string[])];
        const users = await this.prisma.masterUser.findMany({ where: { nik: { in: niks } }, select: { nik: true } });
        const userNiks = new Set(users.map(u => u.nik));
        const poNumbers = [...new Set(rows.map(r => this.normalizePo(r.po)).filter(Boolean) as string[])];
        const pos = await this.prisma.masterPo.findMany({ where: { po: { in: poNumbers } } });
        const poByNo = new Map(pos.map(p => [p.po, p]));

        // ---- Validate rows and group them into audits ---------------------------
        const audits = new Map<string, PlannedAudit>();
        const factoriesToCreate = new Set<string>();
        const setupDefectsToAdd = new Map<string, { setupProcessId: bigint; defectId: bigint; label: string }>();

        for (const r of rows) {
            const rowNo = Number(r.rowNo) || 0;
            const date = clean(r.date);
            const checkingTime = this.normalizeCheckingTime(r.checkingTime);
            const nik = clean(r.nik);
            const po = this.normalizePo(r.po);
            const factoryInput = clean(r.factory);
            const processInput = clean(r.process);
            const qtyCheck = Number(r.qtyCheck);
            const defectInput = clean(r.defectName);
            const isNoDefect = !defectInput || looseKey(defectInput) === 'NODEFECT';
            const qtyDefect = isNoDefect ? 0 : Number(r.qtyDefect);
            const before = errorCount;

            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) addError(rowNo, `DATE is empty or invalid (use dd/mm/yyyy).`);
            if (!checkingTime) addError(rowNo, `CHECKING TIME must be Morning or Afternoon.`);
            if (!nik) addError(rowNo, `NIK is empty.`);
            else if (!userNiks.has(nik)) addError(rowNo, `NIK ${nik} is not registered in Users.`);
            if (!po) addError(rowNo, `PO is empty.`);
            else if (!poByNo.has(po)) addError(rowNo, `PO ${po} is not in Purchase Orders master data.`);
            if (!Number.isInteger(qtyCheck) || qtyCheck <= 0) addError(rowNo, `QTY CHECK must be a whole number above 0.`);
            if (!isNoDefect && (!Number.isInteger(qtyDefect) || qtyDefect <= 0)) addError(rowNo, `QTY DEFECT must be a whole number above 0 for defect "${defectInput}".`);
            if (Number.isInteger(qtyCheck) && Number.isInteger(qtyDefect) && qtyDefect > qtyCheck) addError(rowNo, `QTY DEFECT (${qtyDefect}) is larger than QTY CHECK (${qtyCheck}).`);

            const resolved = clean(r.model) ? resolveModel(r.model, po ? poByNo.get(po)?.article : undefined) : {};
            const model = resolved.model;
            if (!clean(r.model)) addError(rowNo, `MODEL is empty.`);
            else if (resolved.error) addError(rowNo, resolved.error);

            const factory = this.resolveFactoryName(factoryInput, factoryByKey);
            if (!factory) addError(rowNo, `FACTORY "${factoryInput ?? ''}" is not valid (use Factory 1-4, INHOUSE, BOTTOM 1 or BOTTOM 2).`);
            else if (!factory.exists) factoriesToCreate.add(factory.name);
            const cell = clean(r.cell) ?? '';
            if (factory && !factory.name.startsWith('BOTTOM') && !cell) addError(rowNo, `CELL is empty.`);

            // Process must belong to the model's CTQ setup
            let setupProcess: any = null;
            let setupArea: any = null;
            if (model && processInput) {
                for (const a of model.setupAreas) {
                    const sp = a.setupProcesses.find(p => looseKey(p.masterProcess.process) === looseKey(processInput));
                    if (sp) { setupProcess = sp; setupArea = a; break; }
                }
                if (!setupProcess) addError(rowNo, `Process "${processInput}" is not in the Setup CTQ of ${modelLabel(model)}.`);
            } else if (!processInput) addError(rowNo, `PROCESS is empty.`);

            // Defect must exist in master data; link it to the process setup if it isn't yet
            let masterDefect: any = null;
            if (!isNoDefect && setupProcess) {
                masterDefect = defectByKey.get(looseKey(defectInput));
                if (!masterDefect) addError(rowNo, `Defect "${defectInput}" is not in Master Data (Defect).`);
                else if (!setupProcess.setupDefects.some((sd: any) => sd.defectId === masterDefect.defectId)) {
                    setupDefectsToAdd.set(`${setupProcess.setupProcessId}|${masterDefect.defectId}`, {
                        setupProcessId: setupProcess.setupProcessId,
                        defectId: masterDefect.defectId,
                        label: `${modelLabel(model!)} / ${setupProcess.masterProcess.process} ← ${masterDefect.defect}`,
                    });
                }
            }

            if (errorCount > before) continue;

            const key = [model!.setupModelId, date, checkingTime, looseKey(factory!.name), looseKey(cell), po].join('|');
            let audit = audits.get(key);
            if (!audit) {
                audit = { key, rowNos: [], date: date!, checkingTime: checkingTime!, nik: nik!, setupModelId: model!.setupModelId, modelName: modelLabel(model!), po: po!, factoryName: factory!.name, cell, processes: new Map() };
                audits.set(key, audit);
            } else if (audit.nik !== nik) {
                addError(rowNo, `Same audit (date/time/factory/cell/PO) has a different NIK (${audit.nik} vs ${nik}).`);
                continue;
            }
            audit.rowNos.push(rowNo);

            const procKey = String(setupProcess.setupProcessId);
            let proc = audit.processes.get(procKey);
            if (!proc) {
                proc = { setupAreaId: setupArea.setupAreaId, setupProcessId: setupProcess.setupProcessId, processName: setupProcess.masterProcess.process, qtyChecking: qtyCheck, defects: new Map() };
                audit.processes.set(procKey, proc);
            } else if (proc.qtyChecking !== qtyCheck) {
                addError(rowNo, `Process "${proc.processName}" has different QTY CHECK values in the same audit (${proc.qtyChecking} vs ${qtyCheck}).`);
                continue;
            }
            if (masterDefect) {
                const dKey = String(masterDefect.defectId);
                if (proc.defects.has(dKey)) { addError(rowNo, `Defect "${masterDefect.defect}" is listed twice for process "${proc.processName}" in the same audit.`); continue; }
                proc.defects.set(dKey, {
                    rowNo, defectId: masterDefect.defectId, defectName: masterDefect.defect, qtyDefect,
                    actionPlan: clean(r.actionPlan), rootCause: clean(r.rootCause), corrective: clean(r.corrective),
                    durasiStopline: Number(r.durasiStopline) > 0 ? Math.round(Number(r.durasiStopline)) : null,
                    photoDefect: clean(r.photoDefect), photoAfterActionPlan: clean(r.photoImprovement),
                });
            }
        }

        // Defects total cannot exceed what was checked
        for (const a of audits.values()) {
            for (const p of a.processes.values()) {
                const total = [...p.defects.values()].reduce((s, d) => s + d.qtyDefect, 0);
                if (total > p.qtyChecking) addError(a.rowNos[0], `Total defects (${total}) of "${p.processName}" exceed QTY CHECK (${p.qtyChecking}).`);
            }
        }

        // ---- Skip audits that already exist ----------------------------------------
        const allAudits = [...audits.values()];
        const existingKeys = new Set<string>();
        if (allAudits.length) {
            const dates = allAudits.map(a => a.date).sort();
            const existing = await this.prisma.rqcHeader.findMany({
                where: {
                    setupModelId: { in: [...new Set(allAudits.map(a => a.setupModelId))] },
                    date: { gte: new Date(`${dates[0]}T00:00:00.000Z`), lte: new Date(`${dates[dates.length - 1]}T00:00:00.000Z`) },
                },
                select: { setupModelId: true, date: true, checkingTime: true, cell: true, po: true, factory: { select: { factory: true } } },
            });
            existing.forEach(h => existingKeys.add([h.setupModelId, h.date.toISOString().slice(0, 10), h.checkingTime, looseKey(h.factory.factory), looseKey(h.cell), h.po].join('|')));
        }
        const toCreate = allAudits.filter(a => !existingKeys.has(a.key));

        // ---- Summary -----------------------------------------------------------------
        const created = toCreate.flatMap(a => [...a.processes.values()]);
        const createdDefects = created.flatMap(p => [...p.defects.values()]);
        const summary = {
            rows: rows.length,
            audits: allAudits.length,
            auditsToCreate: toCreate.length,
            auditsSkipped: allAudits.length - toCreate.length,
            processes: created.length,
            noDefectProcesses: created.filter(p => p.defects.size === 0).length,
            defects: createdDefects.length,
            defectPcs: createdDefects.reduce((s, d) => s + d.qtyDefect, 0),
            immediateActions: created.reduce((s, p) => s + [...p.defects.values()].filter(d => d.qtyDefect / p.qtyChecking <= 0.2).length, 0),
            caps: created.reduce((s, p) => s + [...p.defects.values()].filter(d => d.qtyDefect / p.qtyChecking > 0.2).length, 0),
            models: [...new Set(toCreate.map(a => a.modelName))],
            dateFrom: toCreate.map(a => a.date).sort()[0] ?? null,
            dateTo: toCreate.map(a => a.date).sort().slice(-1)[0] ?? null,
            factoriesToCreate: [...factoriesToCreate],
            setupDefectsToAdd: [...setupDefectsToAdd.values()].map(s => s.label),
        };

        if (errors.length > 0 || !apply) {
            return { applied: false, summary, errors, errorsTruncated: errorCount > errors.length };
        }

        // ---- Write (all or nothing) ---------------------------------------------------
        await this.prisma.$transaction(async tx => {
            const factoryIdByKey = new Map(factories.map(f => [looseKey(f.factory), f.factoryId]));
            for (const name of factoriesToCreate) {
                const f = await tx.masterFactory.create({ data: { factory: name } });
                factoryIdByKey.set(looseKey(name), f.factoryId);
            }
            for (const sd of setupDefectsToAdd.values()) {
                await tx.setupDefect.create({ data: { setupProcessId: sd.setupProcessId, defectId: sd.defectId } });
            }
            for (const a of toCreate) {
                const po = poByNo.get(a.po)!;
                const date = new Date(`${a.date}T00:00:00.000Z`);
                // createdAt follows the audit date/time (08:00 / 13:00 WIB) so history lists imported audits in order
                const createdAt = new Date(`${a.date}T${a.checkingTime === 'Morning' ? '01' : '06'}:00:00.000Z`);
                const header = await tx.rqcHeader.create({
                    data: {
                        date, checkingTime: a.checkingTime, setupModelId: a.setupModelId,
                        po: po.po, article: po.article, model: po.model, qtyOrder: po.qtyOrder,
                        factoryId: factoryIdByKey.get(looseKey(a.factoryName))!, nik: a.nik, cell: a.cell, createdAt,
                    },
                });
                const areaIdBySetupArea = new Map<string, string>();
                for (const p of a.processes.values()) {
                    let rqcAreaId = areaIdBySetupArea.get(String(p.setupAreaId));
                    if (!rqcAreaId) {
                        const area = await tx.rqcArea.create({ data: { rqcHeaderId: header.rqcHeaderId, setupAreaId: p.setupAreaId } });
                        rqcAreaId = area.rqcAreaId;
                        areaIdBySetupArea.set(String(p.setupAreaId), rqcAreaId);
                    }
                    const proc = await tx.rqcProcess.create({ data: { rqcAreaId, setupProcessId: p.setupProcessId, qtyChecking: p.qtyChecking } });
                    for (const d of p.defects.values()) {
                        const defectRate = d.qtyDefect / p.qtyChecking;
                        await tx.rqcInspection.create({
                            data: {
                                rqcProcessId: proc.rqcProcessId, defectId: d.defectId, date,
                                qtyDefect: d.qtyDefect, defectRate, passRate: Math.max(0, 1 - defectRate),
                                // Same rule as manual entry: rate > 20% = CAP
                                status: defectRate > 0.2 ? 'CAP' : 'IMMEDIATE_ACTION',
                                actionPlan: d.actionPlan, rootCause: d.rootCause, corrective: d.corrective,
                                durasiStopline: d.durasiStopline, photoDefect: d.photoDefect, photoAfterActionPlan: d.photoAfterActionPlan,
                                createdAt,
                            },
                        });
                    }
                }
            }
        }, { timeout: 120000, maxWait: 10000 });

        this.logger.log(`RQC import: created ${toCreate.length} audits (${summary.defects} defects), skipped ${summary.auditsSkipped}`);
        return { applied: true, summary, errors: [], errorsTruncated: false };
    }

    private normalizePo(po: unknown): string | null {
        const v = clean(po);
        if (!v) return null;
        // Excel often drops the leading zero of 10-digit PO numbers
        return /^\d{1,9}$/.test(v) ? v.padStart(10, '0') : v;
    }

    private normalizeCheckingTime(v: unknown): 'Morning' | 'Afternoon' | null {
        const k = looseKey(v);
        if (k === 'MORNING' || k === 'PAGI') return 'Morning';
        if (k === 'AFTERNOON' || k === 'SIANG' || k === 'SORE') return 'Afternoon';
        return null;
    }

    /** Factory 1-4 must exist; INHOUSE / BOTTOM 1 / BOTTOM 2 are created on first use, like manual entry does. */
    private resolveFactoryName(input: string | null, factoryByKey: Map<string, { factory: string }>) {
        if (!input) return null;
        const k = looseKey(input);
        const fMatch = k.match(/^(?:FACTORY|F)([1-4])$/);
        if (fMatch) {
            const f = factoryByKey.get(`FACTORY${fMatch[1]}`);
            return f ? { name: f.factory, exists: true } : null;
        }
        const special = k === 'INHOUSE' ? 'INHOUSE' : k === 'BOTTOM1' || k === 'B1' ? 'BOTTOM 1' : k === 'BOTTOM2' || k === 'B2' ? 'BOTTOM 2' : null;
        if (!special) return null;
        return { name: special, exists: factoryByKey.has(looseKey(special)) };
    }
}
