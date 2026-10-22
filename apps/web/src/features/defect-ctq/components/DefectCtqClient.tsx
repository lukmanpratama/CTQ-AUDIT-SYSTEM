'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Rates: 2 decimals, above half up, exact half down (2,058 -> 2,06; 2,055 -> 2,05)
import { formatRate } from '../../../lib/format-rate';
import { apiClient } from '../../../lib/api-client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { modelLabel } from '../../../lib/model-label';
import { useDataRefresh } from '../../../lib/use-data-refresh';

// Bar colours follow the section headers: RQC yellow, TQC red
const RQC_COLOR = '#FFB00F';
const TQC_COLOR = '#D9262C';

export function DefectCtqClient({ searchParams }: { searchParams: any }) {
    const router = useRouter();
    const modelId = searchParams?.modelId;

    const [modelName, setModelName] = useState("LOADING...");
    const [usps, setUsps] = useState<string[]>(['BUNNY EAR', 'LINE UP 3 STRIPES', 'VARIASI WARNA']);
    const [activeUsp, setActiveUsp] = useState<string>('BUNNY EAR');

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [cell, setCell] = useState('');
    const [availableCells, setAvailableCells] = useState<string[]>([]);

    // Metrics Data
    const [rqcData, setRqcData] = useState({ passRate: 100, defectRate: 0, qtyCheck: 0, qtyDefect: 0 });
    const [tqcData, setTqcData] = useState({ passRate: 100, defectRate: 0, qtyCheck: 0, qtyDefect: 0 });

    // Chart Data
    const [rqcDefectRateByProcess, setRqcDefectRateByProcess] = useState<any[]>([]);
    const [rqcQtyDefect, setRqcQtyDefect] = useState<any[]>([]);
    const [tqcDefectRate, setTqcDefectRate] = useState<any[]>([]);
    const [tqcQtyDefect, setTqcQtyDefect] = useState<any[]>([]);

    // Cross-filter: a clicked process (RQC) / defect (TQC) narrows the Qty Defect chart next to it
    const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
    const [selectedTqcDefect, setSelectedTqcDefect] = useState<string | null>(null);

    // Raw payload from API (to re-calc when active USP changes)
    const [summaryPayload, setSummaryPayload] = useState<any>(null);

    // Reload when someone adds / changes data
    const { refreshKey } = useDataRefresh();
    useEffect(() => {
        if (!modelId) return;
        const fetchDashboardData = async () => {
            try {
                // 1. Fetch Basic Model Info
                const modelRes = await apiClient.get(`/ctq-setup/models/${modelId}/tree`) as any;
                if (modelRes && modelRes.model) setModelName(modelLabel(modelRes.model) || "UNKNOWN MODEL");

                // 2. Fetch the CTQ Defect Summary API
                let url = `/rqc/defect-ctq-summary?modelId=${modelId}`;
                if (startDate) url += `&startDate=${startDate}`;
                if (endDate) url += `&endDate=${endDate}`;
                if (cell) url += `&cell=${encodeURIComponent(cell)}`;

                // 3. Fetch cells from headers
                // Only the cells are used here; the full header list is heavy
                const headersUrl = `/rqc/header-cells?modelId=${modelId}`;
                const [res, headersRes] = await Promise.all([
                    apiClient.get(url) as any,
                    apiClient.get(headersUrl) as any
                ]);

                if (headersRes) {
                    const uniqueCells = new Set<string>();
                    headersRes.forEach((h: any) => {
                        const c = (h.cell || '').trim();
                        if (c) uniqueCells.add(c);
                    });
                    setAvailableCells(Array.from(uniqueCells).sort());
                }

                if (res) {
                    setSummaryPayload(res);
                    if (res.usps && res.usps.length > 0) {
                        setUsps(res.usps);
                        // Only set activeUsp if the current one isn't valid anymore
                        if (!activeUsp || !res.usps.includes(activeUsp)) {
                            setActiveUsp(res.usps[0]);
                        }
                    } else {
                        setUsps([]);
                        setActiveUsp('');
                    }
                }
            } catch (error) {
                console.error("Failed to load Defect CTQ Summary:", error);
            }
        };
        fetchDashboardData();
    }, [modelId, startDate, endDate, cell, refreshKey]);

    // Update KPI Boxes & Charts when active USP or Payload changes
    useEffect(() => {
        setSelectedProcess(null);
        setSelectedTqcDefect(null);
        if (!summaryPayload || !activeUsp) {
            setRqcData({ passRate: 100, defectRate: 0, qtyCheck: 0, qtyDefect: 0 });
            setTqcData({ passRate: 100, defectRate: 0, qtyCheck: 0, qtyDefect: 0 });
            setRqcDefectRateByProcess([]);
            setRqcQtyDefect([]);
            setTqcDefectRate([]);
            setTqcQtyDefect([]);
            return;
        }

        const payload = summaryPayload;

        // 1. KPI Data for active USP
        if (payload.rqcData && payload.rqcData[activeUsp]) {
            setRqcData(payload.rqcData[activeUsp]);
        } else {
            setRqcData({ passRate: 100, defectRate: 0, qtyCheck: 0, qtyDefect: 0 });
        }

        if (payload.tqcData && payload.tqcData[activeUsp]) {
            setTqcData(payload.tqcData[activeUsp]);
        } else {
            setTqcData({ passRate: 100, defectRate: 0, qtyCheck: 0, qtyDefect: 0 });
        }

        if (payload.rqcTopProcessesByUsp && payload.rqcTopProcessesByUsp[activeUsp]) {
            const mapped = payload.rqcTopProcessesByUsp[activeUsp];
            setRqcDefectRateByProcess([...mapped]); // Defect Rate
        } else {
            setRqcDefectRateByProcess([]);
        }

        if (payload.rqcTopDefectsByUsp && payload.rqcTopDefectsByUsp[activeUsp]) {
            const mapped = payload.rqcTopDefectsByUsp[activeUsp];
            setRqcQtyDefect([...mapped].sort((a: any, b: any) => b.qty - a.qty)); // Qty chart reads defects
        } else {
            setRqcQtyDefect([]);
        }

        if (payload.tqcTopDefectsByUsp && payload.tqcTopDefectsByUsp[activeUsp]) {
            const mapped = payload.tqcTopDefectsByUsp[activeUsp];
            setTqcDefectRate([...mapped]); // Defect Rate
            setTqcQtyDefect([...mapped].sort((a: any, b: any) => b.qty - a.qty)); // Re-sort by QTY
        } else {
            setTqcDefectRate([]);
            setTqcQtyDefect([]);
        }
    }, [summaryPayload, activeUsp]);

    // Format numbers
    const formatPct = (val: number) => formatRate(typeof val === 'number' ? val : 0);

    // Qty Defect charts after the cross-filter: RQC shows the clicked process's own quantities
    const rqcQtyShown = selectedProcess
        ? rqcQtyDefect
            .filter((d: any) => d.byProcess?.[selectedProcess])
            .map((d: any) => ({ ...d, qty: d.byProcess[selectedProcess] }))
            .sort((a: any, b: any) => b.qty - a.qty)
        : rqcQtyDefect;
    const tqcQtyShown = selectedTqcDefect ? tqcQtyDefect.filter((d: any) => d.name === selectedTqcDefect) : tqcQtyDefect;

    // KPI cards follow the cross-filter too: the clicked bar carries its own rate, defects and checked qty
    // (RQC: that process; TQC: that defect against all TQC checking)
    const kpiFor = (bar: any) => ({ passRate: 100 - (bar.rate || 0), defectRate: bar.rate || 0, qtyCheck: bar.qtyCheck || 0, qtyDefect: bar.qty || 0 });
    const selectedRqcBar = selectedProcess ? rqcDefectRateByProcess.find((p: any) => p.name === selectedProcess) : null;
    const selectedTqcBar = selectedTqcDefect ? tqcDefectRate.find((d: any) => d.name === selectedTqcDefect) : null;
    const rqcKpi = selectedRqcBar ? kpiFor(selectedRqcBar) : rqcData;
    const tqcKpi = selectedTqcBar ? kpiFor(selectedTqcBar) : tqcData;

    // Clicking the selected bar again clears the filter
    const toggle = (setter: React.Dispatch<React.SetStateAction<string | null>>) => (bar: any) => {
        const name = bar?.name ?? bar?.payload?.name;
        if (name) setter(prev => (prev === name ? null : name));
    };

    // Title with the active cross-filter and a button to clear it
    const ChartTitle = ({ title, filter, onClear }: { title: string; filter: string | null; onClear: () => void }) => (
        <div className="flex items-center justify-between gap-2 mb-2 min-h-[20px]">
            <h3 className="font-bold uppercase text-xs">{title}</h3>
            {filter && (
                <button onClick={onClear} className="max-w-[60%] truncate text-[10px] px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200" title="Clear filter">
                    {filter} ✕
                </button>
            )}
        </div>
    );
    const formatQty = (val: number) => typeof val === 'number' ? val.toLocaleString('id-ID') : '0';

    const CustomTooltipPct = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border text-gray-800 p-2 shadow rounded text-xs">
                    <p className="font-bold mb-1">{payload[0].payload.name}</p>
                    <p>{formatRate(payload[0].value)}</p>
                </div>
            );
        }
        return null;
    };

    const CustomTooltipQty = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border text-gray-800 p-2 shadow rounded text-xs">
                    <p className="font-bold mb-1">{payload[0].payload.name}</p>
                    <p>{payload[0].value} Pcs</p>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-[#2482E4] text-white text-center py-4 relative shadow-md">
                <h1 className="text-2xl font-bold uppercase tracking-wider">SUMMARY USP CTQ DEFECT</h1>
            </div>

            <div className="p-4 mx-auto w-full flex flex-col gap-4 flex-1">

                {/* Filters Row */}
                <div className="flex items-center justify-between gap-4">
                    {/* Date Picker */}
                    <div className="flex gap-2 shrink-0 bg-white border rounded p-1 shadow-sm">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 outline-none text-sm text-gray-700 bg-transparent" />
                        <span className="text-gray-400 self-center">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1 outline-none text-sm text-gray-700 bg-transparent" />
                    </div>

                    {/* USP Sub Menus */}
                    <div className="flex-1 flex justify-center gap-2 overflow-x-auto px-2">
                        {usps.map((usp, i) => (
                            <button
                                key={usp}
                                onClick={() => setActiveUsp(usp)}
                                className={`px-4 py-2 font-bold text-sm rounded shadow-sm uppercase whitespace-nowrap transition-colors ${activeUsp === usp
                                    ? 'bg-[#2482E4] text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 border'
                                    }`}
                            >
                                {usp}
                            </button>
                        ))}
                    </div>

                    {/* Factory Cell */}
                    <div className="w-[200px] shrink-0 bg-white border rounded p-1 shadow-sm">
                        <select
                            value={cell}
                            onChange={e => setCell(e.target.value)}
                            className="w-full p-1 border-none bg-transparent outline-none text-sm font-bold text-gray-700 uppercase"
                        >
                            <option value="">ALL FACTORY/CELL</option>
                            {availableCells.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* KPI Boxes */}
                <div className="flex gap-4">
                    {/* RQC */}
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="bg-[#FFB00F] text-white text-center py-2 font-bold uppercase rounded shadow-sm text-xl tracking-wider truncate px-3">
                            RQC
                            {/* The cards below show only the bar clicked in the charts */}
                            {selectedProcess && <span className="text-sm font-semibold normal-case tracking-normal"> · {selectedProcess}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Pass Rate</span>
                                <span className="text-3xl font-bold text-green-600 mt-2">{formatPct(rqcKpi.passRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Defect Rate</span>
                                <span className="text-3xl font-bold text-red-600 mt-2">{formatPct(rqcKpi.defectRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Check</span>
                                <span className="text-3xl font-bold text-green-700 mt-2">{formatQty(rqcKpi.qtyCheck)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Defect</span>
                                <span className="text-3xl font-bold text-red-700 mt-2">{formatQty(rqcKpi.qtyDefect)}</span>
                            </div>
                        </div>
                    </div>

                    {/* TQC */}
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="bg-[#D9262C] text-white text-center py-2 font-bold uppercase rounded shadow-sm text-xl tracking-wider truncate px-3">
                            TQC
                            {/* The cards below show only the bar clicked in the charts */}
                            {selectedTqcDefect && <span className="text-sm font-semibold normal-case tracking-normal"> · {selectedTqcDefect}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Pass Rate</span>
                                <span className="text-3xl font-bold text-green-600 mt-2">{formatPct(tqcKpi.passRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Defect Rate</span>
                                <span className="text-3xl font-bold text-red-600 mt-2">{formatPct(tqcKpi.defectRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Checking</span>
                                <span className="text-3xl font-bold text-green-700 mt-2">{formatQty(tqcKpi.qtyCheck)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Defect</span>
                                <span className="text-3xl font-bold text-red-700 mt-2">{formatQty(tqcKpi.qtyDefect)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CHARTS */}
                <div className="grid grid-cols-4 gap-2 flex-1 min-h-[350px]">
                    {/* RQC Defect Rate By Process */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <ChartTitle title="RQC DEFECT RATE BY PROCESS" filter={selectedProcess} onClear={() => setSelectedProcess(null)} />
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rqcDefectRateByProcess} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipPct />} />
                                    <Bar dataKey="rate" isAnimationActive={false} cursor="pointer" onClick={toggle(setSelectedProcess)}>
                                        <LabelList dataKey="rate" position="right" fontSize={10} fill="#374151" formatter={(val: number) => formatPct(val)} />
                                        {rqcDefectRateByProcess.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={RQC_COLOR} fillOpacity={selectedProcess && entry.name !== selectedProcess ? 0.3 : 1} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* RQC QTY DEFECT */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <ChartTitle title="QTY DEFECT (RQC)" filter={selectedProcess} onClear={() => setSelectedProcess(null)} />
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rqcQtyShown} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipQty />} />
                                    <Bar dataKey="qty" isAnimationActive={false}>
                                        <LabelList dataKey="qty" position="right" fontSize={10} fill="#374151" />
                                        {rqcQtyShown.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={RQC_COLOR} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* TQC DEFECT RATE */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <ChartTitle title="TQC DEFECT RATE" filter={selectedTqcDefect} onClear={() => setSelectedTqcDefect(null)} />
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tqcDefectRate} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipPct />} />
                                    <Bar dataKey="rate" isAnimationActive={false} cursor="pointer" onClick={toggle(setSelectedTqcDefect)}>
                                        <LabelList dataKey="rate" position="right" fontSize={10} fill="#374151" formatter={(val: number) => formatPct(val)} />
                                        {tqcDefectRate.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={TQC_COLOR} fillOpacity={selectedTqcDefect && entry.name !== selectedTqcDefect ? 0.3 : 1} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* TQC QTY DEFECT */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <ChartTitle title="TQC QTY DEFECT" filter={selectedTqcDefect} onClear={() => setSelectedTqcDefect(null)} />
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tqcQtyShown} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipQty />} />
                                    <Bar dataKey="qty" isAnimationActive={false}>
                                        <LabelList dataKey="qty" position="right" fontSize={10} fill="#374151" />
                                        {tqcQtyShown.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={TQC_COLOR} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                <div className="flex justify-end mt-4 pb-10">
                    <button
                        onClick={() => router.push(`/model-dashboard?modelId=${modelId}`)}
                        className="bg-[#3b82f6] text-white px-8 py-2 rounded font-bold hover:bg-blue-600 shadow"
                    >
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
}
