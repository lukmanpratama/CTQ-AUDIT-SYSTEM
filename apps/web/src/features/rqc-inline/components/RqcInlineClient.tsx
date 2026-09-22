'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { apiClient } from '../../../lib/api-client';

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
                const headers = await apiClient.get<any[]>(`/rqc/headers?modelId=${modelId}`);

                const uniqueCells = new Set<string>();
                (headers || []).forEach(h => {
                    if (h.cell) uniqueCells.add(h.cell.trim().toUpperCase());
                    // Edge case: if they left cell blank but factory is INHOUSE
                    if (!h.cell && h.factory?.factory === 'INHOUSE') {
                        // Usually handled, but strictly checking `h.cell` per requirement
                    }
                });

                const TREATMENT_KEYWORDS = ['NOSEW', 'EMBOSS', 'EMBROIDERY', 'PRINTING']; // Standard INHOUSE parts

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

    // ---- Data State ----
    const [kpiData, setKpiData] = useState<any>(null);
    const [trendsData, setTrendsData] = useState<any[]>([]);
    const [processDefectData, setProcessDefectData] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(false);

    const currentCell = activeTab === 'TREATMENT' ? activeTreatmentSubTab : activeTab;

    useEffect(() => {
        // Reset sub-filters on cell change
        setActiveDateFilter(null);
        setActiveAreaFilter(null);
    }, [currentCell]);

    useEffect(() => {
        if (!modelId || !currentCell) {
            return;
        }

        const fetchData = async () => {
            setLoadingData(true);
            try {
                // Determine dates based on filter
                let dateParam = '';
                if (activeDateFilter) {
                    // Try parsing activeDateFilter ('20 Jul 2026' -> YYYY-MM-DD for standardizing API calls)
                    const parsedDate = new Date(activeDateFilter);
                    if (!isNaN(parsedDate.getTime())) {
                        const isoDate = parsedDate.toISOString().split('T')[0];
                        dateParam = `&startDate=${isoDate}&endDate=${isoDate}`;
                    }
                }

                const [resKpis, resTrends, resProcess] = await Promise.all([
                    apiClient.get<any>(`/rqc/kpis?modelId=${modelId}&cell=${currentCell}${dateParam}`),
                    apiClient.get<any>(`/rqc/trends?modelId=${modelId}&cell=${currentCell}`),
                    apiClient.get<any>(`/rqc/process-defects?modelId=${modelId}&cell=${currentCell}${dateParam}`)
                ]);

                setKpiData(resKpis);
                setTrendsData(resTrends?.dailyTrend || []);
                setProcessDefectData(resProcess);
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [modelId, currentCell, activeDateFilter]);

    // Handle line chart click
    const handleLineChartClick = (data: any) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const clickedDate = data.activePayload[0].payload.date;
            if (activeDateFilter === clickedDate) {
                setActiveDateFilter(null); // Toggle off
            } else {
                setActiveDateFilter(clickedDate); // Filter by this date
            }
        }
    };

    // ---- Computed Data Map ----

    // Pass Rate Overall (from KPIs or just Trend pass rate?)
    // Consistency audit doughnut: overall pass rate of RQC.
    const rqcPassRate = kpiData?.rqcOverallStats?.passRate ?? 0;
    const rqcDefectRate = 100 - rqcPassRate;
    const consistencyData = [
        { value: rqcPassRate },
        { value: rqcDefectRate }
    ];

    // Trends
    const passRateData = trendsData;

    // Defect breakdown
    const allAreas = processDefectData?.areas || [];
    const availableAreas = allAreas.map((a: any) => a.areaName);

    const areas = activeAreaFilter
        ? allAreas.filter((a: any) => a.areaName === activeAreaFilter)
        : allAreas;

    let detailDefectMap = new Map<string, number>();
    let pctTreatmentData: any[] = [];
    let totRqcCheckingMorning = 0;
    let totRqcCheckingAfternoon = 0;
    let totRqcDefectMorning = 0;
    let totRqcDefectAfternoon = 0;

    areas.forEach((area: any) => {
        area.processes.forEach((proc: any) => {
            // Collect process level defect percentage (Negative val for visual like mockup)
            if (proc.defectRate > 0) {
                pctTreatmentData.push({
                    name: proc.processName,
                    val: -proc.defectRate,
                    absoluteVal: proc.defectRate
                });
            }

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

    // The big center treatment defect rate box 
    // Usually uses RQC defect rate.
    const overallDefectRate = kpiData?.rqcOverallStats?.defectRate ?? 0;


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
                    <select className="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 bg-white min-w-[150px] outline-none">
                        <option>CHECKING TIME</option>
                    </select>
                    <select className="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 bg-white min-w-[200px] outline-none">
                        <option>Pilih rentang tanggal</option>
                    </select>
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
                    <span className="text-sm font-bold text-gray-500 mr-2 uppercase tracking-wide">Select Treatment:</span>
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
                    <button
                        onClick={() => setActiveAreaFilter(null)}
                        className={`${!activeAreaFilter ? 'bg-[#FF9800] text-white border-[#FF9800]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'} border font-bold py-1.5 px-4 rounded shadow-sm text-xs transition-colors uppercase`}
                    >
                        ALL AREAS
                    </button>
                    {availableAreas.map((areaName: string) => (
                        <button
                            key={areaName}
                            onClick={() => setActiveAreaFilter(areaName)}
                            className={`${activeAreaFilter === areaName ? 'bg-[#FF9800] text-white border-[#FF9800]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'} border font-bold py-1.5 px-4 rounded shadow-sm text-xs transition-colors uppercase`}
                        >
                            {areaName}
                        </button>
                    ))}
                </div>
            )}

            {/* Consistency Audit & Line Chart Row */}
            <div className="flex gap-4 h-[250px]">
                {/* Consistency Audit Donut */}
                <div className="w-[300px] border border-gray-200 rounded shadow-sm bg-white flex flex-col p-4 shrink-0">
                    <h3 className="text-center font-bold text-gray-800 text-sm tracking-wide mb-2">CONSISTENCY AUDIT</h3>
                    <div className="flex-1 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
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
                            <span className="text-[#06C258] text-3xl font-medium tracking-tight">{rqcPassRate.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                {/* Pass Rate Line Chart */}
                <div className="flex-1 border border-gray-200 rounded shadow-sm bg-white p-4 relative pt-10">
                    <div className="absolute top-4 left-10 flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <div className="w-6 h-[2px] bg-[#2482E4]"></div>
                        PASS RATE
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={passRateData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }} onClick={handleLineChartClick}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEEEE" />
                            <XAxis
                                dataKey="date"
                                angle={-35}
                                tick={{ fontSize: 9, fill: '#666' }}
                                textAnchor="end"
                                dx={-5}
                                dy={10}
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
                                type="monotone"
                                dataKey="passRate"
                                stroke="#2482E4"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, fill: '#FF9800', stroke: '#fff', strokeWidth: 2 }}
                            >
                                <LabelList
                                    dataKey="passRate"
                                    position="top"
                                    offset={10}
                                    fontSize={9}
                                    fill="#2482E4"
                                    formatter={(v: any) => (v % 1 === 0 ? `${v}0` : `${v}`) + '%'}
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
                        <span className="text-[#06C258] font-bold text-lg uppercase tracking-wide">{currentCell} {activeAreaFilter ? ` - ${activeAreaFilter}` : ''} DEFECT RATE {activeDateFilter ? `(${activeDateFilter})` : ''}</span>
                        <span className="text-[#FF9800] font-normal text-2xl tracking-wider">{overallDefectRate.toFixed(2).replace('.', ',')}%</span>
                    </div>
                </div>
                <button className="bg-[#06C258] hover:bg-green-600 text-white font-extrabold py-3 px-8 rounded shadow text-lg uppercase tracking-wide">
                    Immediate Action
                </button>
            </div>

            {/* Bottom Row - 4 Charts */}
            <div className="flex gap-4 h-[350px]">
                {/* 1. Percentage Defect Treatment */}
                <div className="flex-[2] border border-gray-200 rounded shadow-sm bg-white p-4 flex flex-col relative h-[330px]">
                    <h3 className="text-center font-bold text-gray-800 text-sm uppercase mb-4">PERCENTAGE DEFECT TREATMENT</h3>
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
                                <XAxis type="number" domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} axisLine={true} tickLine={true} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#666', fontWeight: 600 }} axisLine={{ stroke: '#ccc' }} tickLine={false} width={140} />
                                <ReferenceLine x={5} stroke="#06C258" strokeDasharray="5 5" />
                                <ReferenceLine x={20} stroke="#00BCD4" strokeDasharray="5 5" />
                                <Bar dataKey="absoluteVal" fill="#D32F2F" barSize={20}>
                                    <LabelList dataKey="absoluteVal" position="right" formatter={(v: any) => v > 0 ? `${Number(v).toFixed(2).replace('.', ',')}%` : ''} fill="#D32F2F" fontSize={11} fontWeight="bold" />
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
                                <XAxis type="number" domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} axisLine={true} tickLine={true} tick={{ fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#666', fontWeight: 500 }} axisLine={true} tickLine={false} width={100} />
                                <Bar dataKey="value" fill="#D32F2F" barSize={20}>
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
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} axisLine={{ stroke: '#ccc' }} tickLine={false} />
                                <YAxis hide />
                                <Bar dataKey="checking" fill="#4285F4">
                                    <LabelList dataKey="checking" position="top" fill="#FFF" fontSize={10} fontWeight="bold" dy={20} formatter={(v: any) => v > 0 ? v : ''} />
                                </Bar>
                                <Bar dataKey="defect" fill="#F44336">
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
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} axisLine={{ stroke: '#ccc' }} tickLine={false} />
                                <YAxis hide />
                                <Bar dataKey="checking" fill="#4285F4">
                                    <LabelList dataKey="checking" position="top" fill="#FFF" fontSize={10} fontWeight="bold" dy={20} formatter={(v: any) => v > 0 ? v : ''} />
                                </Bar>
                                <Bar dataKey="defect" fill="#F44336">
                                    <LabelList dataKey="defect" position="top" fill="#F44336" fontSize={11} fontWeight="bold" dy={-5} formatter={(v: any) => v > 0 ? v : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}
