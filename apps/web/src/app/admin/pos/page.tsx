'use client';

import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';

type Po = { po: string; article: string; model: string; destination?: string; qtyOrder: number };

export default function PoManagementPage() {
    const [pos, setPos] = useState<Po[]>([]);
    const [loading, setLoading] = useState(true);
    const [modelSearch, setModelSearch] = useState('');
    const [form, setForm] = useState<Partial<Po>>({});
    const [editPo, setEditPo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPos = async () => {
        setLoading(true);
        const res = await fetch('/api/master/pos');
        setPos(await res.json());
        setLoading(false);
    };

    useEffect(() => { fetchPos(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const qty = Number(String(form.qtyOrder || '0').replace(/\./g, '').replace(/,/g, ''));
        if (isNaN(qty) || qty < 1) return alert('Order Qty must be a valid positive number.');
        if (editPo) {
            await fetch(`/api/master/pos/${encodeURIComponent(editPo)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, qtyOrder: qty }) });
        } else {
            await fetch('/api/master/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, qtyOrder: qty }) });
        }
        setEditPo(null);
        setForm({});
        fetchPos();
    };

    const handleDelete = async (po: string) => {
        if (!confirm('Delete this PO? Existing audits linked to it may lose context.')) return;
        const res = await fetch(`/api/master/pos/${encodeURIComponent(po)}`, { method: 'DELETE' });
        if (!res.ok) alert('Cannot delete: this PO is already referenced by an Audit Session.');
        fetchPos();
    };

    const downloadTemplate = () => {
        const sampleData = [
            { PO: '0902661124', ARTICLE: 'KI1672', MODEL: 'GALAXY 8 J', DESTINATION: 'U.S.A', 'ORDER QTY': 7 },
            { PO: '0902629311', ARTICLE: 'IE8794', MODEL: 'ULTRARUN 5', DESTINATION: 'ADIDAS INTL TRADING AG Lager', 'ORDER QTY': 553 },
            { PO: '0902772246', ARTICLE: 'IH9795', MODEL: 'GALAXY 8 W', DESTINATION: 'A.ARGENTINA S.A.', 'ORDER QTY': 674 },
            { PO: '0902777039', ARTICLE: 'IH9808', MODEL: 'GALAXY 8 M', DESTINATION: 'A.I.TR. WEST', 'ORDER QTY': 342 },
            { PO: '0902770032', ARTICLE: 'IH9823', MODEL: 'QUESTAR 4 W', DESTINATION: 'A.ARGENTINA S.A.', 'ORDER QTY': 1000 },
            { PO: '0902770129', ARTICLE: 'IH9829', MODEL: 'RUNFALCON 5 TR', DESTINATION: 'A.ARGENTINA S.A.', 'ORDER QTY': 887 },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 35 }, { wch: 14 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PO_DATA');
        XLSX.writeFile(wb, 'PO_IMPORT_TEMPLATE.xlsx');
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                if (jsonRows.length === 0) return alert('File is empty or unreadable.');

                const mapHeader = (row: any, keys: string[]): string => {
                    for (const k of Object.keys(row)) {
                        const kLower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        for (const target of keys) { if (kLower.includes(target)) return row[k]?.toString().trim() || ''; }
                    }
                    return '';
                };

                const dataToUpload: Po[] = [];
                for (const row of jsonRows) {
                    const po = mapHeader(row, ['po']);
                    if (!po) continue;
                    const qtyRaw = mapHeader(row, ['orderqty', 'qty', 'quantity']);
                    dataToUpload.push({
                        po,
                        article: mapHeader(row, ['article', 'art']) || '-',
                        model: mapHeader(row, ['model', 'mdl']) || '-',
                        destination: mapHeader(row, ['destination', 'dest']) || '-',
                        qtyOrder: parseInt(qtyRaw.replace(/\./g, '').replace(/,/g, '')) || 0
                    });
                }

                if (dataToUpload.length === 0) return alert('No valid rows found. Ensure headers include: PO, ARTICLE, MODEL, DESTINATION, ORDER QTY.');

                const res = await fetch('/api/master/pos/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToUpload) });
                if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Import failed'); }
                alert(`Imported ${dataToUpload.length} purchase orders.`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                fetchPos();
            } catch (err: any) {
                alert(`Import failed: ${err.message || 'Unknown error'}`);
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const cancelEdit = () => { setEditPo(null); setForm({}); };
    const displayedPos = pos.filter(p => p.model.toLowerCase().includes(modelSearch.toLowerCase()));

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900">Purchase Orders</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage PO master data for audit sessions.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        placeholder="Filter model..."
                        className="border border-gray-200 rounded px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-gray-400 transition-colors"
                        value={modelSearch}
                        onChange={e => setModelSearch(e.target.value)}
                    />
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileInputRef} onChange={handleImportFile} />
                    <button onClick={downloadTemplate} className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors">
                        Download template
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors">
                        Import Excel
                    </button>
                    <button onClick={cancelEdit} className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors">
                        + New PO
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Form */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden h-fit">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-gray-800">{editPo ? `Editing: ${editPo}` : 'New Purchase Order'}</h2>
                        {editPo && <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Cancel</button>}
                    </div>
                    <form onSubmit={handleSave} className="p-4 space-y-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">PO Number</label>
                            <input required type="text" disabled={!!editPo} value={form.po || ''} onChange={e => setForm({ ...form, po: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Article</label>
                            <input required type="text" value={form.article || ''} onChange={e => setForm({ ...form, article: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Model</label>
                            <input required type="text" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Destination</label>
                            <input type="text" value={form.destination || ''} onChange={e => setForm({ ...form, destination: e.target.value.toUpperCase() })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Order Qty</label>
                            <input required type="number" min="1" value={form.qtyOrder || ''} onChange={e => setForm({ ...form, qtyOrder: parseInt(e.target.value) })} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <button type="submit" className="w-full bg-gray-900 text-white py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors">
                            {editPo ? 'Save changes' : 'Create PO'}
                        </button>
                    </form>
                </div>

                {/* Table */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-gray-800">
                            Purchase Orders
                            <span className="ml-1.5 text-xs text-gray-400 font-normal">{displayedPos.length} records</span>
                        </h2>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
                    ) : (
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 w-32">PO</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Article</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Model</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Destination</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 w-20">Qty</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedPos.map(p => (
                                        <tr key={p.po} className={`border-b border-gray-50 transition-colors ${editPo === p.po ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                                            <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{p.po}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{p.article}</td>
                                            <td className="px-4 py-2.5 text-gray-800 font-medium">{p.model}</td>
                                            <td className="px-4 py-2.5 text-gray-500 max-w-[180px] truncate" title={p.destination || '-'}>{p.destination || '-'}</td>
                                            <td className="px-4 py-2.5 text-right font-mono text-gray-700">{p.qtyOrder.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="inline-flex gap-1">
                                                    <button onClick={() => { setEditPo(p.po); setForm(p); }} className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">Edit</button>
                                                    <button onClick={() => handleDelete(p.po)} className="px-2 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedPos.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                                                No purchase orders found. Use &quot;Import Excel&quot; to upload from your datasheet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
