'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

/**
 * "Download Template" + "Import Excel" for RQC audits on the admin Inspection Report page.
 * The file is validated by the API first (preview); nothing is saved until the user confirms.
 */

// Template columns, in order. Keys map Excel headers to the API row fields.
const COLUMNS: { header: string; key: string; width: number }[] = [
    { header: 'DATE', key: 'date', width: 12 },
    { header: 'CHECKING TIME', key: 'checkingTime', width: 14 },
    { header: 'NIK', key: 'nik', width: 10 },
    { header: 'MODEL', key: 'model', width: 24 },
    { header: 'PO', key: 'po', width: 13 },
    { header: 'FACTORY', key: 'factory', width: 11 },
    { header: 'CELL', key: 'cell', width: 12 },
    { header: 'PROCESS', key: 'process', width: 38 },
    { header: 'QTY CHECK', key: 'qtyCheck', width: 10 },
    { header: 'DEFECT NAME', key: 'defectName', width: 30 },
    { header: 'QTY DEFECT', key: 'qtyDefect', width: 10 },
    { header: 'ACTION PLAN', key: 'actionPlan', width: 40 },
    { header: 'ROOT CAUSE', key: 'rootCause', width: 30 },
    { header: 'CORRECTIVE ACTION', key: 'corrective', width: 30 },
    { header: 'DURASI STOPLINE', key: 'durasiStopline', width: 15 },
    { header: 'PHOTO DEFECT', key: 'photoDefect', width: 30 },
    { header: 'PHOTO IMPROVEMENT', key: 'photoImprovement', width: 30 },
];

const headerKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const COLUMN_BY_HEADER = new Map(COLUMNS.map(c => [headerKey(c.header), c.key]));

type Preview = {
    applied: boolean;
    summary: {
        rows: number; audits: number; auditsToCreate: number; auditsSkipped: number; processes: number;
        noDefectProcesses: number; defects: number; defectPcs: number; immediateActions: number; caps: number;
        models: string[]; dateFrom: string | null; dateTo: string | null; factoriesToCreate: string[]; setupDefectsToAdd: string[];
    };
    errors: { row: number; message: string }[];
    errorsTruncated: boolean;
};

// Excel cell -> yyyy-mm-dd. Accepts real date cells (serial numbers), dd/mm/yyyy and yyyy-mm-dd text.
function toIsoDate(v: unknown): string {
    if (v == null || v === '') return '';
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        if (!d) return '';
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return s; // let the API report it as invalid
}

