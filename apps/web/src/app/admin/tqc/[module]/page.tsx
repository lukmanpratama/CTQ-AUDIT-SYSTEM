'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

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

export default function TqcModulePage({ params }: { params: Promise<{ module: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const moduleType = resolvedParams.module.toUpperCase();
    const isSewingFormat = moduleType === 'SEWING' || moduleType === 'TREATMENT';

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // For simple pagination in frontend
    const [page, setPage] = useState(1);
    const rowsPerPage = 10;

    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [colFilters, setColFilters] = useState<Record<string, string>>({});
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        setLoading(true);
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

                // Post to our API
                const response = await fetch(`/api/tqc/${moduleType}/upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    let msg = 'Data imported successfully!';
                    try {
                        const result = await response.json();
                        msg = `Data imported successfully!\n${result.count ?? 0} new record(s) added` +
                            (result.skipped ? `, ${result.skipped} duplicate record(s) skipped.` : '.');
                    } catch (e) { }
                    alert(msg);
                    fetchData(); // Reload table
                } else {
                    let errMsg = 'Failed to import data on the server.';
                    try {
                        const errText = await response.text();
                        if (errText) errMsg += `\nDetail: ${errText}`;
                    } catch (e) { }
                    alert(errMsg);
                }
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
                setSelectedModels([]);
                setPage(1);
                alert(`All ${moduleType} data has been cleared.`);
            } else {
                alert('Failed to clear data.');
            }
        } catch (e) {
            console.error("Error clearing data:", e);
            alert('Error clearing data.');
        }
    };

    const uniqueModels = Array.from(new Set(data.map(item => item.model))).filter(Boolean).sort() as string[];

    const filteredData = data.filter(item => {
        if (selectedModels.length > 0 && !selectedModels.includes(item.model)) return false;

        for (const [key, value] of Object.entries(colFilters)) {
            if (!value) continue;
            const itemVal = String(item[key] || '');
            if (itemVal !== value) return false;
        }
        return true;
    });

    const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

    const renderExcelFilter = (fieldKey: string, label: string) => {
        const uniqueValues = Array.from(new Set(data.map(item => String(item[fieldKey] || '')).filter(Boolean))).sort();
        return (
            <select
                className="w-full text-xs border border-gray-300 rounded px-1 py-1 font-normal text-gray-700 bg-white"
                value={colFilters[fieldKey] || ''}
                onChange={e => {
                    setColFilters(prev => ({ ...prev, [fieldKey]: e.target.value }));
                    setPage(1);
                }}
            >
                <option value="">{label}</option>
                {uniqueValues.map(val => (
                    <option key={val} value={val}>{val.length > 20 ? val.substring(0, 20) + '...' : val}</option>
                ))}
            </select>
        );
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/admin/tqc')} className="p-2 border border-gray-200 rounded-md bg-white hover:bg-gray-50 text-gray-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{moduleType} TQC Records</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Manage and view imported TQC logs.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between px-3 py-2 w-48 shadow-sm"
                        >
                            <span className="truncate text-left">
                                {selectedModels.length === 0
                                    ? 'All Models'
                                    : `${selectedModels.length} Model(s) Selected`}
                            </span>
                            <svg className="w-4 h-4 ml-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                                <div className="absolute left-0 z-20 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
                                    <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                                        <button
                                            onClick={() => { setSelectedModels([]); setPage(1); }}
                                            className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1"
                                        >
                                            Clear All
                                        </button>
                                        <button
                                            onClick={() => { setSelectedModels([...uniqueModels]); setPage(1); }}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
                                        >
                                            Select All
                                        </button>
                                    </div>
                                    <div className="p-2 space-y-1 overflow-y-auto">
                                        {uniqueModels.map(m => (
                                            <label key={m} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedModels.includes(m)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedModels([...selectedModels, m]);
                                                        } else {
                                                            setSelectedModels(selectedModels.filter(x => x !== m));
                                                        }
                                                        setPage(1);
                                                    }}
                                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-4 h-4"
                                                />
                                                <span className="text-sm text-gray-700 truncate">{m}</span>
                                            </label>
                                        ))}
                                        {uniqueModels.length === 0 && (
                                            <div className="text-sm text-gray-500 p-2 text-center">No models found</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={handleDownloadFormat}
                        className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Format
                    </button>

                    <button
                        onClick={handleClearAll}
                        disabled={uploading || data.length === 0}
                        className="flex items-center px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                        className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                    >
                        {uploading ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                        {uploading ? 'Importing...' : 'Import Excel'}
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                            {isSewingFormat ? (
                                <>
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">DATE</th>
                                        <th className="px-5 py-3 font-semibold">BUILDING</th>
                                        <th className="px-5 py-3 font-semibold">CELL</th>
                                        <th className="px-5 py-3 font-semibold">PO</th>
                                        <th className="px-5 py-3 font-semibold">ARTICLE</th>
                                        <th className="px-5 py-3 font-semibold">MODEL NAME</th>
                                        <th className="px-5 py-3 font-semibold">DEFECT NAME</th>
                                        <th className="px-5 py-3 font-semibold">QTY PRODUCTION</th>
                                        <th className="px-5 py-3 font-semibold">QTY DEFECT</th>
                                        <th className="px-5 py-3 font-semibold">QTY CHECKING</th>
                                        <th className="px-5 py-3 font-semibold text-right">Action</th>
                                    </tr>
                                    <tr>
                                        <th className="px-2 pb-2">{renderExcelFilter('date', 'All Dates')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('building', 'All Bld')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('cell', 'All Cell')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('orderNo', 'All PO')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('article', 'All Art')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('model', 'All Models')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('defectName', 'All Defects')}</th>
                                        <th className="px-2 pb-2"></th>
                                        <th className="px-2 pb-2"></th>
                                        <th className="px-2 pb-2"></th>
                                        <th className="px-2 pb-2"></th>
                                    </tr>
                                </>
                            ) : (
                                <>
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">{moduleType === 'ASSEMBLY' ? 'Date' : 'DATE'}</th>
                                        {moduleType === 'ASSEMBLY' && <th className="px-5 py-3 font-semibold">Time</th>}
                                        <th className="px-5 py-3 font-semibold">{moduleType === 'ASSEMBLY' ? 'Building/Cell' : 'BUILDING / CELL'}</th>
                                        <th className="px-5 py-3 font-semibold">{moduleType === 'ASSEMBLY' ? 'Model' : 'MODEL NAME'}</th>
                                        <th className="px-5 py-3 font-semibold">{moduleType === 'ASSEMBLY' ? 'Article' : 'ARTICLE'}</th>
                                        <th className="px-5 py-3 font-semibold">
                                            {moduleType === 'ASSEMBLY' ? 'Order No / PWI' : 'PO'}
                                        </th>
                                        {moduleType === 'ASSEMBLY' && <th className="px-5 py-3 font-semibold">Seq</th>}
                                        <th className="px-5 py-3 font-semibold">QTY PRODUCTION</th>
                                        <th className="px-5 py-3 font-semibold">QTY CHECKING</th>
                                        <th className="px-5 py-3 font-semibold">QTY DEFECT</th>
                                        {moduleType === 'ASSEMBLY' && <th className="px-5 py-3 font-semibold">Destination</th>}
                                        {!isSewingFormat && <th className="px-5 py-3 font-semibold">{moduleType === 'ASSEMBLY' ? 'Category' : 'CATEGORY'}</th>}
                                        {!isSewingFormat && <th className="px-5 py-3 font-semibold">{moduleType === 'ASSEMBLY' ? 'Type' : 'TYPE'}</th>}
                                        <th className="px-5 py-3 font-semibold">CTQ {moduleType === 'ASSEMBLY' ? 'Type' : 'TYPE'}</th>
                                        <th className="px-5 py-3 font-semibold">DEFECT NAME</th>
                                        <th className="px-5 py-3 font-semibold">USP CLASSIFICATION</th>
                                        <th className="px-5 py-3 font-semibold text-right">Action</th>
                                    </tr>
                                    <tr>
                                        <th className="px-2 pb-2">{renderExcelFilter('date', 'All Dates')}</th>
                                        {moduleType === 'ASSEMBLY' && <th className="px-2 pb-2">{renderExcelFilter('time', 'All Times')}</th>}
                                        <th className="px-2 pb-2">
                                            <div className="flex gap-1">
                                                {renderExcelFilter('building', 'All Bld/F')}
                                                {renderExcelFilter('cell', 'All Cell')}
                                            </div>
                                        </th>
                                        <th className="px-2 pb-2">{renderExcelFilter('model', 'All Models')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('article', 'All Articles')}</th>
                                        <th className="px-2 pb-2">
                                            <div className="flex flex-col gap-1">
                                                {renderExcelFilter('orderNo', 'All Order No')}
                                                {moduleType === 'ASSEMBLY' && renderExcelFilter('pwiNo', 'All PWI')}
                                            </div>
                                        </th>
                                        {moduleType === 'ASSEMBLY' && <th className="px-2 pb-2">{renderExcelFilter('seq', 'All Seq')}</th>}
                                        <th className="px-2 pb-2"></th>
                                        <th className="px-2 pb-2"></th>
                                        <th className="px-2 pb-2"></th>
                                        {moduleType === 'ASSEMBLY' && <th className="px-2 pb-2">{renderExcelFilter('destination', 'All Dest')}</th>}
                                        {!isSewingFormat && <th className="px-2 pb-2">{renderExcelFilter('category', 'All Cat')}</th>}
                                        {!isSewingFormat && <th className="px-2 pb-2">{renderExcelFilter('type', 'All Types')}</th>}
                                        <th className="px-2 pb-2">{renderExcelFilter('ctqType', 'All CTQ')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('defectName', 'All Defects')}</th>
                                        <th className="px-2 pb-2">{renderExcelFilter('uspClassification', 'All USP')}</th>
                                        <th className="px-2 pb-2"></th>
                                    </tr>
                                </>
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
                                            <td className="px-5 py-3 text-gray-600 font-mono text-xs">{row.article || '-'}</td>
                                            <td className="px-5 py-3 text-gray-600 flex flex-col text-xs">
                                                <span>{row.orderNo || '-'}</span>
                                                {moduleType === 'ASSEMBLY' && <span className="text-gray-400">{row.pwiNo}</span>}
                                            </td>
                                            {moduleType === 'ASSEMBLY' && <td className="px-5 py-3 text-gray-600 text-xs">{row.seq || '-'}</td>}
                                            <td className="px-5 py-3 text-gray-900 font-bold">{row.qtyProduction || row.qty || '-'}</td>
                                            <td className="px-5 py-3 text-gray-900 font-bold">120</td>
                                            <td className="px-5 py-3 text-red-600 font-bold">{row.qtyDefect || '-'}</td>
                                            {moduleType === 'ASSEMBLY' && <td className="px-5 py-3 text-gray-600 text-xs">{row.destination || '-'}</td>}
                                            {moduleType !== 'SEWING' && <td className="px-5 py-3 text-gray-600 text-xs">{row.category || '-'}</td>}
                                            {moduleType !== 'SEWING' && <td className="px-5 py-3 text-gray-600 text-xs">{row.type || '-'}</td>}
                                            <td className="px-5 py-3">
                                                {row.ctqType ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {row.ctqType}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic text-xs">Unmapped</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-red-600 font-medium max-w-[200px] truncate" title={row.defectName}>{row.defectName}</td>
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
                </div>

                {/* Pagination Controls */}
                {!loading && data.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Showing <span className="font-medium text-gray-900">{(page - 1) * rowsPerPage + 1}</span> to <span className="font-medium text-gray-900">{Math.min(page * rowsPerPage, data.length)}</span> of <span className="font-medium text-gray-900">{data.length}</span> results
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
