'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { modelLabel } from '../../../lib/model-label';

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

    // Raw payload from API (to re-calc when active USP changes)
    const [summaryPayload, setSummaryPayload] = useState<any>(null);

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
                const headersUrl = `/rqc/headers?modelId=${modelId}`;
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
    }, [modelId, startDate, endDate, cell]);

    // Update KPI Boxes & Charts when active USP or Payload changes
    useEffect(() => {
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
    const formatPct = (val: number) => typeof val === 'number' ? `${val.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%` : '0%';
    const formatQty = (val: number) => typeof val === 'number' ? val.toLocaleString('id-ID') : '0';

    const CustomTooltipPct = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border text-gray-800 p-2 shadow rounded text-xs">
                    <p className="font-bold mb-1">{payload[0].payload.name}</p>
                    <p>{`${payload[0].value}%`}</p>
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
                        <div className="bg-[#FFB00F] text-white text-center py-2 font-bold uppercase rounded shadow-sm text-xl tracking-wider">RQC</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Pass Rate</span>
                                <span className="text-3xl font-bold text-green-600 mt-2">{formatPct(rqcData.passRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Defect Rate</span>
                                <span className="text-3xl font-bold text-red-600 mt-2">{formatPct(rqcData.defectRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Check</span>
                                <span className="text-3xl font-bold text-green-700 mt-2">{formatQty(rqcData.qtyCheck)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Defect</span>
                                <span className="text-3xl font-bold text-red-700 mt-2">{formatQty(rqcData.qtyDefect)}</span>
                            </div>
                        </div>
                    </div>

                    {/* TQC */}
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="bg-[#D9262C] text-white text-center py-2 font-bold uppercase rounded shadow-sm text-xl tracking-wider">TQC</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Pass Rate</span>
                                <span className="text-3xl font-bold text-green-600 mt-2">{formatPct(tqcData.passRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Defect Rate</span>
                                <span className="text-3xl font-bold text-red-600 mt-2">{formatPct(tqcData.defectRate)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Checking</span>
                                <span className="text-3xl font-bold text-green-700 mt-2">{formatQty(tqcData.qtyCheck)}</span>
                            </div>
                            <div className="bg-white border rounded p-4 flex flex-col shadow-sm items-center justify-center min-h-[90px] relative">
                                <span className="text-xs text-gray-500 font-semibold absolute top-2 left-3 uppercase">Qty Defect</span>
                                <span className="text-3xl font-bold text-red-700 mt-2">{formatQty(tqcData.qtyDefect)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CHARTS */}
                <div className="grid grid-cols-4 gap-2 flex-1 min-h-[350px]">
                    {/* RQC Defect Rate By Process */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <h3 className="font-bold uppercase text-xs mb-2">RQC DEFECT RATE BY PROCESS</h3>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rqcDefectRateByProcess} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipPct />} />
                                    <Bar dataKey="rate" isAnimationActive={false}>
                                        <LabelList dataKey="rate" position="right" fontSize={10} fill="#374151" formatter={(val: number) => typeof val === 'number' ? Math.round(val) + '%' : '0%'} />
                                        {rqcDefectRateByProcess.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.isUsp ? "#ec4899" : "#f59e0b"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* RQC QTY DEFECT */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <h3 className="font-bold uppercase text-xs mb-2">QTY DEFECT (RQC)</h3>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rqcQtyDefect} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipQty />} />
                                    <Bar dataKey="qty" isAnimationActive={false}>
                                        <LabelList dataKey="qty" position="right" fontSize={10} fill="#374151" />
                                        {rqcQtyDefect.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.isUsp ? "#ec4899" : "#f59e0b"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* TQC DEFECT RATE */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <h3 className="font-bold uppercase text-xs mb-2">TQC DEFECT RATE</h3>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tqcDefectRate} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipPct />} />
                                    <Bar dataKey="rate" isAnimationActive={false}>
                                        <LabelList dataKey="rate" position="right" fontSize={10} fill="#374151" formatter={(val: number) => typeof val === 'number' ? Math.round(val) + '%' : '0%'} />
                                        {tqcDefectRate.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.isUsp ? "#ec4899" : "#b91c1c"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* TQC QTY DEFECT */}
                    <div className="bg-white border rounded shadow-sm p-3 flex flex-col text-gray-800">
                        <h3 className="font-bold uppercase text-xs mb-2">TQC QTY DEFECT</h3>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tqcQtyDefect} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipQty />} />
                                    <Bar dataKey="qty" isAnimationActive={false}>
                                        <LabelList dataKey="qty" position="right" fontSize={10} fill="#374151" />
                                        {tqcQtyDefect.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.isUsp ? "#ec4899" : "#b91c1c"} />
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