export function RqcImportButton({ onImported }: { onImported?: () => void }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [rows, setRows] = useState<any[] | null>(null);
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState<'template' | 'check' | 'apply' | null>(null);

    const close = () => { setRows(null); setPreview(null); setFileName(''); };

    const downloadTemplate = async () => {
        setBusy('template');
        try {
            const sample = [
                ['13/10/2026', 'Morning', '154246', 'ADIZERO PACER EXO', '0903479305', 'Factory 2', 'F2-17', 'INSERT LASTE', 20, 'LINE UP 3 STRIPES DAN 3D JIG', 1, 'Dikembalikan ke proses sebelumnya untuk diperbaiki', '', '', '', '', ''],
                ['13/10/2026', 'Morning', '154246', 'ADIZERO PACER EXO', '0903479305', 'Factory 2', 'F2-17', 'INSERT LASTE', 20, 'WRINKLE', 1, 'Dikembalikan ke proses stroble', '', '', '', '', ''],
                ['13/10/2026', 'Afternoon', '157310', 'ADIZERO PACER EXO', '0903501863', 'INHOUSE', 'NOSEW 9', 'NOSEW VAMP QUARTER WITH VAMP OVERLAY', 20, 'NO DEFECT', 0, '', '', '', '', '', ''],
                ['13/10/2026', 'Afternoon', '153720', 'ADIZERO PACER EXO', '0903501863', 'BOTTOM 1', '', 'INCOMING MIDSOLE', 20, 'OVER JIG', 5, '', 'Tekanan pola kurang', 'Setting ulang waktu tekan sesuai SOP', 15, '', ''],
            ];
            const data = XLSX.utils.aoa_to_sheet([COLUMNS.map(c => c.header), ...sample]);
            data['!cols'] = COLUMNS.map(c => ({ wch: c.width }));
            // DATE and PO as text so Excel keeps dd/mm/yyyy and leading zeros
            for (let r = 1; r <= sample.length; r++) {
                ['A', 'E', 'C'].forEach(col => { const cell = data[`${col}${r + 1}`]; if (cell) { cell.t = 's'; cell.z = '@'; } });
            }

            const guide = XLSX.utils.aoa_to_sheet([
                ['PETUNJUK IMPORT DATA RQC'],
                [],
                ['1 baris = 1 defect dari 1 proses dalam 1 audit.'],
                ['Baris dengan DATE + CHECKING TIME + NIK + MODEL + PO + FACTORY + CELL yang sama digabung menjadi 1 audit.'],
                ['Proses tanpa defect: isi DEFECT NAME = NO DEFECT dan QTY DEFECT = 0.'],
                ['Satu proses dengan beberapa defect: buat beberapa baris dengan QTY CHECK yang sama.'],
                [],
                ['Kolom', 'Wajib', 'Keterangan'],
                ['DATE', 'Ya', 'dd/mm/yyyy, contoh 13/10/2026'],
                ['CHECKING TIME', 'Ya', 'Morning atau Afternoon'],
                ['NIK', 'Ya', 'NIK inspector yang terdaftar di menu Users'],
                ['MODEL', 'Ya', 'Nama model persis seperti di Setup CTQ (lihat sheet SETUP CTQ)'],
                ['PO', 'Ya', 'Nomor PO yang ada di menu Purchase Orders'],
                ['FACTORY', 'Ya', 'Factory 1, Factory 2, Factory 3, Factory 4, INHOUSE, BOTTOM 1 atau BOTTOM 2'],
                ['CELL', 'Ya*', 'Contoh F2-17, NOSEW 9, PRINTING 1, STOCKFIT 3. *Kosongkan untuk BOTTOM INCOMING MIDSOLE'],
                ['PROCESS', 'Ya', 'Nama proses seperti di Setup CTQ model tersebut'],
                ['QTY CHECK', 'Ya', 'Jumlah pcs yang dicek (angka > 0)'],
                ['DEFECT NAME', 'Ya', 'Nama defect seperti di Setup CTQ / Master Defect, atau NO DEFECT'],
                ['QTY DEFECT', 'Ya', 'Jumlah pcs defect (0 untuk NO DEFECT)'],
                ['ACTION PLAN', '-', 'Diisi untuk Immediate Action (defect rate <= 20%)'],
                ['ROOT CAUSE', '-', 'Diisi untuk CAP (defect rate > 20%)'],
                ['CORRECTIVE ACTION', '-', 'Diisi untuk CAP'],
                ['DURASI STOPLINE', '-', 'Menit (angka)'],
                ['PHOTO DEFECT', '-', 'Link foto defect (opsional)'],
                ['PHOTO IMPROVEMENT', '-', 'Link foto improvement (opsional)'],
                [],
                ['Status Immediate Action / CAP dihitung otomatis: defect rate > 20% = CAP, selain itu Immediate Action.'],
                ['Saat import, sistem menampilkan preview dan semua error terlebih dahulu. Data baru disimpan setelah dikonfirmasi.'],
                ['Audit yang sudah ada (model, tanggal, checking time, factory, cell dan PO sama) dilewati, jadi file yang sama aman di-import ulang.'],
            ]);
            guide['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 90 }];

            // Valid model / area / process / defect combinations from the current Setup CTQ
            const setupRows: any[][] = [['MODEL', 'AREA', 'PROCESS', 'DEFECT NAME']];
            try {
                const models = await fetch('/api/ctq-setup/models').then(r => r.json());
                const trees = await Promise.all((models || []).filter((m: any) => m.isActive !== false).map((m: any) =>
                    fetch(`/api/ctq-setup/models/${m.setupModelId}/tree`).then(r => r.ok ? r.json() : null).then(t => ({ m, t })).catch(() => ({ m, t: null }))));
                trees.forEach(({ m, t }) => t?.areas?.forEach((a: any) => a.setupProcesses?.forEach((p: any) => {
                    const defects = p.setupDefects?.length ? p.setupDefects.map((sd: any) => sd.masterDefect?.defect) : [''];
                    defects.forEach((d: string) => setupRows.push([m.modelName, a.masterArea?.area || '', p.masterProcess?.process || '', d]));
                })));
            } catch (e) {
                console.error('Failed to load setup for template', e);
            }
            const setupSheet = XLSX.utils.aoa_to_sheet(setupRows);
            setupSheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 42 }, { wch: 40 }];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, data, 'RQC_IMPORT');
            XLSX.utils.book_append_sheet(wb, guide, 'PETUNJUK');
            XLSX.utils.book_append_sheet(wb, setupSheet, 'SETUP CTQ');
            XLSX.writeFile(wb, 'RQC_IMPORT_TEMPLATE.xlsx');
        } finally {
            setBusy(null);
        }
    };

    const runImport = async (importRows: any[], apply: boolean) => {
        setBusy(apply ? 'apply' : 'check');
        try {
            const res = await fetch('/api/rqc/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: importRows, apply }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.summary) {
                alert(`Import gagal: ${data?.message || res.statusText}`);
                return;
            }
            setPreview(data);
            if (data.applied) {
                alert(`Import berhasil: ${data.summary.auditsToCreate} audit ditambahkan` + (data.summary.auditsSkipped ? `, ${data.summary.auditsSkipped} audit sudah ada dan dilewati.` : '.'));
                close();
                onImported?.();
            }
        } catch (e) {
            console.error(e);
            alert('Terjadi kesalahan jaringan saat import.');
        } finally {
            setBusy(null);
        }
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async evt => {
            try {
                const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array' });
                const sheetName = wb.SheetNames.find(n => headerKey(n) === 'RQCIMPORT') || wb.SheetNames[0];
                const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
                if (aoa.length < 2) return alert('File kosong atau tidak terbaca.');
                const keys = (aoa[0] as any[]).map(h => COLUMN_BY_HEADER.get(headerKey(String(h))) || null);
                const missing = ['date', 'checkingTime', 'nik', 'model', 'po', 'factory', 'process', 'qtyCheck', 'defectName'].filter(k => !keys.includes(k));
                if (missing.length) {
                    const names = missing.map(k => COLUMNS.find(c => c.key === k)!.header);
                    return alert(`Kolom wajib tidak ditemukan: ${names.join(', ')}.\nGunakan "Download Template".`);
                }
                const parsed: any[] = [];
                aoa.slice(1).forEach((r, i) => {
                    if (r.every(v => String(v ?? '').trim() === '')) return; // skip blank rows
                    const row: any = { rowNo: i + 2 };
                    keys.forEach((k, j) => { if (k) row[k] = r[j]; });
                    row.date = toIsoDate(row.date);
                    ['nik', 'po', 'cell', 'model', 'factory', 'process', 'defectName', 'checkingTime', 'actionPlan', 'rootCause', 'corrective', 'photoDefect', 'photoImprovement']
                        .forEach(k => { row[k] = row[k] == null ? '' : String(row[k]).trim(); });
                    ['qtyCheck', 'qtyDefect', 'durasiStopline'].forEach(k => { row[k] = row[k] === '' || row[k] == null ? null : Number(row[k]); });
                    parsed.push(row);
                });
                if (parsed.length === 0) return alert('Tidak ada baris data di file.');
                setFileName(file.name);
                setRows(parsed);
                setPreview(null);
                await runImport(parsed, false);
            } catch (err) {
                console.error(err);
                alert('File Excel tidak bisa dibaca. Pastikan memakai template import RQC.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const s = preview?.summary;
    const hasErrors = !!preview && preview.errors.length > 0;

    return (
        <>
            <div className="flex items-center gap-2">
                <button
                    onClick={downloadTemplate}
                    disabled={busy === 'template'}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    {busy === 'template' ? 'Menyiapkan...' : 'Download Template'}
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy === 'check' || busy === 'apply'}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    {busy === 'check' ? 'Memeriksa...' : 'Import Excel'}
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>

            {preview && rows && s && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => busy !== 'apply' && close()}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h2 className="text-base font-semibold text-gray-900">Preview Import RQC</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{fileName} · {s.rows} baris</p>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 text-sm">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Audit baru', value: s.auditsToCreate },
                                    { label: 'Sudah ada (dilewati)', value: s.auditsSkipped },
                                    { label: 'Proses dicek', value: s.processes },
                                    { label: 'No defect', value: s.noDefectProcesses },
                                    { label: 'Defect', value: `${s.defects} (${s.defectPcs} pcs)` },
                                    { label: 'Immediate Action', value: s.immediateActions },
                                    { label: 'CAP', value: s.caps },
                                    { label: 'Periode', value: s.dateFrom ? `${s.dateFrom.split('-').reverse().join('/')} – ${s.dateTo!.split('-').reverse().join('/')}` : '-' },
                                ].map(item => (
                                    <div key={item.label} className="border border-gray-200 rounded-lg px-3 py-2">
                                        <div className="text-[11px] text-gray-500">{item.label}</div>
                                        <div className="font-semibold text-gray-900">{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            {s.models.length > 0 && <p className="text-gray-600"><span className="font-medium text-gray-800">Model:</span> {s.models.join(', ')}</p>}
                            {(s.factoriesToCreate.length > 0 || s.setupDefectsToAdd.length > 0) && (
                                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-900 space-y-1">
                                    {s.factoriesToCreate.length > 0 && <p>Factory baru akan dibuat: <span className="font-semibold">{s.factoriesToCreate.join(', ')}</span></p>}
                                    {s.setupDefectsToAdd.length > 0 && <p>Defect akan ditambahkan ke Setup CTQ: <span className="font-semibold">{s.setupDefectsToAdd.join('; ')}</span></p>}
                                </div>
                            )}

                            {hasErrors ? (
                                <div>
                                    <p className="font-semibold text-red-700 mb-2">
                                        {preview.errors.length}{preview.errorsTruncated ? '+' : ''} error ditemukan. Perbaiki file lalu import ulang; belum ada data yang disimpan.
                                    </p>
                                    <div className="border border-red-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-red-50 text-red-800">
                                                <tr><th className="px-3 py-1.5 text-left w-16">Baris</th><th className="px-3 py-1.5 text-left">Masalah</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-100">
                                                {preview.errors.map((err, i) => (
                                                    <tr key={i}><td className="px-3 py-1.5 font-mono text-gray-700">{err.row}</td><td className="px-3 py-1.5 text-gray-800">{err.message}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : s.auditsToCreate === 0 ? (
                                <p className="text-amber-700 font-medium">Semua audit di file ini sudah ada di sistem. Tidak ada yang perlu di-import.</p>
                            ) : (
                                <p className="text-green-700 font-medium">File valid. Klik Import untuk menyimpan {s.auditsToCreate} audit.</p>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
                            <button onClick={close} disabled={busy === 'apply'} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                                {hasErrors ? 'Tutup' : 'Batal'}
                            </button>
                            {!hasErrors && s.auditsToCreate > 0 && (
                                <button onClick={() => runImport(rows, true)} disabled={busy === 'apply'} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50">
                                    {busy === 'apply' ? 'Menyimpan...' : `Import ${s.auditsToCreate} Audit`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
