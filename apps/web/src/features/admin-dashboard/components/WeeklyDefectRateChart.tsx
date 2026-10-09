'use client';

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    ReferenceLine,
    Tooltip,
    LabelList,
    Cell
} from 'recharts';

export function WeeklyDefectRateChart({ data, onWeekClick, onCapClick, activeFilter }: { data?: any[], onWeekClick?: (weekLabel: string) => void, onCapClick?: () => void, activeFilter?: any }) {
    const chartData = data && data.length > 0 ? data : [];

    const isFaded = (weekLabel: string) => {
        if (!activeFilter) return false;
        if (activeFilter.type === 'week') return weekLabel !== activeFilter.label;
        if (activeFilter.type === 'day') {
            const match = weekLabel.match(/^(\w+)\s+(\d{4})\s+W\s+(\d)$/i);
            if (match) {
                const [, mStr, yStr, wStr] = match;
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const monthIndex = monthNames.findIndex(m => m.toLowerCase() === mStr.toLowerCase());
                const year = parseInt(yStr, 10);
                const weekNum = parseInt(wStr, 10);
                const startDay = (weekNum - 1) * 7 + 1;
                const endDay = weekNum === 4 ? new Date(year, monthIndex + 1, 0).getDate() : Math.min(startDay + 6, new Date(year, monthIndex + 1, 0).getDate());
                const startD = new Date(year, monthIndex, startDay).getTime();
                const endD = new Date(year, monthIndex, endDay, 23, 59, 59).getTime(); // exact end of day block
                const dTime = new Date(activeFilter.start).getTime();
                return dTime < startD || dTime > endD;
            }
        }
        return false;
    };

    const hasHighDefect = chartData.some((d: any) => parseFloat(d.defectRate || 0) > 5);

    return (
        <div className="bg-white h-full w-full flex flex-col p-2 overflow-hidden relative">
            <h2 className="text-center text-sm font-bold tracking-wide uppercase text-gray-800 mb-2">
                DEFECT RATE BY WEEKLY
            </h2>

            {/* Custom Legend & CAP Button */}
            <div className="flex items-center justify-between ml-12 mb-2 pr-2 relative z-20">
                <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-semibold text-gray-600 uppercase">
                    <div className="w-3 h-2 bg-[#D9262C]"></div>
                    <span>DEFECT RATE</span>
                </div>
                {hasHighDefect && onCapClick && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onCapClick(); }}
                        className="bg-[#FFB00F] hover:bg-yellow-500 text-white text-[10px] font-bold px-3 py-1 rounded shadow cursor-pointer transition-colors"
                    >
                        CAP Defect Trend
                    </button>
                )}
            </div>

            <div className="flex-1 w-full relative min-h-0">
                {/* Weekly Defect Limit absolute tag */}
                <div
                    className="absolute right-[10px] bg-[#D9262C]/30 text-gray-900 border-b border-[#D9262C] font-semibold text-[9px] px-1 pointer-events-none z-10"
                    style={{ top: '15%' }} // matching >5% line
                >
                    WEEKLY DEFECT LIMIT &gt;5%
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{
                            top: 25,
                            right: 25,
                            left: -10, // tight spacing
                            bottom: 10,
                        }}
                        onClick={(e) => {
                            if (e && e.activeLabel && onWeekClick) {
                                onWeekClick(e.activeLabel as string);
                            }
                        }}
                        style={{ cursor: onWeekClick ? 'pointer' : 'default' }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="week"
                            axisLine={true}
                            tickLine={false}
                            tick={{ fontSize: 13, fill: '#4B5563', fontWeight: 600 }}
                        />
                        <YAxis
                            domain={[0, 6]} // Since limit is 5%, max 6% looks right based on mockup scale 0...4...
                            ticks={[0, 2, 4]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 13, fill: '#6B7280', fontWeight: 500 }}
                            tickFormatter={(val) => `${val.toFixed(2)}%`}
                        />

                        <ReferenceLine y={5} stroke="#D9262C" strokeDasharray="3 3" />

                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />

                        <Bar dataKey="defectRate" fill="#D9262C" barSize={180}>
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill="#D9262C" fillOpacity={isFaded(entry.week) ? 0.2 : 1} />
                            ))}
                            <LabelList dataKey="defectRate" position="top" formatter={(val: number) => `${val}%`} fill="#D9262C" fontSize={11} fontWeight="bold" />
                        </Bar>

                        {/* Custom labels removed since data is dynamic */}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
