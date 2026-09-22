'use client';

import React from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    LabelList,
    Cell
} from 'recharts';

export function DailyPassRateChart({ data, onDateClick, activeFilter }: { data?: any[], onDateClick?: (date: string) => void, activeFilter?: any }) {
    const chartData = data && data.length > 0 ? data : [];

    const isFaded = (entryDate: string) => {
        if (!activeFilter) return false;
        if (activeFilter.type === 'day') return entryDate !== activeFilter.label;
        if (activeFilter.type === 'week') {
            const d = new Date(entryDate).getTime();
            const s = new Date(activeFilter.start).getTime();
            const e = new Date(activeFilter.end).getTime();
            return d < s || d > e;
        }
        return false;
    };

    // Enrich chartData with avgDefectRate and override passRate per user logic
    const finalData = chartData.map((d: any) => {
        const tqcDefect = d.defectRate || 0;
        const rqcDefect = d.defectRateRqc || 0;

        const passRateTqc = 100 - tqcDefect;
        const passRateRqc = 100 - rqcDefect;

        const passRateOverride = (passRateTqc + passRateRqc) / 2;
        const avgDefectOverride = (tqcDefect + rqcDefect) / 2;

        return {
            ...d,
            passRate: Math.round((passRateOverride + Number.EPSILON) * 100) / 100,
            avgDefectRate: Math.round((avgDefectOverride + Number.EPSILON) * 100) / 100
        };
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const passRate = payload.find((p: any) => p.dataKey === 'passRate')?.value ?? 0;
            const defectRate = payload.find((p: any) => p.dataKey === 'defectRate')?.value ?? 0;
            const defectRateRqc = payload.find((p: any) => p.dataKey === 'defectRateRqc')?.value ?? 0;

            return (
                <div className="bg-white/90 backdrop-blur-sm p-3 border border-gray-200 text-xs shadow-lg rounded">
                    <p className="font-bold text-gray-700 mb-2">{label}</p>
                    <p className="text-[#2482E4] font-medium flex justify-between gap-4">
                        <span>PASS RATE</span> <span>{passRate}%</span>
                    </p>
                    <p className="text-[#D9262C] font-medium flex justify-between gap-4">
                        <span>DEFECT RATE TQC</span> <span>{defectRate}%</span>
                    </p>
                    <p className="text-[#FFB00F] font-medium flex justify-between gap-4">
                        <span>DEFECT RATE RQC</span> <span>{defectRateRqc}%</span>
                    </p>
                    <p className="text-red-400 font-medium flex justify-between gap-4">
                        <span>AVG DEFECT RATE</span> <span>{payload.find((p: any) => p.dataKey === 'avgDefectRate')?.value ?? 0}%</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomBarLabel = (props: any) => {
        const { x, y, width, value, index, color, formatter } = props;
        if (isNaN(x) || isNaN(y)) return null;
        const displayValue = formatter ? formatter(value) : value;
        if (!displayValue) return null;
        const dataItem = finalData[index];
        const faded = dataItem ? isFaded(dataItem.date) : false;
        return (
            <text x={x + width / 2} y={y - 8} fill={color} textAnchor="middle" fontSize={11} fontWeight="bold" fillOpacity={faded ? 0.2 : 1}>
                {displayValue}
            </text>
        );
    };

    const CustomLineLabel = (props: any) => {
        const { x, y, value, index, color, formatter, dy = -10, dyValue = 0 } = props;
        if (isNaN(x) || isNaN(y)) return null;
        const displayValue = formatter ? formatter(value) : value;
        if (!displayValue) return null;
        const dataItem = finalData[index];
        const faded = dataItem ? isFaded(dataItem.date) : false;
        return (
            <text x={x} y={y + dy + dyValue} fill={color} textAnchor="middle" fontSize={11} fontWeight="bold" fillOpacity={faded ? 0.2 : 1}>
                {displayValue}
            </text>
        );
    };

    return (
        <div className="bg-white h-full w-full flex flex-col p-2 overflow-hidden">
            {/* Custom Header Title */}
            <h2 className="text-center text-sm font-bold tracking-wide uppercase text-gray-800 mb-1">
                DAILY PASS RATE CTQ
            </h2>

            {/* Custom Legend */}
            <div className="flex justify-center items-center gap-6 text-[10px] sm:text-xs font-semibold text-gray-600 mb-4 uppercase mt-1">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-[#2482E4]"></div>
                    <span>PASS RATE</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-3 bg-[#D9262C]"></div>
                    <span>DEFECT RATE TQC</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-3 bg-[#FFB00F]"></div>
                    <span>DEFECT RATE RQC</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-px bg-[#D9262C]"></div>
                    <span>AVG DEFECT RATE</span>
                </div>
            </div>

            <div className="flex-1 w-full relative min-h-0">
                {/* 20% Limit Tag rendered as absolute HTML div to match design exactly */}
                <div
                    className="absolute right-[50px] bg-[#D9262C]/30 text-gray-900 border-b border-[#D9262C] font-semibold text-[10px] px-1 py-0.5 pointer-events-none"
                    style={{ top: '33%' }} // Approximating 20% on the right axis which is 0-30% max
                >
                    DAILY DEFECT LIMIT &gt;20%
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={finalData}
                        margin={{
                            top: 25,
                            right: 40,
                            left: 10,
                            bottom: 10,
                        }}
                        onClick={(e) => {
                            if (e && e.activeLabel && onDateClick) {
                                onDateClick(e.activeLabel as string);
                            }
                        }}
                        style={{ cursor: onDateClick ? 'pointer' : 'default' }}
                    >
                        {/* Horizontal lines only, very light */}
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />

                        <XAxis
                            dataKey="date"
                            axisLine={true}
                            tickLine={true}
                            tick={{ fontSize: 13, fill: '#4B5563', fontWeight: 600 }}
                            dy={10}
                        />

                        {/* Left Axis: Pass Rate (0-100) */}
                        <YAxis
                            yAxisId="left"
                            domain={[0, 100]}
                            ticks={[0, 50, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 13, fill: '#6B7280', fontWeight: 500 }}
                            tickFormatter={(val) => `${val}%`}
                            label={{ value: 'PASS RATE', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 13, fill: '#9CA3AF', fontWeight: 'bold' } }}
                        />

                        {/* Right Axis: Defect Rate (0-30) */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, 30]}
                            ticks={[0, 10, 20, 30]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 13, fill: '#6B7280', fontWeight: 500 }}
                            tickFormatter={(val) => `${val}%`}
                            label={{ value: 'DEFECT RATE | DEFECT', angle: -90, position: 'insideRight', offset: 0, style: { fontSize: 13, fill: '#9CA3AF', fontWeight: 'bold' } }}
                        />

                        {/* Dashed Reference Line across for the 20% limit */}
                        <ReferenceLine y={20} yAxisId="right" stroke="#D9262C" strokeDasharray="5 5" />

                        <Tooltip content={<CustomTooltip />} />

                        {/* Values on the chart exactly like mockup */}
                        <Bar yAxisId="right" dataKey="defectRate" fill="#D9262C" barSize={35} name="DEFECT RATE TQC">
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-tqc-${index}`} fill="#D9262C" fillOpacity={isFaded(entry.date) ? 0.2 : 1} />
                            ))}
                            <LabelList dataKey="defectRate" content={(props: any) => <CustomBarLabel {...props} color="#D9262C" formatter={(v: number) => v > 0 ? `${v}%` : ''} />} />
                        </Bar>

                        <Bar yAxisId="right" dataKey="defectRateRqc" fill="#FFB00F" barSize={35} name="DEFECT RATE RQC">
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-rqc-${index}`} fill="#FFB00F" fillOpacity={isFaded(entry.date) ? 0.2 : 1} />
                            ))}
                            <LabelList dataKey="defectRateRqc" content={(props: any) => <CustomBarLabel {...props} color="#FFB00F" formatter={(v: number) => v > 0 ? `${v}%` : ''} />} />
                        </Bar>

                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="passRate"
                            stroke="#2482E4"
                            strokeWidth={2}
                            dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const faded = isFaded(payload.date);
                                if (isNaN(cx) || isNaN(cy)) return <></>;
                                return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={4} fill="#2482E4" fillOpacity={faded ? 0.2 : 1} stroke="none" />;
                            }}
                            activeDot={{ r: 6 }}
                        >
                            <LabelList dataKey="passRate" content={(props: any) => <CustomLineLabel {...props} color="#2482E4" formatter={(val: number) => `${val}%`} dyValue={0} />} />
                        </Line>

                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="avgDefectRate"
                            stroke="#D9262C"
                            strokeWidth={1.5}
                            dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const faded = isFaded(payload.date);
                                if (isNaN(cx) || isNaN(cy)) return <></>;
                                return <circle key={`dot-avg-${payload.date}`} cx={cx} cy={cy} r={4} fill="#D9262C" fillOpacity={faded ? 0.2 : 1} stroke="none" />;
                            }}
                            activeDot={{ r: 6 }}
                        >
                            <LabelList dataKey="avgDefectRate" content={(props: any) => <CustomLineLabel {...props} color="#D9262C" formatter={(val: number) => val > 0 ? `${val}%` : ''} dyValue={-12} />} />
                        </Line>

                        {/* Custom labels removed since data is dynamic */}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
