'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, LabelList, Tooltip } from 'recharts';

export function TqcEolClient({ searchParams }: { searchParams: any }) {
    const router = useRouter();
    const modelId = searchParams?.modelId;

    const [activeTab, setActiveTab] = useState<string>('');
    const [tabs, setTabs] = useState<string[]>([]);
    const [loadingTabs, setLoadingTabs] = useState<boolean>(true);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [tqcData, setTqcData] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        if (!modelId) return;

        const fetchTabs = async () => {
            setLoadingTabs(true);
            try {
                // Fetch minimum data to get available tabs irrespective of current cell
                const res = await apiClient.get<any>(`/rqc/tqc-eol-summary?modelId=${modelId}`);
                if (res && res.tabs) {
                    setTabs(res.tabs);
                    if (res.tabs.length > 0) {
                        setActiveTab(res.tabs[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch tabs:", error);
            } finally {
                setLoadingTabs(false);
            }
        };

        fetchTabs();
    }, [modelId]);

    useEffect(() => {
        if (!modelId || !activeTab) return;

        const fetchData = async () => {
            setLoadingData(true);
            try {
                let url = `/rqc/tqc-eol-summary?modelId=${modelId}&cell=${activeTab}`;
                if (startDate) url += `&startDate=${startDate}`;
                if (endDate) url += `&endDate=${endDate}`;

                const res = await apiClient.get<any>(url);
                setTqcData(res);
            } catch (error) {
                console.error("Failed to fetch TQC data:", error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [modelId, activeTab, startDate, endDate]);

    if (!modelId) {
        return <div className="p-10 text-center font-bold text-red-500">Access Denied: Model ID Required</div>;
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border text-gray-800 p-2 shadow-lg rounded text-xs">
                    <p className="font-bold mb-1 border-b pb-1 text-center">{label}</p>
                    <p className="text-[#2482E4] font-semibold flex justify-between gap-4">
                        <span>PASS RATE</span> <span>{payload[0].value.toFixed(2).replace('.', ',')}%</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-[#F0F2F5] p-2 flex flex-col gap-2 relative">

            {/* Overlay Loading Status */}
            {(loadingTabs || loadingData) && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white px-6 py-3 rounded-full shadow-lg border border-gray-100 font-bold text-[#E53935] flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-[#E53935] border-t-transparent rounded-full animate-spin"></div>
                        LOADING DATA...
                    </div>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="flex bg-white shadow-sm border border-gray-200 rounded p-2 justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-[#E53935] text-white px-8 py-2.5 rounded font-extrabold text-sm uppercase tracking-wide">
                        TQC END OF LINE
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 border border-gray-300 rounded bg-white px-3 py-1.5 focus-within:border-red-500 transition-colors">
                        <span className="text-xs text-gray-500 font-semibold px-2 uppercase tracking-wide">PILIH RENTANG:</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm text-gray-700 outline-none w-32 cursor-pointer font-medium"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-gray-400 font-bold">~</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm text-gray-700 outline-none w-32 cursor-pointer font-medium"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => router.push(`/model-dashboard?modelId=${modelId}`)}
                        className="bg-[#2482E4] hover:bg-blue-600 text-white font-bold py-2 px-8 rounded shadow text-sm transition-colors"
                    >
                        HOME
                    </button>
                </div>
            </div>

            {/* Cell Tabs */}
            {tabs.length > 0 && (
                <div className="flex gap-1.5 items-center bg-gray-50 border border-gray-200 p-2 rounded-md shadow-sm">
                    {tabs.map(cell => (
                        <button
                            key={cell}
                            onClick={() => setActiveTab(cell)}
                            className={`${activeTab === cell ? 'bg-[#2482E4] text-white border-[#2482E4]' : 'bg-[#D1D5DB] text-gray-700 border-gray-300 hover:bg-gray-300'} border font-bold py-2 px-8 rounded text-sm transition-colors uppercase`}
                        >
                            {cell}
                        </button>
                    ))}
                </div>
            )}

            {/* Pass Rate Row (Donut & Line Chart) */}
            <div className="flex gap-4 h-[250px]">
                {/* Donut Chart */}
                <div className="w-[300px] border border-gray-200 rounded shadow-sm bg-white flex flex-col p-4 shrink-0">
                    <h3 className="text-center font-bold text-gray-800 text-sm tracking-wide mb-2 uppercase">PASS RATE</h3>
                    <div className="flex-1 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Pass', value: tqcData?.averagePassRate || 100 },
                                        { name: 'Fail', value: 100 - (tqcData?.averagePassRate || 100) }
                                    ]}
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
                            <span className="text-[#06C258] text-3xl font-medium tracking-tight">
                                {(tqcData?.averagePassRate || 100).toFixed(2).replace('.', ',')}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Line Chart */}
                <div className="flex-1 border border-gray-200 rounded shadow-sm bg-white p-4 relative pt-10">
                    <div className="absolute top-4 left-10 flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <div className="w-6 h-[2px] bg-[#2482E4]"></div>
                        PASS RATE
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={tqcData?.passRateData || []} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEEEE" />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ccc', strokeWidth: 1, strokeDasharray: '5 5' }} />
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
                            >
                                <LabelList
                                    dataKey="passRate"
                                    position="top"
                                    offset={10}
                                    fontSize={9}
                                    fill="#2482E4"
                                    formatter={(v: any) => `${Number(v).toFixed(2).replace('.', ',')}%`}
                                />
                            </Line>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Defect Rate Bar (Middle) */}
            <div className="flex border border-gray-200 rounded shadow-sm bg-white p-4 items-center justify-center h-[70px]">
                <div className="text-[#4CAF50] font-bold text-xl uppercase tracking-wide mr-4">
                    TQC DEFECT RATE CTQ
                </div>
                <div className="text-[#E53935] font-normal text-3xl tracking-wider">
                    {(tqcData?.averageDefectRate || 0).toFixed(2).replace('.', ',')}%
                </div>
            </div>

            {/* Bottom Row */}
            <div className="flex gap-4 h-[350px]">
                {/* Defect CTQ Chart */}
                <div className="flex-[3] border border-gray-200 rounded shadow-sm bg-white p-4 flex flex-col relative">
                    <h3 className="text-center font-bold text-gray-800 text-sm uppercase tracking-wide mb-4">DEFECT CTQ</h3>

                    <div className="absolute left-[30px] top-[70px] bg-[#00BCD4]/70 text-white text-[10px] font-bold px-2 py-0.5 z-10 whitespace-nowrap rounded-sm">
                        DEFECT LIMIT &gt; 20%
                    </div>

                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tqcData?.topDefects || []} margin={{ left: 10, right: 10, top: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <Tooltip cursor={{ fill: '#f5f5f5' }} contentStyle={{ fontSize: '11px', borderRadius: '4px' }} formatter={(val: any) => [`${val}%`, 'Defect Rate']} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }} axisLine={{ stroke: '#ccc' }} tickLine={false} />
                                <YAxis type="number" domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} axisLine={true} tickLine={false} />
                                <ReferenceLine y={20} stroke="#00BCD4" strokeDasharray="5 5" strokeWidth={2} />
                                <Bar dataKey="absoluteVal" fill="#D32F2F" barSize={120}>
                                    <LabelList dataKey="absoluteVal" position="top" formatter={(v: any) => `${Number(v).toFixed(2).replace('.', ',')}%`} fill="#D32F2F" fontSize={12} fontWeight="bold" dy={-10} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Qty Checking & Defect Totals */}
                <div className="flex-[1] flex flex-col gap-4">
                    <div className="flex-1 border border-gray-200 rounded shadow-sm bg-white p-6 flex flex-col">
                        <h3 className="text-[#2482E4] text-lg font-bold uppercase tracking-tight">QTY CHECK</h3>
                        <div className="flex-1 flex items-center justify-start">
                            <span className="text-[#2482E4] text-5xl font-light">{(tqcData?.qtyChecking || 0).toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                    <div className="flex-1 border border-gray-200 rounded shadow-sm bg-white p-6 flex flex-col">
                        <h3 className="text-[#E53935] text-lg font-bold uppercase tracking-tight">DEFECT</h3>
                        <div className="flex-1 flex items-center justify-start">
                            <span className="text-[#E53935] text-5xl font-light">{(tqcData?.qtyDefect || 0).toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
