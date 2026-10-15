'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    ReferenceLine,
    LabelList,
    Cell
} from 'recharts';
import { apiClient } from '../../../lib/api-client';
import { tqcRowMatchesModel } from '../../../lib/model-label';

const CustomBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    return (
        <text
            x={x + width / 2}
            y={y - 8}
            fill="#EF4444"
            textAnchor="middle"
            fontSize={11}
            fontWeight="600"
        >
            {`${value}%`}
        </text>
    );
};

const CustomReferenceLabel = (props: any) => {
    const { viewBox } = props;
    const { x, y } = viewBox;
    const w = 150;
    const h = 24;
    return (
        <g>
            <rect x={x + 20} y={y - h / 2} width={w} height={h} fill="#93C5FD" />
            <text x={x + 20 + w / 2} y={y + 4} fill="#1E3A8A" fontSize={12} fontWeight="bold" textAnchor="middle">
                DEFECT LIMIT {'>'} 20%
            </text>
        </g>
    );
};

function CtqDashboardInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const modelId = searchParams.get('modelId');

    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<any[]>([]);

    // Tab State
    const [activeTab, setActiveTab] = useState<'TQC' | 'RQC'>('TQC');

    // Filter states
    const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Factory/Cell state
    const [isFactoryFilterOpen, setIsFactoryFilterOpen] = useState(false);
    const [availableFactoryCells, setAvailableFactoryCells] = useState<string[]>([]);
    const [selectedFactoryCell, setSelectedFactoryCell] = useState<string>('');

    const handleTabChange = (tab: 'TQC' | 'RQC') => {
        if (tab !== activeTab) {
            setStartDate('');
            setEndDate('');
            setTempStartDate('');
            setTempEndDate('');
            setSelectedFactoryCell('');
            setActiveTab(tab);
        }
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!modelId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                if (activeTab === 'TQC') {
                    // --- TQC LOGIC ---
                    const treeRes = await apiClient.get<any>(`/ctq-setup/models/${modelId}/tree`);
                    const setupModel = treeRes?.model;
                    const modelName = setupModel?.modelName;

                    if (!modelName) {
                        setChartData([]);
                        setAvailableFactoryCells([]);
                        setLoading(false);
                        return;
                    }

                    const tqcData = await apiClient.get<any[]>('/tqc/ASSEMBLY');

                    const modelTqcData = tqcData.filter(r => tqcRowMatchesModel(r, setupModel));

                    const uniqueLocs = new Set<string>();
                    modelTqcData.forEach(r => {
                        const loc = (r.cell || r.building || '').trim();
                        if (loc) uniqueLocs.add(loc);
                    });
                    setAvailableFactoryCells(Array.from(uniqueLocs).sort());

                    // CTQ Validation removed

                    const filtered = modelTqcData.filter(r => {
                        if (startDate || endDate) {
                            const rDate = new Date(r.date).getTime();
                            if (startDate && rDate < new Date(startDate).getTime()) return false;
                            if (endDate && rDate > new Date(endDate + 'T23:59:59').getTime()) return false;
                        }

                        if (selectedFactoryCell) {
                            const loc = (r.cell || r.building || '').trim();
                            if (loc !== selectedFactoryCell) return false;
                        }

                        return true;
                    });

                    // Pre-calculate Global TQC Total Checking precisely mapping to how initial dashboard computes it.
                    // Standard limit rule: 1 unique cell active in a day = 960 (120 checks * 8 hours).
                    const globalTqcUniqueChecks = new Map<string, number>();

                    filtered.forEach(r => {
                        const cellKey = (r.cell || r.building || 'no-cell').trim();
                        let dateKey = 'no-date';
                        if (r.date) {
                            try {
                                dateKey = new Date(r.date).toISOString().split('T')[0];
                            } catch (e) {
                                dateKey = r.date.toString();
                            }
                        }
                        const uniqueDayCellKey = `${dateKey}_${cellKey}`;
                        globalTqcUniqueChecks.set(uniqueDayCellKey, 960);
                    });

                    let globalTqcTotalChecking = 0;
                    globalTqcUniqueChecks.forEach(qty => globalTqcTotalChecking += qty);

                    // Track defects and their specific inspection rounds
                    const defectInstances: Record<string, { totalDefect: number }> = {};

                    filtered.forEach(r => {
                        if (!r.defectName) return;
                        const name = r.defectName.trim();

                        if (!defectInstances[name]) {
                            defectInstances[name] = { totalDefect: 0 };
                        }

                        // Add defect count
                        defectInstances[name].totalDefect += (r.qtyDefect || 0);
                    });

                    const calculated = Object.keys(defectInstances).map(name => {
                        const { totalDefect } = defectInstances[name];
                        const rate = globalTqcTotalChecking > 0 ? (totalDefect / globalTqcTotalChecking) * 100 : 0;
                        return { name, defectRate: parseFloat(rate.toFixed(2)) };
                    });

                    calculated.sort((a, b) => b.defectRate - a.defectRate);
                    setChartData(calculated.slice(0, 25));

                } else {
                    // --- RQC LOGIC ---
                    let url = `/rqc/process-defects?modelId=${modelId}`;
                    if (startDate) url += `&startDate=${startDate}`;
                    if (endDate) url += `&endDate=${endDate}`;
                    if (selectedFactoryCell) url += `&cell=${encodeURIComponent(selectedFactoryCell)}`;

                    const headersUrl = `/rqc/headers?modelId=${modelId}`;

                    const [rqcRes, headersRes] = await Promise.all([
                        apiClient.get<any>(url),
                        apiClient.get<any[]>(headersUrl)
                    ]);

                    const areas = rqcRes?.areas || [];

                    // Populate FACTORY/CELL Dropdown globally for this model based on headers
                    const uniqueCells = new Set<string>();
                    (headersRes || []).forEach((h: any) => {
                        const cell = (h.cell || '').trim();
                        if (cell) uniqueCells.add(cell);
                    });
                    setAvailableFactoryCells(Array.from(uniqueCells).sort());

                    const globalRqcTotalChecking = rqcRes?.rqcOverallStats?.totalChecking || 0;

                    const defectInstancesRqc: Record<string, { totalDefect: number }> = {};

                    areas.forEach((area: any) => {
                        area.processes?.forEach((proc: any) => {
                            proc.defects?.forEach((d: any) => {
                                if (!d.defectName) return;
                                const name = d.defectName.trim();
                                if (!defectInstancesRqc[name]) {
                                    defectInstancesRqc[name] = { totalDefect: 0 };
                                }
                                defectInstancesRqc[name].totalDefect += (d.qtyDefect || 0);
                            });
                        });
                    });

                    const calculated = Object.keys(defectInstancesRqc).map(name => {
                        const { totalDefect } = defectInstancesRqc[name];
                        const rate = globalRqcTotalChecking > 0 ? (totalDefect / globalRqcTotalChecking) * 100 : 0;
                        return { name, defectRate: parseFloat(rate.toFixed(2)) };
                    });

                    calculated.sort((a, b) => b.defectRate - a.defectRate);
                    setChartData(calculated.slice(0, 25));
                }

            } catch (error) {
                console.error(`Failed to fetch ${activeTab} data for CTQ Dashboard`, error);
                setChartData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [modelId, startDate, endDate, activeTab, selectedFactoryCell]);

    const applyDateFilter = () => {
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
        setIsDateFilterOpen(false);
    };

    const clearDateFilter = () => {
        setTempStartDate('');
        setTempEndDate('');
        setStartDate('');
        setEndDate('');
        setIsDateFilterOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Top Red Header */}
            <header className="bg-[#ef3b3a] py-3 shadow-md w-full shrink-0 flex items-center justify-center">
                <h1 className="text-white text-3xl font-black tracking-widest uppercase text-center m-0 w-full" style={{ WebkitTextStroke: '0.5px white' }}>
                    CTQ
                </h1>
            </header>

            {/* Content Container */}
            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 flex flex-col gap-6">

                {/* Controls Area */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                    {/* Left Toggles */}
                    <div className="flex bg-white rounded-md overflow-hidden shadow-sm border border-gray-200">
                        <button
                            className={`px-6 py-2.5 font-bold text-sm tracking-wide transition-colors ${activeTab === 'TQC' ? 'bg-[#ef4444] text-white' : 'bg-[#9ca3af] hover:bg-[#6b7280] text-white'}`}
                            onClick={() => handleTabChange('TQC')}
                        >
                            CTQ TQC EOL
                        </button>
                        <button
                            className={`px-6 py-2.5 font-bold text-sm tracking-wide border-l border-gray-300 transition-colors ${activeTab === 'RQC' ? 'bg-[#ef4444] text-white' : 'bg-[#9ca3af] hover:bg-[#6b7280] text-white'}`}
                            onClick={() => handleTabChange('RQC')}
                        >
                            CTQ RQC INLINE
                        </button>
                    </div>
                    {/* Right Selects */}
                    <div className="flex gap-3 relative">
                        <div className="relative">
                            <button
                                onClick={() => setIsFactoryFilterOpen(!isFactoryFilterOpen)}
                                className="bg-[#2482E4] hover:bg-blue-600 text-white px-5 py-2.5 rounded-md font-semibold text-sm shadow-sm flex items-center gap-2 min-w-[150px] justify-between"
                            >
                                <span className="truncate">{selectedFactoryCell || 'FACTORY/CELL'}</span>
                                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                            </button>
                            {isFactoryFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-md p-2 z-50 min-w-[200px] max-h-60 overflow-y-auto">
                                    <button
                                        onClick={() => { setSelectedFactoryCell(''); setIsFactoryFilterOpen(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${!selectedFactoryCell ? 'font-bold text-blue-600' : 'text-gray-700'}`}
                                    >
                                        Semua Factory/Cell
                                    </button>
                                    {availableFactoryCells.map(cell => (
                                        <button
                                            key={cell}
                                            onClick={() => { setSelectedFactoryCell(cell); setIsFactoryFilterOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${selectedFactoryCell === cell ? 'font-bold text-blue-600' : 'text-gray-700'}`}
                                        >
                                            {cell}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                                className="bg-[#2482E4] hover:bg-blue-600 text-white px-5 py-2.5 rounded-md font-semibold text-sm shadow-sm flex items-center gap-2 min-w-[200px] justify-between"
                            >
                                {startDate || endDate ? `${startDate || 'Start'} - ${endDate || 'End'}` : 'Pilih rentang tanggal'}
                                <ChevronDown className="w-4 h-4 ml-2" />
                            </button>

                            {isDateFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-md p-4 z-50 w-72">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-bold text-sm text-gray-700">Filter Tanggal</span>
                                        <button onClick={() => setIsDateFilterOpen(false)} className="text-gray-400 hover:text-gray-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                                            <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                                            <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={clearDateFilter} className="flex-1 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 py-1.5 rounded text-sm font-medium">Clear</button>
                                            <button onClick={applyDateFilter} className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-1.5 rounded text-sm font-medium">Apply</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div >

                {/* Chart Container */}
                < div className="bg-white border rounded-xl shadow-sm p-4 pt-12 flex-1 w-full flex flex-col min-h-[500px]" >
                    {
                        mounted ? (
                            loading ? (
                                <div className="flex items-center justify-center h-full w-full flex-col text-gray-400">
                                    <svg className="animate-spin mb-3 h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>Loading {activeTab} Data...</span>
                                </div>
                            ) : chartData.length === 0 ? (
                                <div className="flex items-center justify-center h-full w-full text-gray-400 italic">
                                    Belum ada data {activeTab} {activeTab === 'TQC' ? 'Assembly' : ''} untuk {modelId ? 'model ini' : 'rentang waktu yang dipilih'}.{modelId ? '' : ' Silakan pilih model terlebih dahulu.'}
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%" minHeight={450}>
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 0, bottom: 120 }}
                                    >
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 10, fill: '#6B7280' }}
                                            interval={0}
                                            angle={-30}
                                            textAnchor="end"
                                            axisLine={{ stroke: '#E5E7EB' }}
                                            tickLine={false}
                                            tickFormatter={(val) => val.length > 30 ? val.substring(0, 30) + '...' : val}
                                        />
                                        <YAxis
                                            tickFormatter={(value) => `${value}%`}
                                            domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 25)]}
                                            ticks={[0, 5, 10, 15, 20]}
                                            tick={{ fontSize: 11, fill: '#4B5563' }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={45}
                                        />

                                        <ReferenceLine
                                            y={20}
                                            stroke="#60A5FA"
                                            strokeDasharray="5 5"
                                            label={<CustomReferenceLabel />}
                                        />

                                        <Bar dataKey="defectRate" fill="#FA4646" barSize={34}>
                                            <LabelList dataKey="defectRate" content={CustomBarLabel} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )
                        ) : (
                            <div className="flex items-center justify-center h-full w-full text-gray-400">Loading Chart...</div>
                        )
                    }
                </div >

                {/* Back Button Footer */}
                < div className="flex justify-end mt-2" >
                    <button
                        onClick={() => router.back()}
                        className="bg-[#3b82f6] hover:bg-blue-600 text-white font-bold px-12 py-3 rounded shadow-md text-lg transition-colors"
                    >
                        Back
                    </button>
                </div >

            </main >
        </div >
    );
}

export default function CtqDashboardView() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-gray-500">Loading...</div></div>}>
            <CtqDashboardInner />
        </Suspense>
    );
}
