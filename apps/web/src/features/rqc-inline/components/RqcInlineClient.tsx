'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Rates: 2 decimals, above half up, exact half down (2,058 -> 2,06; 2,055 -> 2,05)
import { formatRate, roundRate } from '../../../lib/format-rate';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, LabelList, Tooltip } from 'recharts';
import { apiClient } from '../../../lib/api-client';
import { useDataRefresh } from '../../../lib/use-data-refresh';

// INHOUSE treatment cells (NOSEW 9, PRINTING 1, ...) are grouped under the TREATMENT tab
const TREATMENT_KEYWORDS = ['NOSEW', 'EMBOSS', 'EMBROIDERY', 'PRINTING'];
const treatmentKeyword = (cell: string) => TREATMENT_KEYWORDS.find(kw => (cell || '').toUpperCase().includes(kw)) || null;

// Short chart animations so switching cell/area/filters feels smooth instead of redrawing from zero
const CHART_ANIMATION_MS = 350;

// YYYY-MM-DD from the local calendar date. toISOString() uses UTC, which in WIB (UTC+7)
// turned a clicked "7 Oct 2026" into 2026-10-06 and filtered the wrong day.
const toLocalIsoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function RqcInlineClient({ searchParams }: { searchParams: any }) {
    const router = useRouter();
    const modelId = searchParams?.modelId;

    const [treatmentCells, setTreatmentCells] = useState<string[]>([]);
    const [regularCells, setRegularCells] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');
    const [activeTreatmentSubTab, setActiveTreatmentSubTab] = useState<string>('');
    const [loadingTabs, setLoadingTabs] = useState<boolean>(true);

    useEffect(() => {
        if (!modelId) {
            setLoadingTabs(false);
            return;
        }

        const fetchCells = async () => {
            setLoadingTabs(true);
            try {
                // Only the cells are used here; the full header list is heavy
                const headers = await apiClient.get<any[]>(`/rqc/header-cells?modelId=${modelId}`);

                const uniqueCells = new Set<string>();
                (headers || []).forEach(h => {
                    if (h.cell) uniqueCells.add(h.cell.trim().toUpperCase());
                    // Edge case: if they left cell blank but factory is INHOUSE
                    if (!h.cell && h.factory?.factory === 'INHOUSE') {
                        // Usually handled, but strictly checking `h.cell` per requirement
                    }
                });

                const tCells: string[] = [];
                const rCells: string[] = [];

                uniqueCells.forEach(cell => {
                    const isTreatment = TREATMENT_KEYWORDS.some(kw => cell.includes(kw));
                    if (isTreatment) {
                        tCells.push(cell);
                    } else {
                        rCells.push(cell);
                    }
                });

                tCells.sort();
                rCells.sort();

                setTreatmentCells(tCells);
                setRegularCells(rCells);

                // Set initial tabs
                if (rCells.length > 0) {
                    setActiveTab(rCells[0]);
                } else if (tCells.length > 0) {
                    setActiveTab('TREATMENT');
                    setActiveTreatmentSubTab(tCells[0]);
                }

            } catch (error) {
                console.error("Failed to fetch cells:", error);
            } finally {
                setLoadingTabs(false);
            }
        };

        fetchCells();
    }, [modelId]);

    // ---- Interactive State ----
    const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null);
    const [activeAreaFilter, setActiveAreaFilter] = useState<string | null>(null);
    // Process clicked on Percentage Defect Treatment: the other bars dim and the rest of the page follows it
    const [activeProcess, setActiveProcess] = useState<string | null>(null);

    const [globalStartDate, setGlobalStartDate] = useState<string>('');
    const [globalEndDate, setGlobalEndDate] = useState<string>('');
    const [checkingTimeFilter, setCheckingTimeFilter] = useState<string>('CHECKING TIME');

    // ---- Data State ----
    const [kpiData, setKpiData] = useState<any>(null);
    const [trendsData, setTrendsData] = useState<any[]>([]);
    const [processDefectData, setProcessDefectData] = useState<any>(null);
    // Cell the processDefectData belongs to; the previous cell's data stays visible (dimmed) while the new one loads
    const [processDefectCell, setProcessDefectCell] = useState<string>('');
    const [loadingData, setLoadingData] = useState(false);

    // ---- Immediate Action Modal State ----
    const [isImmediateActionModalOpen, setIsImmediateActionModalOpen] = useState(false);
    const [immediateActionData, setImmediateActionData] = useState<any[]>([]);
    const [immediateActionStartDate, setImmediateActionStartDate] = useState('');
    const [immediateActionEndDate, setImmediateActionEndDate] = useState('');
    const [loadingImmediateAction, setLoadingImmediateAction] = useState(false);

    const currentCell = activeTab === 'TREATMENT' ? activeTreatmentSubTab : activeTab;

    useEffect(() => {
        // Reset sub-filters on cell change
        setActiveDateFilter(null);
        setActiveAreaFilter(null);
        setActiveProcess(null);
    }, [currentCell]);

    // Areas this cell is about: treatment cells -> TREATMENT, a cell named like an area (INCOMING BOTTOM) -> that area.
    // Stray audits recorded under other areas for these cells are left out.
    const rawAreas: any[] = processDefectData?.areas || [];
    const cellUpper = (currentCell || '').toUpperCase();
    const cellTreatment = treatmentKeyword(currentCell);
    const allAreas: any[] = cellTreatment
        ? rawAreas.filter((a: any) => a.areaName === 'TREATMENT')
        : rawAreas.some((a: any) => (a.areaName || '').toUpperCase() === cellUpper)
            ? rawAreas.filter((a: any) => (a.areaName || '').toUpperCase() === cellUpper)
            : rawAreas;
    const availableAreas: string[] = allAreas.map((a: any) => a.areaName);
    // The selected area, or the first one (shown as selected) when nothing was clicked yet
    const effectiveArea: string | null = activeAreaFilter && availableAreas.includes(activeAreaFilter)
        ? activeAreaFilter
        : (availableAreas[0] ?? null);
    const dataReady = processDefectCell === currentCell;

    // A process belongs to one area, so switching area clears it
    useEffect(() => {
        setActiveProcess(null);
    }, [effectiveArea]);

    // 1. Fetch Process Defects (Independent of Area Filter so navigation persists)
    // Reload when someone adds / changes data, keeping the current view on screen
    const { refreshKey, isBackgroundRefresh } = useDataRefresh();
    useEffect(() => {
        if (!modelId || !currentCell) return;

        const background = isBackgroundRefresh();
        const fetchProcessDefects = async () => {
            if (!background) setLoadingData(true);
            try {
                let dateParam = '';
                if (activeDateFilter) {
                    const parsedDate = new Date(activeDateFilter);
                    if (!isNaN(parsedDate.getTime())) {
                        const isoDate = toLocalIsoDate(parsedDate);
                        dateParam = `&startDate=${isoDate}&endDate=${isoDate}`;
                    }
                } else {
                    if (globalStartDate) dateParam += `&startDate=${globalStartDate}`;
                    if (globalEndDate) dateParam += `&endDate=${globalEndDate}`;
                }

                let timeParam = '';
                if (checkingTimeFilter && checkingTimeFilter !== 'CHECKING TIME') {
                    timeParam = `&checkingTime=${checkingTimeFilter}`;
                }

                const resProcess = await apiClient.get<any>(`/rqc/process-defects?modelId=${modelId}&cell=${encodeURIComponent(currentCell)}${dateParam}${timeParam}`);
                setProcessDefectData(resProcess);
                setProcessDefectCell(currentCell);
            } catch (err) {
                console.error("Failed to fetch process defects:", err);
            } finally {
                setLoadingData(false);
            }
        };
        fetchProcessDefects();
    }, [modelId, currentCell, activeDateFilter, globalStartDate, globalEndDate, checkingTimeFilter, refreshKey]);

    // --- Fetch Immediate Actions ---
    useEffect(() => {
        if (!isImmediateActionModalOpen || !modelId || !currentCell) return;

        const fetchImmediateActions = async () => {
            setLoadingImmediateAction(true);
            try {
                let params = `?modelId=${modelId}&cell=${currentCell}`;
                if (effectiveArea) params += `&areaName=${encodeURIComponent(effectiveArea)}`;
                if (immediateActionStartDate) params += `&startDate=${immediateActionStartDate}`;
                if (immediateActionEndDate) params += `&endDate=${immediateActionEndDate}`;

                const res = await apiClient.get<any[]>(`/rqc/immediate-actions${params}`);
                setImmediateActionData(res || []);
            } catch (err) {
                console.error("Failed to fetch immediate actions:", err);
            } finally {
                setLoadingImmediateAction(false);
            }
        };
        fetchImmediateActions();
    }, [isImmediateActionModalOpen, modelId, currentCell, effectiveArea, immediateActionStartDate, immediateActionEndDate]);

    // 2a. Pass rate trend: global date range only. A clicked date dims the other days (like Home) instead of removing them
    useEffect(() => {
        if (!modelId || !currentCell || !dataReady) return;

        const fetchTrends = async () => {
            try {
                let dateParam = '';
                if (globalStartDate) dateParam += `&startDate=${globalStartDate}`;
                if (globalEndDate) dateParam += `&endDate=${globalEndDate}`;
                let timeParam = '';
                if (checkingTimeFilter && checkingTimeFilter !== 'CHECKING TIME') {
                    timeParam = `&checkingTime=${checkingTimeFilter}`;
                }
                const areaParam = effectiveArea ? `&areaName=${encodeURIComponent(effectiveArea)}` : '';
                const processParam = activeProcess ? `&processName=${encodeURIComponent(activeProcess)}` : '';
                const resTrends = await apiClient.get<any>(`/rqc/trends?modelId=${modelId}&cell=${encodeURIComponent(currentCell)}${dateParam}${timeParam}${areaParam}${processParam}`);
                setTrendsData(resTrends?.dailyTrend || []);
            } catch (err) {
                console.error("Failed to fetch trends:", err);
            }
        };
        fetchTrends();
    }, [modelId, currentCell, dataReady, globalStartDate, globalEndDate, checkingTimeFilter, effectiveArea, activeProcess]);

    // 2b. Fetch KPIs (follow the clicked date and the Area Filter)
    useEffect(() => {
        if (!modelId || !currentCell || !dataReady) return;

        const fetchKpis = async () => {
            try {
                let dateParam = '';
                if (activeDateFilter) {
                    const parsedDate = new Date(activeDateFilter);
                    if (!isNaN(parsedDate.getTime())) {
                        const isoDate = toLocalIsoDate(parsedDate);
                        dateParam = `&startDate=${isoDate}&endDate=${isoDate}`;
                    }
                } else {
                    if (globalStartDate) dateParam += `&startDate=${globalStartDate}`;
                    if (globalEndDate) dateParam += `&endDate=${globalEndDate}`;
                }

                let timeParam = '';
                if (checkingTimeFilter && checkingTimeFilter !== 'CHECKING TIME') {
                    timeParam = `&checkingTime=${checkingTimeFilter}`;
                }

                const areaParam = effectiveArea ? `&areaName=${encodeURIComponent(effectiveArea)}` : '';

                const resKpis = await apiClient.get<any>(`/rqc/kpis?modelId=${modelId}&cell=${encodeURIComponent(currentCell)}${dateParam}${timeParam}${areaParam}`);
                setKpiData(resKpis);
            } catch (err) {
                console.error("Failed to fetch KPIs:", err);
            }
        };
        fetchKpis();
    }, [modelId, currentCell, dataReady, activeDateFilter, globalStartDate, globalEndDate, checkingTimeFilter, effectiveArea]);

    // Handle line chart click
    // Clicking anywhere on a day's column (point, label or empty space) selects that day, like Home
    const handleLineChartClick = (data: any) => {
        const clickedDate = data?.activeLabel ?? data?.activePayload?.[0]?.payload?.date;
        if (!clickedDate) return;
        setActiveDateFilter(prev => (prev === clickedDate ? null : clickedDate)); // same day again = clear
    };

    // Days other than the clicked one are dimmed, not removed (same as the Home dashboard)
    const isFaded = (date: string) => !!activeDateFilter && date !== activeDateFilter;

    // ---- Computed Data Map ----

    // Trends: Map passRate to purely RQC raw metric integers, filtering out dates that only have TQC data (0 RQC checking)
    const passRateData = trendsData
        .filter((d: any) => d.rawRqcChecking > 0) // Only plot dates that actually have RQC audit records
        .map((d: any) => {
            let exactDailyPass = 100;
            if (d.rawRqcChecking > 0 && d.rawRqcDefect != null) {
                exactDailyPass = ((d.rawRqcChecking - d.rawRqcDefect) / d.rawRqcChecking) * 100;
            }
            return {
                ...d,
                passRate: roundRate(exactDailyPass)
            };
        });

    // Defect breakdown: only the selected area
    const areas = effectiveArea
        ? allAreas.filter((a: any) => a.areaName === effectiveArea)
        : allAreas;

    let detailDefectMap = new Map<string, number>();
    let pctTreatmentData: any[] = [];
    let totRqcCheckingMorning = 0;
    let totRqcCheckingAfternoon = 0;
    let totRqcDefectMorning = 0;
    let totRqcDefectAfternoon = 0;

    let globalAreaChecking = 0;

    // First Pass: Calculate total area checking to act as the exact mathematical denominator for Percentage Defect Treatment
    areas.forEach((area: any) => {
        area.processes.forEach((proc: any) => {
            globalAreaChecking += (proc.qtyCheckingMorning || 0) + (proc.qtyCheckingAfternoon || 0);
        });
    });

    // Processes the rest of the page counts: all of them, or only the one clicked on Percentage Defect Treatment
    const isFocused = (proc: any) => !activeProcess || proc.processName === activeProcess;
    let focusChecking = 0;
    let focusDefect = 0;
    areas.forEach((area: any) => {
        area.processes.filter(isFocused).forEach((proc: any) => {
            focusChecking += (proc.qtyCheckingMorning || 0) + (proc.qtyCheckingAfternoon || 0);
            focusDefect += (proc.qtyDefectMorning || 0) + (proc.qtyDefectAfternoon || 0);
        });
    });

    // Enforce 100% Pass Rate if 0 checks/0 defects, otherwise mathematically absolute ratio
    const manualRqcPassRate = focusChecking > 0
        ? ((focusChecking - focusDefect) / focusChecking) * 100
        : 100;

    // Consistency audit doughnut assignment
    const rqcPassRate = roundRate(manualRqcPassRate);
    // The doughnut's remainder, so both parts add up to 100
    const rqcDefectRate = roundRate(100 - rqcPassRate);
    const consistencyData = [
        { value: rqcPassRate },
        { value: rqcDefectRate > 0 ? rqcDefectRate : 0 }
    ];

    areas.forEach((area: any) => {
        area.processes.forEach((proc: any) => {
            // Collect process level defect percentage using Global Area Checking as Denominator
            const mDef = proc.qtyDefectMorning || 0;
            const aDef = proc.qtyDefectAfternoon || 0;
            const processTotalDefect = mDef + aDef;

            // Recalculate based on user requirement: 1 defect / 400 total checking = 0.25%
            let customDefectRate = 0;
            if (globalAreaChecking > 0 && processTotalDefect > 0) {
                customDefectRate = (processTotalDefect / globalAreaChecking) * 100;
            }

            if (customDefectRate > 0) {
                pctTreatmentData.push({
                    name: proc.processName,
                    val: -customDefectRate,
                    absoluteVal: customDefectRate
                });
            }

            // Every process stays on Percentage Defect Treatment (dimmed when another one is clicked);
            // the other charts only count the clicked process
            if (!isFocused(proc)) return;

            // Collect exact defect quantities
            proc.defects.forEach((d: any) => {
                const current = detailDefectMap.get(d.defectName) || 0;
                detailDefectMap.set(d.defectName, current + d.qtyDefect);
            });

            totRqcCheckingMorning += proc.qtyCheckingMorning || 0;
            totRqcCheckingAfternoon += proc.qtyCheckingAfternoon || 0;
            totRqcDefectMorning += proc.qtyDefectMorning || 0;
            totRqcDefectAfternoon += proc.qtyDefectAfternoon || 0;
        });
    });

    // Add empty cases if empty
    if (pctTreatmentData.length === 0) {
        pctTreatmentData = [{ name: 'NO DEFECT', val: 0, absoluteVal: 0 }];
    } else {
        pctTreatmentData.sort((a, b) => b.absoluteVal - a.absoluteVal);
    }

    let detailDefectData = Array.from(detailDefectMap.entries()).map(([name, value]) => ({ name, value }));
    detailDefectData.sort((a, b) => b.value - a.value);
    if (detailDefectData.length === 0) {
        detailDefectData = [{ name: 'NO DEFECT', value: 0 }];
    }

    const morningData = [{ name: 'MORNING', checking: totRqcCheckingMorning, defect: totRqcDefectMorning }];
    const afternoonData = [{ name: 'AFTERNOON', checking: totRqcCheckingAfternoon, defect: totRqcDefectAfternoon }];

    // The big center defect rate box: total Qty Defect / total Qty Check (e.g. 2 / 80 = 2,5%).
    // It used to average the per-process percentages, which gave 1,25% for that same data.
    const overallDefectRate = focusChecking > 0 ? (focusDefect / focusChecking) * 100 : 0;

    const handleProcessClick = (entry: any) => {
        const name = entry?.name ?? entry?.payload?.name;
        if (!name || name === 'NO DEFECT') return;
        setActiveProcess(prev => (prev === name ? null : name)); // same process again = clear
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const dataDate = payload[0].payload.date;
            return (
                <div className="bg-white p-3 border border-gray-200 rounded shadow-lg text-xs min-w-[150px] z-50">
                    <p className="font-bold text-gray-800 mb-2 border-b pb-2">{label || dataDate}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between items-center gap-4 py-1">
                            <span style={{ color: entry.color || entry.stroke }} className="font-semibold uppercase">{entry.name === 'passRate' ? 'Pass Rate' : entry.name}</span>
                            <span style={{ color: entry.color || entry.stroke }} className="font-bold">{entry.value}%</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };


    return (
        <div className="w-full bg-white text-gray-900 font-sans min-h-screen flex flex-col p-4 gap-4" style={{ minWidth: '1200px' }}>
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <div className="bg-[#FF9800] text-white font-bold py-2 px-8 rounded shadow text-sm cursor-default">
                        RQC INLINE
                    </div>

                    {loadingTabs ? (
                        <div className="text-gray-400 text-sm py-2 px-4 shadow rounded border flex items-center">Loading menus...</div>
                    ) : (
                        <>
                            {treatmentCells.length > 0 && (
                                <button
                                    onClick={() => {
                                        setActiveTab('TREATMENT');
                                        if (!activeTreatmentSubTab && treatmentCells.length > 0) {
                                            setActiveTreatmentSubTab(treatmentCells[0]);
                                        }
                                    }}
                                    className={`${activeTab === 'TREATMENT' ? 'bg-[#2482E4] text-white' : 'bg-[#BDBDBD] text-white'} font-bold py-2 px-6 rounded shadow text-sm transition-colors`}
                                >
                                    TREATMENT
                                </button>
                            )}

                            {regularCells.map(cell => (
                                <button
                                    key={cell}
                                    onClick={() => setActiveTab(cell)}
                                    className={`${activeTab === cell ? 'bg-[#2482E4] text-white' : 'bg-[#BDBDBD] text-white hover:bg-gray-400'} font-bold py-2 px-6 rounded shadow text-sm transition-colors`}
                                >
                                    {cell}
                                </button>
                            ))}
                        </>
                    )}
                </div>

                <div className="flex gap-4 items-center">
                    <select
                        value={checkingTimeFilter}
                        onChange={(e) => setCheckingTimeFilter(e.target.value)}
                        className="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 bg-white min-w-[150px] outline-none"
                    >
                        <option value="CHECKING TIME">CHECKING TIME (ALL)</option>
                        <option value="Morning">MORNING</option>
                        <option value="Afternoon">AFTERNOON</option>
                    </select>

                    <div className="flex items-center gap-2 border border-gray-300 rounded bg-white px-2 py-1.5 focus-within:border-blue-500 transition-colors">
                        <span className="text-xs text-gray-500 font-semibold px-2 uppercase tracking-wide">PILIH RENTANG:</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm text-gray-700 outline-none w-32 cursor-pointer font-medium"
                            value={globalStartDate}
                            onChange={(e) => setGlobalStartDate(e.target.value)}
                        />
                        <span className="text-gray-400 font-bold">~</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm text-gray-700 outline-none w-32 cursor-pointer font-medium"
                            value={globalEndDate}
                            onChange={(e) => setGlobalEndDate(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => router.push(modelId ? `/model-dashboard?modelId=${modelId}` : '/dashboard-view')}
                        className="bg-[#2482E4] hover:bg-blue-600 text-white font-bold py-2 px-8 rounded shadow text-sm"
                    >
                        HOME
                    </button>
                </div>
            </div>

            {/* Sub Navigation Bar for Treatment Cells */}
            {activeTab === 'TREATMENT' && treatmentCells.length > 0 && (
                <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 p-2 rounded-md shadow-sm">
                    <span className="text-sm font-bold text-gray-500 mr-2 uppercase tracking-wide">Select Area:</span>
                    {treatmentCells.map(cell => (
                        <button
                            key={cell}
                            onClick={() => setActiveTreatmentSubTab(cell)}
                            className={`${activeTreatmentSubTab === cell ? 'bg-[#FF9800] text-white border-[#FF9800]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'} border font-bold py-1.5 px-4 rounded shadow-sm text-xs transition-colors uppercase`}
                        >
                            {cell}
                        </button>
                    ))}
                </div>
            )}

            {/* Sub Navigation Bar for Regular Cells (Areas) */}
            {activeTab !== 'TREATMENT' && availableAreas.length > 0 && (
                <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 p-2 rounded-md shadow-sm">
                    <span className="text-sm font-bold text-gray-500 mr-2 uppercase tracking-wide">Select Area:</span>
                    {availableAreas.map((areaName: string) => {
                        const isSelected = effectiveArea === areaName;
                        return (
                            <button
                                key={areaName}
                                onClick={() => setActiveAreaFilter(areaName)}
                                className={`${isSelected ? 'bg-[#FF9800] text-white border-[#FF9800]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'} border font-bold py-1.5 px-4 rounded shadow-sm text-xs transition-colors uppercase`}
                            >
                                {areaName}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Charts stay on screen while new data loads (dimmed), so switching menus doesn't flash */}
            <div className={`flex flex-col gap-4 transition-opacity duration-300 ${loadingData || !dataReady ? 'opacity-60' : 'opacity-100'}`}>
            {/* Consistency Audit & Line Chart Row */}
            <div className="flex gap-4 h-[250px]">
                {/* Consistency Audit Donut */}
                <div className="w-[300px] border border-gray-200 rounded shadow-sm bg-white flex flex-col p-4 shrink-0">
                    <h3 className="text-center font-bold text-gray-800 text-sm tracking-wide mb-2">CONSISTENCY AUDIT</h3>
                    <div className="flex-1 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    animationDuration={CHART_ANIMATION_MS}
                                    data={consistencyData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="75%"
                                    outerRadius="95%"
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    <Cell fill="#06C258" />
                                    <Cell fill="#EEEEEE" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[#06C258] text-3xl font-medium tracking-tight">{formatRate(rqcPassRate)}</span>
                        </div>
                    </div>
                </div>

                {/* Pass Rate Line Chart */}
                <div className="flex-1 border border-gray-200 rounded shadow-sm bg-white p-4 relative pt-10">
                    <div className="absolute top-4 left-10 flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <div className="w-6 h-[2px] bg-[#2482E4]"></div>
                        PASS RATE
                    </div>
                    {activeDateFilter && (
                        <button
                            onClick={() => setActiveDateFilter(null)}
                            className="absolute top-3 right-4 z-10 bg-red-100 text-red-600 border border-red-200 text-xs px-2 py-1 rounded shadow hover:bg-red-200"
                        >
                            Clear Filter: {activeDateFilter} ✕
                        </button>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={passRateData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }} onClick={handleLineChartClick} style={{ cursor: 'pointer' }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEEEE" />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ccc', strokeWidth: 1, strokeDasharray: '5 5' }} />
                            <XAxis
                                dataKey="date"
                                tick={(props: any) => {
                                    const { x, y, payload } = props;
                                    const selected = activeDateFilter === payload.value;
                                    return (
                                        <text
                                            x={x} y={y} dx={-5} dy={10}
                                            textAnchor="end"
                                            transform={`rotate(-35, ${x}, ${y})`}
                                            fontSize={9}
                                            fill={selected ? '#FF9800' : '#666'}
                                            fillOpacity={isFaded(payload.value) ? 0.3 : 1}
                                            fontWeight={selected ? 'bold' : 'normal'}
                                        >
                                            {payload.value}
                                        </text>
                                    );
                                }}
                                axisLine={true}
                                tickLine={true}
                                interval={0}
                            />
                            <YAxis
                                domain={[0, 150]}
                                ticks={[0, 50, 100, 150]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: '#666' }}
                                tickFormatter={(val) => `${val}%`}
                                label={{ value: 'PASS RATE', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#999', fontWeight: 'bold' } }}
                            />
                            <Line
                                animationDuration={CHART_ANIMATION_MS}
                                type="monotone"
                                dataKey="passRate"
                                stroke="#2482E4"
                                strokeWidth={2}
                                strokeOpacity={activeDateFilter ? 0.35 : 1}
                                dot={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    if (isNaN(cx) || isNaN(cy)) return <g key={`dot-${payload?.date}`} />;
                                    const selected = activeDateFilter === payload.date;
                                    return (
                                        <g key={`dot-${payload.date}`} style={{ cursor: 'pointer' }}>
                                            {/* Larger invisible hit area so the point is easy to click */}
                                            <circle cx={cx} cy={cy} r={12} fill="transparent" />
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={selected ? 6 : 4}
                                                fill={selected ? '#FF9800' : '#2482E4'}
                                                fillOpacity={isFaded(payload.date) ? 0.2 : 1}
                                                stroke={selected ? '#fff' : 'none'}
                                                strokeWidth={selected ? 2 : 0}
                                            />
                                        </g>
                                    );
                                }}
                                activeDot={{ r: 6, fill: '#FF9800', stroke: '#fff', strokeWidth: 2 }}
                            >
                                <LabelList
                                    dataKey="passRate"
                                    content={(props: any) => {
                                        const { x, y, value, index } = props;
                                        if (isNaN(x) || isNaN(y) || value == null) return null;
                                        const item = passRateData[index];
                                        const selected = !!item && activeDateFilter === item.date;
                                        return (
                                            <text
                                                x={x} y={y - 10}
                                                textAnchor="middle"
                                                fontSize={9}
                                                fill="#2482E4"
                                                fillOpacity={item && isFaded(item.date) ? 0.2 : 1}
                                                fontWeight={selected ? 'bold' : 'normal'}
                                            >
                                                {formatRate(value)}
                                            </text>
                                        );
                                    }}
                                />
                            </Line>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Treatment Defect Rate Bar (Middle) */}
            <div className="flex border border-gray-200 rounded shadow-sm bg-white p-4 items-center justify-between">
                <div className="flex-1 flex justify-center">
                    <div className="bg-[#F0F2F5] px-10 py-3 rounded-md border border-gray-200 flex items-center gap-6">
                        <span className="text-[#06C258] font-bold text-lg uppercase tracking-wide">{currentCell} {effectiveArea ? ` - ${effectiveArea}` : ''}{activeProcess ? ` - ${activeProcess}` : ''} DEFECT RATE {activeDateFilter ? `(${activeDateFilter})` : ''}</span>
                        <span className="text-[#FF9800] font-normal text-2xl tracking-wider">{formatRate(overallDefectRate)}</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsImmediateActionModalOpen(true)}
                    className="bg-[#06C258] hover:bg-green-600 text-white font-extrabold py-3 px-8 rounded shadow text-lg uppercase tracking-wide"
                >
                    Immediate Action
                </button>
            </div>

            {/* Bottom Row - 4 Charts */}
            <div className="flex gap-4 h-[350px]">
                {/* 1. Percentage Defect Treatment */}
                <div className="flex-[2] border border-gray-200 rounded shadow-sm bg-white p-4 flex flex-col relative h-[330px]">
                    <h3 className="text-center font-bold text-gray-800 text-sm uppercase mb-4">PERCENTAGE DEFECT {cellTreatment || effectiveArea || 'TREATMENT'}</h3>
                    {activeProcess && (
                        <button
                            onClick={() => setActiveProcess(null)}
                            className="absolute left-3 top-3 z-20 bg-red-100 text-red-600 border border-red-200 text-[10px] px-2 py-0.5 rounded shadow hover:bg-red-200 max-w-[45%] truncate"
                            title={`Clear Filter: ${activeProcess}`}
                        >
                            Clear Filter: {activeProcess} ✕
                        </button>
                    )}
                    <div className="absolute right-[5px] top-[40px] bg-[#06C258]/20 border-b border-[#06C258] text-[#06C258] text-[9px] font-bold px-2 py-0.5 z-10 whitespace-nowrap">
                        WEEKLY DEFECT LIMIT &gt; 5%
                    </div>
                    <div className="absolute right-[5px] top-[70px] bg-[#00BCD4]/20 border-b border-[#00BCD4] text-[#00BCD4] text-[9px] font-bold px-2 py-0.5 z-10 whitespace-nowrap">
                        DAILY DEFECT LIMIT &gt; 20%
                    </div>
                    <div className="flex-1 w-full relative -left-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pctTreatmentData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }} formatter={(v: any) => [formatRate(v), 'Defect Rate']} />
                                <XAxis type="number" domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} axisLine={true} tickLine={true} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#666', fontWeight: 600 }} axisLine={{ stroke: '#ccc' }} tickLine={false} width={140} />
                                <ReferenceLine x={5} stroke="#06C258" strokeDasharray="5 5" />
                                <ReferenceLine x={20} stroke="#00BCD4" strokeDasharray="5 5" />
                                <Bar animationDuration={CHART_ANIMATION_MS} dataKey="absoluteVal" fill="#D32F2F" barSize={20} onClick={handleProcessClick} style={{ cursor: 'pointer' }}>
                                    {pctTreatmentData.map((entry: any) => (
                                        <Cell
                                            key={`pct-${entry.name}`}
                                            fill="#D32F2F"
                                            fillOpacity={activeProcess && entry.name !== activeProcess ? 0.2 : 1}
                                        />
                                    ))}
                                    <LabelList
                                        dataKey="absoluteVal"
                                        content={(props: any) => {
                                            const { x, y, width, height, value, index } = props;
                                            if (!(value > 0) || isNaN(x) || isNaN(y)) return null;
                                            const entry = pctTreatmentData[index];
                                            const faded = !!activeProcess && entry?.name !== activeProcess;
                                            return (
                                                <text x={x + width + 5} y={y + height / 2} dy={4} fill="#D32F2F" fillOpacity={faded ? 0.2 : 1} fontSize={11} fontWeight="bold">
                                                    {formatRate(value)}
                                                </text>
                                            );
                                        }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Detail Defect */}
                <div className="flex-[1.5] border border-gray-200 rounded shadow-sm bg-white p-4 flex flex-col h-[330px]">
                    <h3 className="text-center font-bold text-gray-800 text-sm uppercase mb-2">DETAIL DEFECT</h3>
                    <div className="flex-1 w-full relative -left-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={detailDefectData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                <XAxis type="number" domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} axisLine={true} tickLine={true} tick={{ fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#666', fontWeight: 500 }} axisLine={true} tickLine={false} width={100} />
                                <Bar animationDuration={CHART_ANIMATION_MS} dataKey="value" fill="#D32F2F" barSize={20}>
                                    <LabelList dataKey="value" position="right" fill="#666" fontSize={10} fontWeight="bold" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. QTY Checking Morning */}
                <div className="flex-[1] border border-gray-200 rounded shadow-sm bg-white p-4 flex flex-col items-center h-[330px]">
                    <h3 className="text-center font-bold text-gray-800 text-[11px] uppercase tracking-tighter mb-4 h-6">QTY CHECKING MORNING</h3>
                    <div className="flex-1 w-full max-w-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={morningData} margin={{ left: -30, right: 0, bottom: 0, top: 20 }} barGap={0} barSize={40}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} axisLine={{ stroke: '#ccc' }} tickLine={false} />
                                <YAxis hide />
                                <Bar animationDuration={CHART_ANIMATION_MS} dataKey="checking" fill="#4285F4">
                                    <LabelList dataKey="checking" position="top" fill="#FFF" fontSize={10} fontWeight="bold" dy={20} formatter={(v: any) => v > 0 ? v : ''} />
                                </Bar>
                                <Bar animationDuration={CHART_ANIMATION_MS} dataKey="defect" fill="#F44336">
                                    <LabelList dataKey="defect" position="top" fill="#F44336" fontSize={11} fontWeight="bold" dy={-5} formatter={(v: any) => v > 0 ? v : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. QTY Checking Afternoon */}
                <div className="flex-[1] border border-gray-200 rounded shadow-sm bg-white p-4 flex flex-col items-center h-[330px]">
                    <h3 className="text-center font-bold text-gray-800 text-[11px] uppercase tracking-tighter mb-4 h-6">QTY CHECKING AFTERNOON</h3>
                    <div className="flex-1 w-full max-w-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={afternoonData} margin={{ left: -30, right: 0, bottom: 0, top: 20 }} barGap={0} barSize={40}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} axisLine={{ stroke: '#ccc' }} tickLine={false} />
                                <YAxis hide />
                                <Bar animationDuration={CHART_ANIMATION_MS} dataKey="checking" fill="#4285F4">
                                    <LabelList dataKey="checking" position="top" fill="#FFF" fontSize={10} fontWeight="bold" dy={20} formatter={(v: any) => v > 0 ? v : ''} />
                                </Bar>
                                <Bar animationDuration={CHART_ANIMATION_MS} dataKey="defect" fill="#F44336">
                                    <LabelList dataKey="defect" position="top" fill="#F44336" fontSize={11} fontWeight="bold" dy={-5} formatter={(v: any) => v > 0 ? v : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            </div>

            {/* Immediate Action Modal */}
            {isImmediateActionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden max-w-7xl relative">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#06C258] to-green-500 px-6 py-4 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black tracking-widest uppercase">IMMEDIATE ACTION</h2>
                                <p className="text-sm text-green-100 font-medium">CELL: {currentCell} | AREA: {effectiveArea || 'ALL'}</p>
                            </div>
                            <button onClick={() => setIsImmediateActionModalOpen(false)} className="bg-black/20 hover:bg-black/30 p-2 rounded-full transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Toolbar (Date Filter) */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4 items-center shrink-0">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Rentang Tanggal:</span>
                            <input type="date" className="border border-gray-300 rounded px-2 py-1 text-sm font-medium" value={immediateActionStartDate} onChange={e => setImmediateActionStartDate(e.target.value)} />
                            <span className="text-gray-400 font-bold">~</span>
                            <input type="date" className="border border-gray-300 rounded px-2 py-1 text-sm font-medium" value={immediateActionEndDate} onChange={e => setImmediateActionEndDate(e.target.value)} />

                            {(immediateActionStartDate || immediateActionEndDate) && (
                                <button onClick={() => { setImmediateActionStartDate(''); setImmediateActionEndDate(''); }} className="ml-2 text-xs text-red-500 hover:text-red-700 font-bold uppercase underline">Reset Filter</button>
                            )}
                        </div>

                        {/* Modal Table Content */}
                        <div className="flex-1 overflow-auto bg-gray-100 p-4">
                            {loadingImmediateAction ? (
                                <div className="h-full flex items-center justify-center font-bold text-gray-400">LOADING DATA...</div>
                            ) : immediateActionData.length === 0 ? (
                                <div className="h-full flex items-center justify-center font-bold text-gray-400">TIDAK ADA DATA IMMEDIATE ACTION DITEMUKAN</div>
                            ) : (
                                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#1F2937] text-white text-[10px] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">NO.</th>
                                                <th className="px-4 py-3 whitespace-nowrap">TANGGAL</th>
                                                <th className="px-4 py-3 whitespace-nowrap hidden md:table-cell">CHECKING TIME</th>
                                                <th className="px-4 py-3 whitespace-nowrap w-[20%]">DEFECT NAME</th>
                                                <th className="px-4 py-3 text-center whitespace-nowrap">PHOTO DEFECT</th>
                                                <th className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">PROCESS</th>
                                                <th className="px-4 py-3 text-right">QTY CHECKING</th>
                                                <th className="px-4 py-3 text-right">QTY DEFECT</th>
                                                <th className="px-4 py-3 w-[25%] hidden sm:table-cell">ACTION PLAN</th>
                                                <th className="px-4 py-3 text-center whitespace-nowrap hidden md:table-cell">PHOTO ACTION PLAN</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {immediateActionData.map((row, idx) => (
                                                <tr key={row.id} className="hover:bg-green-50 transition-colors">
                                                    <td className="px-4 py-3 font-semibold text-gray-500 hidden lg:table-cell">{idx + 1}</td>
                                                    <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">{new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{row.checkingTime}</td>
                                                    <td className="px-4 py-3 font-bold text-red-600 break-words">{row.defectName}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {row.photoDefect ? (
                                                            <a href={row.photoDefect.startsWith('http') ? row.photoDefect : `/api/files/${row.photoDefect}`} target="_blank" rel="noreferrer" className="inline-block relative group">
                                                                <img src={row.photoDefect.startsWith('http') ? row.photoDefect : `/api/files/${row.photoDefect}`} alt="Defect" className="w-16 h-16 object-cover rounded shadow-sm border border-gray-300 group-hover:brightness-90 transition-all" />
                                                            </a>
                                                        ) : <span className="text-gray-300 text-xs">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-700 text-xs hidden lg:table-cell">{row.processName}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-blue-600">{row.qtyChecking}</td>
                                                    <td className="px-4 py-3 text-right font-black text-red-600">{row.qtyDefect}</td>
                                                    <td className="px-4 py-3 text-gray-700 text-xs hidden sm:table-cell break-words">{row.actionPlan}</td>
                                                    <td className="px-4 py-3 text-center hidden md:table-cell">
                                                        {row.photoAfterActionPlan ? (
                                                            <a href={row.photoAfterActionPlan.startsWith('http') ? row.photoAfterActionPlan : `/api/files/${row.photoAfterActionPlan}`} target="_blank" rel="noreferrer" className="inline-block relative group">
                                                                <img src={row.photoAfterActionPlan.startsWith('http') ? row.photoAfterActionPlan : `/api/files/${row.photoAfterActionPlan}`} alt="Action Plan" className="w-16 h-16 object-cover rounded shadow-sm border border-gray-300 group-hover:brightness-90 transition-all" />
                                                            </a>
                                                        ) : <span className="text-gray-300 text-xs">-</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
