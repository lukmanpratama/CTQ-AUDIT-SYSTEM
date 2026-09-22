'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';
import { ChevronDown, X } from 'lucide-react';
import { DashboardKpiSidebar } from './DashboardKpiSidebar';
import { DailyPassRateChart } from './DailyPassRateChart';
import { WeeklyDefectRateChart } from './WeeklyDefectRateChart';
import { ProcessDefectCharts } from './ProcessDefectCharts';
import { CapDefectTrendModal } from './CapDefectTrendModal';

export function ModelDashboardClient({ searchParams }: { searchParams: any }) {
    const router = useRouter();
    const modelId = searchParams?.modelId;

    const [modelName, setModelName] = useState("LOADING...");
    const [modelPicture, setModelPicture] = useState("/parkland-logo.jfif");
    const [auditFile, setAuditFile] = useState<string | null>(null);

    // Dynamic KPI Data
    const [ctqKpis, setCtqKpis] = useState<any[]>([]);
    const [totalPassRate, setTotalPassRate] = useState<number>(0);
    const [passRateRqc, setPassRateRqc] = useState<number>(0);
    const [passRateTqc, setPassRateTqc] = useState<number>(0);
    const [defectRateRqc, setDefectRateRqc] = useState<number>(0);
    const [defectRateTqc, setDefectRateTqc] = useState<number>(0);

    // Trend Data
    const [dailyTrend, setDailyTrend] = useState<any[]>([]);
    const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);

    // Date Filter State
    const [globalStartDate, setGlobalStartDate] = useState<string>('');
    const [globalEndDate, setGlobalEndDate] = useState<string>('');
    const [tempStartDate, setTempStartDate] = useState<string>('');

    // Modals
    const [isCapModalOpen, setIsCapModalOpen] = useState(false);
    const [tempEndDate, setTempEndDate] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<{ type: 'day' | 'week', label: string, start: string, end: string } | null>(null);
    const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

    // Factory/Cell Filter State
    const [isFactoryFilterOpen, setIsFactoryFilterOpen] = useState(false);
    const [availableFactoryCells, setAvailableFactoryCells] = useState<string[]>([]);
    const [globalCell, setGlobalCell] = useState<string>('');

    const applyDateFilter = () => {
        setGlobalStartDate(tempStartDate);
        setGlobalEndDate(tempEndDate);
        setActiveFilter(null); // reset cross filter when global changes
        setIsDateFilterOpen(false);
    };

    const clearDateFilter = () => {
        setGlobalStartDate('');
        setGlobalEndDate('');
        setTempStartDate('');
        setTempEndDate('');
        setActiveFilter(null);
        setIsDateFilterOpen(false);
    };

    useEffect(() => {
        if (!modelId) return;

        // Fetch Model Base Data
        const fetchModel = async () => {
            try {
                const res = await apiClient.get(`/ctq-setup/models/${modelId}/tree`) as any;
                if (res && res.model) {
                    setModelName(res.model.modelName || "UNKNOWN MODEL");
                    if (res.model.picture) {
                        setModelPicture(res.model.picture);
                    }
                    if (res.model.internalAuditFile) {
                        setAuditFile(res.model.internalAuditFile);
                    }
                }
            } catch (error) {
                console.error("Failed to load model details:", error);
                setModelName("ERROR LOADING MODEL");
            }
        };

        // Fetch Analytics KPIs for this model
        const fetchDashboardData = async () => {
            try {
                let kpiUrl = `/rqc/kpis?modelId=${modelId}`;
                let trendsUrl = `/rqc/trends?modelId=${modelId}`;

                // Trends ONLY use global dates
                if (globalStartDate) trendsUrl += `&startDate=${globalStartDate}`;
                if (globalEndDate) trendsUrl += `&endDate=${globalEndDate}`;

                // Process Charts & KPIs use activeFilter if active
                const activeStart = activeFilter ? activeFilter.start : globalStartDate;
                const activeEnd = activeFilter ? activeFilter.end : globalEndDate;

                if (activeStart) kpiUrl += `&startDate=${activeStart}`;
                if (activeEnd) kpiUrl += `&endDate=${activeEnd}`;
                if (globalCell) {
                    kpiUrl += `&cell=${encodeURIComponent(globalCell)}`;
                    trendsUrl += `&cell=${encodeURIComponent(globalCell)}`;
                }

                const headersUrl = `/rqc/headers?modelId=${modelId}`;

                const [resKpis, resTrends, headersRes] = await Promise.all([
                    apiClient.get(kpiUrl) as any,
                    apiClient.get(trendsUrl) as any,
                    apiClient.get<any[]>(headersUrl)
                ]);

                // Populate availableFactoryCells globally
                const uniqueCells = new Set<string>();
                (headersRes || []).forEach((h: any) => {
                    const c = (h.cell || '').trim();
                    if (c) uniqueCells.add(c);
                });
                setAvailableFactoryCells(Array.from(uniqueCells).sort());

                let computedTotalPassRate = 0;
                if (resKpis) {
                    setCtqKpis(resKpis.ctqKpis || []);
                    computedTotalPassRate = resKpis.avgPassRate || 0; // fallback
                }
                if (resTrends) {
                    const dTrend = resTrends.dailyTrend || [];
                    const baseWTrend = resTrends.weeklyTrend || [];
                    setDailyTrend(dTrend);

                    // Re-calculate Weekly Defect Rate from Daily Trends
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                    const computedWTrend = baseWTrend.map((w: any) => {
                        const match = typeof w.week === 'string' ? w.week.match(/^(\w+)\s+(\d{4})\s+W\s+(\d)$/i) : null;
                        if (match) {
                            const [, mStr, yStr, wStr] = match;
                            const monthIndex = monthNames.findIndex(m => m.toLowerCase() === mStr.toLowerCase());
                            const year = parseInt(yStr, 10);
                            const weekNum = parseInt(wStr, 10);
                            const startDay = (weekNum - 1) * 7 + 1;
                            const endDay = Math.min(startDay + 6, new Date(year, monthIndex + 1, 0).getDate());

                            const startD = new Date(year, monthIndex, startDay).getTime();
                            const endD = new Date(year, monthIndex, endDay, 23, 59, 59).getTime();

                            const inWeek = dTrend.filter((d: any) => {
                                const dt = new Date(d.date).getTime();
                                return dt >= startD && dt <= endD;
                            });

                            if (inWeek.length > 0) {
                                const sumAvgDefects = inWeek.reduce((sum: number, d: any) => {
                                    const tqcDefect = d.defectRate || 0;
                                    const rqcDefect = d.defectRateRqc || 0;
                                    const avgDefect = Math.round((((tqcDefect + rqcDefect) / 2) + Number.EPSILON) * 100) / 100;
                                    return sum + avgDefect;
                                }, 0);
                                const finalWeeklyDefect = Math.round(((sumAvgDefects / inWeek.length) + Number.EPSILON) * 100) / 100;
                                return { ...w, defectRate: finalWeeklyDefect };
                            }
                        }
                        return w;
                    });

                    setWeeklyTrend(computedWTrend);

                    if (dTrend.length > 0) {
                        const sumPassRates = dTrend.reduce((sum: number, d: any) => {
                            const tqcDefect = d.defectRate || 0;
                            const rqcDefect = d.defectRateRqc || 0;
                            const dailyPassRate = Math.round((((100 - tqcDefect + 100 - rqcDefect) / 2) + Number.EPSILON) * 100) / 100;
                            return sum + dailyPassRate;
                        }, 0);
                        computedTotalPassRate = sumPassRates / dTrend.length;
                    }
                }
                setTotalPassRate(computedTotalPassRate);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            }
        };

        fetchModel();
        fetchDashboardData();
    }, [modelId, globalStartDate, globalEndDate, activeFilter, globalCell]);

    // Recalculate totalPassRate, RQC/TQC pass rates & defect rates when activeFilter changes
    useEffect(() => {
        if (!dailyTrend || dailyTrend.length === 0) return;

        let filteredData = dailyTrend;
        if (activeFilter) {
            const startTime = new Date(activeFilter.start).getTime();
            const endTime = new Date(activeFilter.end + 'T23:59:59').getTime();
            filteredData = dailyTrend.filter((d: any) => {
                const dt = new Date(d.date).getTime();
                return dt >= startTime && dt <= endTime;
            });
        }

        if (filteredData.length > 0) {
            let sumDefectRqc = 0;
            let sumDefectTqc = 0;

            filteredData.forEach((d: any) => {
                sumDefectRqc += (d.defectRateRqc || 0);
                sumDefectTqc += (d.defectRate || 0);
            });

            const count = filteredData.length;
            const avgDefRqc = sumDefectRqc / count;
            const avgDefTqc = sumDefectTqc / count;
            const prRqc = 100 - avgDefRqc;
            const prTqc = 100 - avgDefTqc;
            const overall = (prRqc + prTqc) / 2;

            setTotalPassRate(Math.round((overall + Number.EPSILON) * 100) / 100);
            setPassRateRqc(Math.round((prRqc + Number.EPSILON) * 100) / 100);
            setPassRateTqc(Math.round((prTqc + Number.EPSILON) * 100) / 100);
            setDefectRateRqc(Math.round((avgDefRqc + Number.EPSILON) * 100) / 100);
            setDefectRateTqc(Math.round((avgDefTqc + Number.EPSILON) * 100) / 100);
        }
    }, [activeFilter, dailyTrend]);

    return (
        <div
            className="w-full bg-white text-gray-900 font-sans flex flex-col"
            style={{ height: '100vh', minHeight: '600px', overflow: 'auto' }}
        >
            <div className="flex-1 flex flex-col p-4 gap-3" style={{ minWidth: '1000px' }}>
                {/* ===== TOP HEADER: Title + Back ===== */}
                <div className="flex items-start justify-between shrink-0">
                    <div style={{ width: '22%', maxWidth: '300px' }}></div>
                    <div className="flex-1 text-center flex items-center justify-center">
                        <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-gray-900 leading-tight">
                            DASHBOARD CTQ AUDIT <span className="text-[#2482E4]">{modelName}</span>
                        </h1>
                    </div>
                    <div className="flex items-start justify-end" style={{ width: '22%', maxWidth: '300px' }}>
                        <button
                            onClick={() => router.push('/dashboard-view')}
                            className="bg-[#FFB00F] hover:bg-[#E59E0D] text-white font-bold py-2 px-6 rounded-md shadow-md text-sm uppercase transition-colors"
                        >
                            ← BACK
                        </button>
                    </div>
                </div>

                {/* ===== TWO COLUMN MAIN CONTENT ===== */}
                <div className="flex flex-1 gap-4 min-h-0">

                    {/* LEFT COLUMN: Photo, Badges, KPIs, Weekly Chart */}
                    <div className="flex flex-col gap-3 shrink-0 relative" style={{ width: '22%', maxWidth: '300px' }}>

                        {/* Enlarged Photo */}
                        <div className="flex flex-col items-center shrink-0">
                            <div className="w-full bg-white rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center justify-center p-3 mb-1">
                                <img
                                    src={modelPicture}
                                    alt={modelName}
                                    className="w-[90%] max-h-[140px] object-contain drop-shadow-md"
                                />
                            </div>
                        </div>

                        {/* Active Filter Clear Button (if active) */}
                        {activeFilter && (
                            <button onClick={() => setActiveFilter(null)} className="absolute top-[210px] left-0 bg-red-100 text-red-600 border border-red-200 text-xs px-2 py-1 rounded shadow hover:bg-red-200 z-50">
                                Clear Filter: {activeFilter.label} ✕
                            </button>
                        )}

                        {/* KPI Sidebar (Green Boxes & Donut) */}
                        <DashboardKpiSidebar
                            modelId={modelId}
                            ctqData={ctqKpis}
                            passRate={totalPassRate}
                            passRateRqc={passRateRqc}
                            passRateTqc={passRateTqc}
                            defectRateRqc={defectRateRqc}
                            defectRateTqc={defectRateTqc}
                        />

                        {/* Weekly Defect Chart */}
                        <div className="shrink-0 border border-gray-200 rounded-sm relative min-w-0" style={{ height: '35%' }}>
                            <WeeklyDefectRateChart
                                data={weeklyTrend}
                                activeFilter={activeFilter}
                                onCapClick={() => setIsCapModalOpen(true)}
                                onWeekClick={(weekLabel) => {
                                    if (activeFilter && activeFilter.label === weekLabel) {
                                        setActiveFilter(null);
                                        return;
                                    }
                                    const match = weekLabel.match(/^(\w+)\s+(\d{4})\s+W\s+(\d)$/i);
                                    if (match) {
                                        const [, mStr, yStr, wStr] = match;
                                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === mStr.toLowerCase());
                                        if (monthIndex >= 0) {
                                            const year = parseInt(yStr, 10);
                                            const weekNum = parseInt(wStr, 10);
                                            const startDay = (weekNum - 1) * 7 + 1;
                                            const endDay = Math.min(startDay + 6, new Date(year, monthIndex + 1, 0).getDate());
                                            const startD = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
                                            const endD = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
                                            setActiveFilter({ type: 'week', label: weekLabel, start: startD, end: endD });
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Nav bar + Daily Chart + Process Charts */}
                    <div className="flex flex-col flex-1 gap-3 min-w-0">
                        {/* NAVIGATION / FILTER BAR */}
                        <div className="flex items-stretch gap-2 shrink-0">
                            {/* Date Picker */}
                            <div className="relative flex-[2] min-w-0">
                                <button
                                    onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                                    className="w-full h-full bg-[#4DB848] hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded-md shadow-md text-sm flex items-center justify-between transition-colors"
                                >
                                    <span className="truncate flex-1 text-left">
                                        {globalStartDate || globalEndDate ? `${globalStartDate || 'Start'} - ${globalEndDate || 'End'}` : 'Pilih rentang tanggal'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 shrink-0 ml-1" />
                                </button>

                                {isDateFilterOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-md p-4 z-50 w-72">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-bold text-sm text-gray-700">Filter Tanggal</span>
                                            <button onClick={() => setIsDateFilterOpen(false)} className="text-gray-400 hover:text-gray-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                                                <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={tempStartDate || globalStartDate} onChange={(e) => setTempStartDate(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                                                <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={tempEndDate || globalEndDate} onChange={(e) => setTempEndDate(e.target.value)} />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button onClick={clearDateFilter} className="flex-1 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 py-1.5 rounded text-sm font-medium">Clear</button>
                                                <button onClick={applyDateFilter} className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-1.5 rounded text-sm font-medium">Apply</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* FACTORY/CELL FILTER */}
                            <div className="relative flex-[2] min-w-0">
                                <button
                                    onClick={() => setIsFactoryFilterOpen(!isFactoryFilterOpen)}
                                    className="h-full w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-2.5 px-4 rounded-md shadow-md text-sm flex items-center justify-between border border-gray-300 transition-colors"
                                >
                                    <span className="truncate">{globalCell || 'FACTORY/CELL'}</span>
                                    <ChevronDown className="w-4 h-4 ml-2 shrink-0 text-gray-500" />
                                </button>
                                {isFactoryFilterOpen && (
                                    <div className="absolute top-full left-0 right-auto md:right-0 md:left-auto mt-1 bg-white border border-gray-200 shadow-xl rounded-md p-2 z-50 min-w-[200px] max-h-60 overflow-y-auto">
                                        <button
                                            onClick={() => { setGlobalCell(''); setIsFactoryFilterOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${!globalCell ? 'font-bold text-blue-600' : 'text-gray-700'}`}
                                        >
                                            Semua Factory/Cell
                                        </button>
                                        {availableFactoryCells.map(cell => (
                                            <button
                                                key={cell}
                                                onClick={() => { setGlobalCell(cell); setIsFactoryFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${globalCell === cell ? 'font-bold text-blue-600' : 'text-gray-700'}`}
                                            >
                                                {cell}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* DEFECT CTQ button (orange) */}
                            {auditFile && (
                                <button
                                    onClick={() => {
                                        try {
                                            if (auditFile.startsWith('data:')) {
                                                const byteCharacters = atob(auditFile.split(',')[1]);
                                                const byteNumbers = new Array(byteCharacters.length);
                                                for (let i = 0; i < byteCharacters.length; i++) {
                                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                }
                                                const byteArray = new Uint8Array(byteNumbers);
                                                const fileType = auditFile.split(';')[0].split(':')[1] || 'application/pdf';
                                                const blob = new Blob([byteArray], { type: fileType });
                                                const blobUrl = URL.createObjectURL(blob);
                                                window.open(blobUrl, '_blank');
                                            } else {
                                                window.open(auditFile, '_blank');
                                            }
                                        } catch (e) {
                                            console.error("Failed to open file", e);
                                            alert("Gagal membuka file.");
                                        }
                                    }}
                                    className="flex-1 bg-[#FFB00F] hover:bg-orange-500 text-white font-bold py-2.5 px-5 rounded-md shadow-md text-sm whitespace-nowrap transition-colors text-center"
                                >
                                    DEFECT CTQ
                                </button>
                            )}

                            {/* CTQ button (red) */}
                            <button
                                onClick={() => router.push(modelId ? `/model-dashboard/ctq?modelId=${modelId}` : '/model-dashboard/ctq')}
                                className="flex-1 bg-[#D9262C] hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-md shadow-md text-sm whitespace-nowrap transition-colors text-center"
                            >
                                CTQ
                            </button>

                            {/* RQC INLINE button (blue) */}
                            <button
                                className="flex-1 bg-[#2482E4] hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-md shadow-md text-sm whitespace-nowrap transition-colors text-center"
                                onClick={() => router.push(modelId ? `/model-dashboard/rqc-inline?modelId=${modelId}` : '/model-dashboard/rqc-inline')}
                            >
                                RQC INLINE
                            </button>

                            {/* TQC EOL button (blue) */}
                            <button className="flex-1 bg-[#2482E4] hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-md shadow-md text-sm whitespace-nowrap transition-colors text-center">
                                TQC EOL
                            </button>
                        </div>

                        {/* Daily Pass Rate Chart */}
                        <div className="flex-1 overflow-hidden border border-gray-200 rounded-sm">
                            <DailyPassRateChart
                                data={dailyTrend}
                                activeFilter={activeFilter}
                                onDateClick={(clickedDate) => {
                                    if (activeFilter && activeFilter.label === clickedDate) {
                                        setActiveFilter(null);
                                        return;
                                    }
                                    const parsed = new Date(clickedDate);
                                    if (!isNaN(parsed.getTime())) {
                                        const y = parsed.getFullYear();
                                        const m = String(parsed.getMonth() + 1).padStart(2, '0');
                                        const d = String(parsed.getDate()).padStart(2, '0');
                                        const formatted = `${y}-${m}-${d}`;
                                        setActiveFilter({ type: 'day', label: clickedDate, start: formatted, end: formatted });
                                    }
                                }}
                            />
                        </div>

                        {/* Process Defect Charts */}
                        <div className="flex-1 overflow-hidden border border-gray-200 rounded-sm">
                            <ProcessDefectCharts
                                modelId={modelId}
                                startDate={activeFilter ? activeFilter.start : globalStartDate}
                                endDate={activeFilter ? activeFilter.end : globalEndDate}
                                cell={globalCell}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {isCapModalOpen && (
                <CapDefectTrendModal
                    isOpen={isCapModalOpen}
                    onClose={() => setIsCapModalOpen(false)}
                    modelId={modelId}
                    startDate={globalStartDate}
                    endDate={globalEndDate}
                />
            )}
        </div>
    );
}
