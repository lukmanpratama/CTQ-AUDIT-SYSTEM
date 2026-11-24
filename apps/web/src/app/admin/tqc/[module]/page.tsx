'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useDataRefresh } from '../../../../lib/use-data-refresh';
import ColumnFilter, { ClearColumnFilters } from '../../../../components/admin/ColumnFilter';
import TablePager, { usePagination } from '../../../../components/admin/TablePager';
import { useColumnFilters } from '../../../../lib/column-filters';

const parseCustomDateString = (dateStr: any): string | null => {
    if (!dateStr) return null;
    const str = String(dateStr).trim();

    if (str.length === 8 && !str.includes('/') && !str.includes('-') && !str.includes(' ')) {
        const year = str.substring(0, 4);
        const month = str.substring(4, 6);
        const day = str.substring(6, 8);
        if (!isNaN(Number(year)) && !isNaN(Number(month)) && !isNaN(Number(day))) {
            return `${year}-${month}-${day}`;
        }
    }

    // Split by common date separators
    let parts = str.split(/[\/\- \.]/).filter(p => p.trim() !== '');
    const now = new Date();

    let y = now.getFullYear().toString();
    let m = (now.getMonth() + 1).toString();
    let d = "01";

    if (parts.length === 1 && !isNaN(Number(parts[0]))) {
        d = parts[0];
    } else if (parts.length === 2) {
        d = parts[0];
        m = parts[1];
    } else if (parts.length >= 3) {
        y = parts[2];
        m = parts[1];
        d = parts[0];
        if (parts[0].length === 4) {
            y = parts[0];
            m = parts[1];
            d = parts[2];
        }
    } else {
        return null;
    }

    if (y.length === 2) y = '20' + y;

    const monthNames: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
        'agu': '08', 'okt': '10', 'nop': '11', 'des': '12'
    };

    const mKey = m.toLowerCase().substring(0, 3);
    if (monthNames[mKey]) {
        m = monthNames[mKey];
    }

    const monthNum = parseInt(m);
    const dayNum = parseInt(d);

    if (isNaN(monthNum) || isNaN(dayNum) || isNaN(parseInt(y))) return null;

    let finalM = m.padStart(2, '0');
    let finalD = d.padStart(2, '0');

    if (monthNum > 12 && dayNum <= 12) {
        // Swap MM/DD
        finalM = d.padStart(2, '0');
        finalD = m.padStart(2, '0');
    }

    return `${y}-${finalM}-${finalD}`;
};

const formatDateForDisplay = (isoStr: string) => {
    // Displays "31/08/2026"
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const parseCustomTimeCode = (timeCode: string) => {
    if (!timeCode) return '';
    const tc = String(timeCode).trim();

    // Asumsi format seperti "A007", "A013", bisa kita ambil angkanya saja
    const match = tc.match(/\d+/);
    if (!match) return tc; // Jika tidak ada angka, kembalikan aslinya

    const hour = parseInt(match[0], 10);
    const nextHour = hour + 1;
    const hh = hour.toString().padStart(2, '0');
    const nextHh = nextHour.toString().padStart(2, '0');

    return `${hh}.00-${nextHh}.00`;
};

// Same list as Setup Defect TQC
const CTQ_TYPES = ['External Compliance', 'Safety', 'Function', 'Durability', 'Appearance', 'Color', 'Fit&Comfort'];
// TQC checks 120 pairs per hour unless the hour's Qty Checking was edited
const DEFAULT_QTY_CHECKING = 120;

type EditableField = 'article' | 'qtyChecking' | 'qtyDefect' | 'ctqType' | 'defectName';

export default function TqcModulePage({ params }: { params: Promise<{ module: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const moduleType = resolvedParams.module.toUpperCase();
    const isSewingFormat = moduleType === 'SEWING' || moduleType === 'TREATMENT';

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Header filters and sort, one per column, on the values as the table shows them
    const cf = useColumnFilters(data, {
        date: { get: r => (r.date ? String(r.date).slice(0, 10) : ''), format: formatDateForDisplay, kind: 'date' },
        time: { get: r => r.time },
        building: { get: r => r.building },
        cell: { get: r => r.cell },
        model: { get: r => r.model },
        article: { get: r => r.article },
        orderNo: { get: r => r.orderNo },
        pwiNo: { get: r => r.pwiNo },
        seq: { get: r => r.seq, kind: 'number' },
        qtyProduction: { get: r => (isSewingFormat ? (typeof r.qtyProduction === 'number' ? r.qtyProduction : '') : (r.qtyProduction || r.qty)), kind: 'number' },
        qtyChecking: { get: r => (isSewingFormat ? r.qty : (r.qtyChecking ?? DEFAULT_QTY_CHECKING)), kind: 'number' },
        qtyDefect: { get: r => r.qtyDefect, kind: 'number' },
        destination: { get: r => r.destination },
        category: { get: r => r.category },
        type: { get: r => r.type },
        ctqType: { get: r => r.ctqType },
        defectName: { get: r => r.defectName },
        uspClassification: { get: r => r.uspClassification },
    });
    const filteredData = cf.filtered;
    const pager = usePagination(filteredData, { initialSize: 10, resetKey: [moduleType, cf.filters, cf.sort] });
    const paginatedData = pager.pageRows;
    const F = (key: string, title: string) => <ColumnFilter {...cf.bind(key, title)} />;

    // Another module starts without filters
    useEffect(() => { cf.clearAll(); }, [moduleType]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [setupDefectNames, setSetupDefectNames] = useState<string[]>([]);

    // silent: a background reload after someone else's change keeps the table on screen
    const fetchData = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`/api/tqc/${moduleType}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error('Failed to fetch TQC data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [moduleType]);

    // Reload when someone adds / changes data
    const { refreshKey, isBackgroundRefresh } = useDataRefresh();
    useEffect(() => {
        if (isBackgroundRefresh()) fetchData({ silent: true });
    }, [refreshKey]);

    // Suggestions for the Defect Name input
    useEffect(() => {
        fetch('/api/tqc-setup-defect')
            .then(res => (res.ok ? res.json() : []))
            .then(list => setSetupDefectNames(Array.isArray(list) ? list.map((d: any) => d.defectName).filter(Boolean) : []))
            .catch(() => setSetupDefectNames([]));
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Get header row and map data
                const rawData = XLSX.utils.sheet_to_json(ws);

                // Map the Excel headers back to our schema (assuming headers match the prompt exactly or closely)
                // Helper to get value ignoring case and trimming whitespace
                const getVal = (row: any, keys: string[]) => {
                    for (const key of keys) {
                        const found = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
                        if (found && row[found] !== null && row[found] !== '') {
                            return row[found];
                        }
                    }
                    return null;
                };

                const payload = rawData.map((row: any) => {
                    const rawDate = getVal(row, ['Date', 'TANGGAL']);
                    let finalDate = new Date().toISOString().split('T')[0]; // fallback to today
                    if (typeof rawDate === 'number' && rawDate > 30000) {
                        if (rawDate > 10000000) {
                            // If it's a huge integer like 20260925, it's YYYYMMDD, not an Excel serial
                            const strDate = String(rawDate);
                            if (strDate.length === 8) {
                                finalDate = `${strDate.substring(0, 4)}-${strDate.substring(4, 6)}-${strDate.substring(6, 8)}`;
                            }
                        } else {
                            const parsedDateObj = XLSX.SSF.parse_date_code(rawDate);
                            if (parsedDateObj) {
                                const mm = String(parsedDateObj.m).padStart(2, '0');
                                const dd = String(parsedDateObj.d).padStart(2, '0');
                                finalDate = `${parsedDateObj.y}-${mm}-${dd}`;
                            }
                        }
                    } else if (rawDate) {
                        const parsedStr = parseCustomDateString(rawDate as string);
                        if (parsedStr) {
                            finalDate = parsedStr;
                        } else {
                            try {
                                finalDate = new Date(rawDate as string).toISOString().split('T')[0];
                            } catch (e) {
                                // fallback
                            }
                        }
                    }

                    const parsedTime = parseCustomTimeCode(getVal(row, ['Time']) || '');

                    // Only look for explicit CHECKING labels to avoid colliding with basic 'QTY' which is usually production
                    const qtyVal = getVal(row, ['QTY CHECK', 'QTY CHECKING', 'CHECK QTY', 'QTY CHK']);
                    const qtyDefectVal = getVal(row, ['Defect', 'DEFECT', 'Qty Defect', 'Defect Qty', 'QTY DEFECT']);
                    // Safely accept 'Qty' and 'QTY' as production fallbacks
                    const qtyProductionVal = getVal(row, ['Qty Prod', 'QTY PROD', 'Qty Production', 'QTY PRODUCTION', 'Qty', 'QTY', 'Quantity', 'QTY PRODUCT']);

                    return {
                        // Excel row number (SheetJS sets __rowNum__, 0-based) so the API can point at the bad row
                        rowNo: typeof row.__rowNum__ === 'number' ? row.__rowNum__ + 1 : undefined,
                        date: finalDate,
                        time: parsedTime,
                        building: getVal(row, ['Building', 'FACTORY']) || '',
                        cell: getVal(row, ['Cell', 'CELL']) || '',
                        model: getVal(row, ['Model', 'MODEL', 'MODEL NAME']) || '',
                        article: getVal(row, ['Article', 'ARTICLE']) || '',
                        orderNo: getVal(row, ['Order No', 'OrderNo', 'PO']) || '',
                        seq: getVal(row, ['Seq']) ? parseInt(getVal(row, ['Seq']), 10) : null,
                        pwiNo: getVal(row, ['PWI No', 'PWI']) || '',
                        qty: qtyVal !== null ? parseFloat(qtyVal) : null,
                        qtyDefect: qtyDefectVal !== null ? parseFloat(qtyDefectVal) : null,
                        qtyProduction: qtyProductionVal !== null ? parseFloat(qtyProductionVal) : null,
                        destination: getVal(row, ['Destination', 'DESTINATION', 'Dest', 'DEST']) || '',
                        category: getVal(row, ['Category', 'CATEGORY', 'Cat', 'CAT']) || '',
                        type: getVal(row, ['Type', 'TYPE']) || '',
                        defectName: getVal(row, ['Defect Name', 'DEFECT NAME', 'Defect', 'DEFECT', 'Name', 'NAME']) || '',
                        uspClassification: getVal(row, ['USP Classification', 'USP CLASSIFICATION', 'USP', 'Usp']) || ''
                    };
                });

                if (payload.length === 0) {
                    alert('The Excel file has no data rows.');
                    return;
                }

                // Post in batches: the Next.js /api proxy rejects request bodies of ~10 MB or more
                // with a plain "Internal Server Error", which large TQC exports (~24k+ rows) exceed.
                // Re-importing is safe because the API skips rows that already exist.
                const BATCH_SIZE = 1000;
                const totalBatches = Math.ceil(payload.length / BATCH_SIZE);
                let added = 0;
                let skipped = 0;
                for (let b = 0; b < totalBatches; b++) {
                    const batch = payload.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
                    const response = await fetch(`/api/tqc/${moduleType}/upload`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(batch)
                    });

                    if (!response.ok) {
                        const errText = await response.text().catch(() => '');
                        let detail = errText;
                        try {
                            const body = JSON.parse(errText);
                            detail = body.message || errText;
                            if (Array.isArray(body.errors) && body.errors.length) {
                                detail += '\n\n' + body.errors.slice(0, 15).map((e: any) => `Row ${e.row}: ${e.message}`).join('\n')
                                    + (body.errors.length > 15 ? `\n…and ${body.errors.length - 15} more.` : '');
                            }
                        } catch (e) { }
                        const progress = totalBatches > 1
                            ? `\n\nBatch ${b + 1} of ${totalBatches} failed. ${added} row(s) from earlier batches were already saved; importing the same file again will skip them.`
                            : '';
                        alert(`Failed to import data (HTTP ${response.status}).\n${detail || 'No detail from server.'}${progress}`);
                        if (added > 0) fetchData();
                        return;
                    }

                    const result = await response.json().catch(() => ({}));
                    added += result.count ?? 0;
                    skipped += result.skipped ?? 0;
                }

                alert(`Data imported successfully!\n${added} new record(s) added` +
                    (skipped ? `, ${skipped} duplicate record(s) skipped.` : '.'));
                fetchData(); // Reload table
            } catch (error) {
                console.error("Error parsing Excel:", error);
                alert('Error parsing the uploaded Excel file. Please ensure it matches the template.');
            } finally {
                setUploading(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleDeleteRow = async (id: number) => {
        if (!confirm('Are you sure you want to delete this row?')) return;
        try {
            const response = await fetch(`/api/tqc/${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchData();
            } else {
                alert('Failed to delete row.');
            }
        } catch (e) {
            console.error("Error deleting row:", e);
            alert('Error deleting row.');
        }
    };

    // Saves one inline field of a row (on blur / Enter, or on change for the CTQ select).
    // Returns false when nothing was saved so the caller can restore the input.
    const handleSaveField = async (row: any, field: EditableField, raw: string): Promise<boolean> => {
        const text = raw.trim();
        let value: any = text;
        if (field === 'qtyChecking' || field === 'qtyDefect') {
            value = text === '' ? null : Number(text);
            if (value !== null && (isNaN(value) || value < 0)) {
                alert(`${field === 'qtyChecking' ? 'Qty Checking' : 'Qty Defect'} must be 0 or more.`);
                return false;
            }
            if (field === 'qtyChecking') {
                // Empty = back to the standard 120; on an unedited hour, 120 or empty changes nothing
                const unchanged = row.qtyChecking == null
                    ? (value === null || value === DEFAULT_QTY_CHECKING)
                    : value === row.qtyChecking;
                if (unchanged) return true;
            } else if (value === (row.qtyDefect ?? null)) return true;
        } else if (field === 'ctqType') {
            if (text === (row.ctqTypeOverride || '')) return true;
            value = text || null;
        } else {
            if (field === 'article') value = text.toUpperCase();
            if (field === 'defectName' && !text) {
                alert('Defect Name cannot be empty.');
                return false;
            }
            if (value === (row[field] || '')) return true;
        }

        try {
            const response = await fetch(`/api/tqc/${row.tqcId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => null);
                const msg = err?.message;
                alert(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to save.'));
                return false;
            }
            if (field === 'article' || field === 'qtyDefect') {
                setData(prev => prev.map(r => r.tqcId === row.tqcId ? { ...r, [field]: value } : r));
            } else {
                // Qty Checking changes the whole hour, and CTQ Type depends on the defect name: reload
                await fetchData();
            }
            return true;
        } catch (e) {
            console.error(`Error saving ${field}:`, e);
            alert('Error saving the change.');
            return false;
        }
    };

    const handleSaveUsp = async (id: number, value: string) => {
        const newValue = value.trim();
        const current = data.find((r) => r.tqcId === id);
        if ((current?.uspClassification || '') === newValue) return;
        try {
            const response = await fetch(`/api/tqc/${id}/usp`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uspClassification: newValue })
            });
            if (response.ok) {
                setData((prev) => prev.map((r) => r.tqcId === id ? { ...r, uspClassification: newValue } : r));
            } else {
                alert('Failed to save USP Classification.');
            }
        } catch (e) {
            console.error("Error saving USP Classification:", e);
            alert('Error saving USP Classification.');
        }
    };

    const handleClearAll = async () => {
        if (!confirm(`WARNING: Are you sure you want to delete ALL data for ${moduleType}? This cannot be undone.`)) return;
        try {
            const response = await fetch(`/api/tqc/bulk/${moduleType}`, { method: 'DELETE' });
            if (response.ok) {
                fetchData();
                cf.clearAll();
                alert(`All ${moduleType} data has been cleared.`);
            } else {
                alert('Failed to clear data.');
            }
        } catch (e) {
            console.error("Error clearing data:", e);
            alert('Error clearing data.');
        }
    };

    const handleDownloadFormat = () => {
        let headers = [];
        if (isSewingFormat) {
            headers = [
                "DATE", "BUILDING", "CELL", "PO", "ARTICLE", "MODEL NAME",
                "DEFECT NAME", "QTY PRODUCTION", "QTY DEFECT", "QTY CHECKING"
            ];
        } else {
            headers = [
                "Date", "Time", "Building", "Cell", "Model", "Article",
                "Order No", "Seq", "PWI No", "Qty Production", "Qty Checking", "Qty Defect",
                "Destination", "Category", "Type", "Defect Name", "USP Classification"
            ];
        }

        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");

        XLSX.writeFile(wb, `TQC_${moduleType}_Template.xlsx`);
    };

    return (
        <div className="admin-page">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/admin/tqc')} className="admin-btn admin-btn-secondary !px-0 w-9" aria-label="Kembali ke TQC Report">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h1 className="admin-page-title">{moduleType} TQC Records</h1>
                        <p className="admin-page-subtitle">Manage and view imported TQC logs.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleDownloadFormat} className="admin-btn admin-btn-secondary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Format
                    </button>

                    <button
                        onClick={handleClearAll}
                        disabled={uploading || data.length === 0}
                        className="admin-btn admin-btn-danger"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Clear All
                    </button>

                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="admin-btn admin-btn-primary"
                    >
                        {uploading ? (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                        {uploading ? 'Importing...' : 'Import Excel'}
                    </button>
                </div>
            </div>

            <div className="admin-table-card">
                <div className="admin-table-scroll">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-gray-500 uppercase border-b">
                            {isSewingFormat ? (
                                <tr>
                                    <th className="px-5 py-3 font-semibold">{F('date', 'Date')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('building', 'Building')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('cell', 'Cell')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('orderNo', 'PO')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('article', 'Article')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('model', 'Model Name')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('defectName', 'Defect Name')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('qtyProduction', 'Qty Production')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('qtyDefect', 'Qty Defect')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('qtyChecking', 'Qty Checking')}</th>
                                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-5 py-3 font-semibold">{F('date', 'Date')}</th>
                                    {moduleType === 'ASSEMBLY' && <th className="px-5 py-3 font-semibold">{F('time', 'Time')}</th>}
                                    <th className="px-5 py-3 font-semibold">
                                        {/* One column, two filters */}
                                        <span className="inline-flex items-center gap-1.5">
                                            {F('building', 'Building')}
                                            <span className="text-gray-300">/</span>
                                            {F('cell', 'Cell')}
                                        </span>
                                    </th>
                                    <th className="px-5 py-3 font-semibold">{F('model', moduleType === 'ASSEMBLY' ? 'Model' : 'Model Name')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('article', 'Article')}</th>
                                    <th className="px-5 py-3 font-semibold">
                                        {moduleType === 'ASSEMBLY' ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                {F('orderNo', 'Order No')}
                                                <span className="text-gray-300">/</span>
                                                {F('pwiNo', 'PWI')}
                                            </span>
                                        ) : F('orderNo', 'PO')}
                                    </th>
                                    {moduleType === 'ASSEMBLY' && <th className="px-5 py-3 font-semibold">{F('seq', 'Seq')}</th>}
                                    <th className="px-5 py-3 font-semibold">{F('qtyProduction', 'Qty Production')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('qtyChecking', 'Qty Checking')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('qtyDefect', 'Qty Defect')}</th>
                                    {moduleType === 'ASSEMBLY' && <th className="px-5 py-3 font-semibold">{F('destination', 'Destination')}</th>}
                                    <th className="px-5 py-3 font-semibold">{F('category', 'Category')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('type', 'Type')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('ctqType', 'CTQ Type')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('defectName', 'Defect Name')}</th>
                                    <th className="px-5 py-3 font-semibold">{F('uspClassification', 'USP Classification')}</th>
                                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={14} className="px-5 py-16 text-center text-gray-400 font-medium">Loading data...</td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="px-5 py-16 text-center text-gray-500">
                                        No datatables records found for {moduleType}. Please import an Excel file.
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="px-5 py-16 text-center text-gray-500">
                                        Tidak ada baris yang cocok dengan filter kolom.
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row) => (
                                    isSewingFormat ? (
                                        <tr key={row.tqcId} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3 text-gray-900 font-medium">{formatDateForDisplay(row.date)}</td>
                                            <td className="px-5 py-3 text-gray-600">{row.building || '-'}</td>
                                            <td className="px-5 py-3 text-gray-600">{row.cell || '-'}</td>
                                            <td className="px-5 py-3 text-gray-600 font-mono text-xs">{row.orderNo || '-'}</td>
                                            <td className="px-5 py-3 text-gray-600 font-mono text-xs">{row.article || '-'}</td>
                                            <td className="px-5 py-3 text-gray-900 font-medium">{row.model}</td>
                                            <td className="px-5 py-3 text-red-600 font-medium max-w-[200px] truncate" title={row.defectName}>{row.defectName}</td>
                                            <td className="px-5 py-3 text-gray-900 font-bold">{typeof row.qtyProduction === 'number' ? row.qtyProduction : '-'}</td>
                                            <td className="px-5 py-3 text-red-600 font-bold">{row.qtyDefect || '-'}</td>
                                            <td className="px-5 py-3 text-gray-900 font-bold">{row.qty}</td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteRow(row.tqcId)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Delete Row"
                                                >
                                                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={row.tqcId} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3 text-gray-900 font-medium">{formatDateForDisplay(row.date)}</td>
                                            {moduleType === 'ASSEMBLY' && <td className="px-5 py-3 text-gray-600">{row.time}</td>}
                                            <td className="px-5 py-3 text-gray-600">{row.building} <span className="text-gray-400 mx-1">/</span> {row.cell}</td>
                                            <td className="px-5 py-3 text-gray-900 font-medium">{row.model}</td>
                                            <td className="px-5 py-3">
                                                <input
                                                    key={`${row.tqcId}-article-${row.article || ''}`}
                                                    type="text"
                                                    defaultValue={row.article || ''}
                                                    placeholder="Article"
                                                    maxLength={100}
                                                    onBlur={async (e) => {
                                                        const el = e.currentTarget;
                                                        if (!(await handleSaveField(row, 'article', el.value))) el.value = row.article || '';
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                        if (e.key === 'Escape') {
                                                            e.currentTarget.value = row.article || '';
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="w-24 font-mono uppercase text-gray-700 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-gray-600 flex flex-col text-xs">
                                                <span>{row.orderNo || '-'}</span>
                                                {moduleType === 'ASSEMBLY' && <span className="text-gray-400">{row.pwiNo}</span>}
                                            </td>
                                            {moduleType === 'ASSEMBLY' && <td className="px-5 py-3 text-gray-600 text-xs">{row.seq || '-'}</td>}
                                            <td className="px-5 py-3 text-gray-900 font-bold">{row.qtyProduction || row.qty || '-'}</td>
                                            <td className="px-5 py-3">
                                                <input
                                                    key={`${row.tqcId}-chk-${row.qtyChecking ?? ''}`}
                                                    type="number"
                                                    min={0}
                                                    defaultValue={row.qtyChecking ?? DEFAULT_QTY_CHECKING}
                                                    title={row.qtyChecking != null
                                                        ? 'Edited. Applies to every defect of this hour and cell. Clear it to go back to 120.'
                                                        : 'Standard 120 per hour. A new value applies to every defect of this hour and cell.'}
                                                    onBlur={async (e) => {
                                                        const el = e.currentTarget;
                                                        const saved = await handleSaveField(row, 'qtyChecking', el.value);
                                                        if (!saved || el.value.trim() === '') el.value = String(row.qtyChecking ?? DEFAULT_QTY_CHECKING);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                        if (e.key === 'Escape') {
                                                            e.currentTarget.value = String(row.qtyChecking ?? DEFAULT_QTY_CHECKING);
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className={`w-20 font-bold text-gray-900 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${row.qtyChecking != null ? 'border-blue-300 bg-blue-50' : ''}`}
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <input
                                                    key={`${row.tqcId}-def-${row.qtyDefect ?? ''}`}
                                                    type="number"
                                                    min={0}
                                                    defaultValue={row.qtyDefect ?? ''}
                                                    placeholder="0"
                                                    onBlur={async (e) => {
                                                        const el = e.currentTarget;
                                                        if (!(await handleSaveField(row, 'qtyDefect', el.value))) el.value = row.qtyDefect != null ? String(row.qtyDefect) : '';
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                        if (e.key === 'Escape') {
                                                            e.currentTarget.value = row.qtyDefect != null ? String(row.qtyDefect) : '';
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="w-16 font-bold text-red-600 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </td>
                                            {moduleType === 'ASSEMBLY' && <td className="px-5 py-3 text-gray-600 text-xs">{row.destination || '-'}</td>}
                                            {moduleType !== 'SEWING' && <td className="px-5 py-3 text-gray-600 text-xs">{row.category || '-'}</td>}
                                            {moduleType !== 'SEWING' && <td className="px-5 py-3 text-gray-600 text-xs">{row.type || '-'}</td>}
                                            <td className="px-5 py-3">
                                                <select
                                                    value={row.ctqTypeOverride || ''}
                                                    onChange={(e) => handleSaveField(row, 'ctqType', e.target.value)}
                                                    title={row.ctqTypeOverride
                                                        ? `Set on this row (Setup Defect TQC: ${row.ctqTypeSetup || 'Unmapped'})`
                                                        : 'Follows Setup Defect TQC for this defect name'}
                                                    className={`w-40 font-medium px-2 py-1 text-xs border border-gray-200 rounded-md bg-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${row.ctqTypeOverride ? 'border-amber-300 bg-amber-50 text-amber-800' : (row.ctqType ? 'text-blue-800' : 'text-gray-400 italic')}`}
                                                >
                                                    <option value="">{row.ctqTypeSetup || 'Unmapped'} (setup)</option>
                                                    {CTQ_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-5 py-3">
                                                <input
                                                    key={`${row.tqcId}-name-${row.defectName || ''}`}
                                                    type="text"
                                                    list="tqc-defect-names"
                                                    defaultValue={row.defectName || ''}
                                                    title={row.defectName || ''}
                                                    maxLength={200}
                                                    onBlur={async (e) => {
                                                        const el = e.currentTarget;
                                                        if (!(await handleSaveField(row, 'defectName', el.value))) el.value = row.defectName || '';
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                        if (e.key === 'Escape') {
                                                            e.currentTarget.value = row.defectName || '';
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="w-56 font-medium text-red-600 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <input
                                                    key={`${row.tqcId}-${row.uspClassification || ''}`}
                                                    type="text"
                                                    defaultValue={row.uspClassification || ''}
                                                    placeholder="Add USP..."
                                                    maxLength={100}
                                                    onBlur={(e) => handleSaveUsp(row.tqcId, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                        if (e.key === 'Escape') {
                                                            e.currentTarget.value = row.uspClassification || '';
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="w-40 px-2 py-1 text-xs font-semibold text-gray-800 border border-gray-200 rounded-md bg-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteRow(row.tqcId)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Delete Row"
                                                >
                                                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                ))
                            )}
                        </tbody>
                    </table>
                    <datalist id="tqc-defect-names">
                        {[...new Set([...setupDefectNames, ...data.map(r => r.defectName).filter(Boolean)])].sort().map(name => (
                            <option key={name} value={name} />
                        ))}
                    </datalist>
                </div>

                {/* Pagination Controls */}
                {!loading && (
                    <TablePager
                        page={pager.page}
                        pageSize={pager.pageSize}
                        total={pager.total}
                        onPage={pager.setPage}
                        onPageSize={pager.setPageSize}
                        noun="baris"
                        extra={cf.activeCount > 0 ? (
                            <>
                                <span className="text-gray-400">(difilter dari {data.length})</span>
                                <ClearColumnFilters count={cf.activeCount} onClear={cf.clearAll} />
                            </>
                        ) : undefined}
                    />
                )}
            </div>
        </div>
    );
}
