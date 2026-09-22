import React from 'react';

export function KPICards({ data }: any) {
    const kpis = [
        { label: 'TOTAL INSPECTION', value: data?.totalInspection || 0 },
        { label: 'TOTAL QTY CHECKING', value: data?.totalQtyChecking || 0 },
        { label: 'QTY DEFECT', value: data?.totalQtyDefect || 0 },
        { label: 'PASS RATE', value: `${Number(data?.avgPassRate || 0).toFixed(2)}%` },
        { label: 'DEFECT RATE', value: `${Number(data?.avgDefectRate || 0).toFixed(2)}%` },
        { label: 'TOTAL FINISHED PROCESS', value: data?.totalFindingsProcess || 0, highlight: true },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-2">
            {kpis.map((kpi, idx) => (
                <div
                    key={idx}
                    className={`bg-white rounded-lg p-5 shadow-sm border ${kpi.highlight ? 'border-l-4 border-l-red-500 border-gray-100' : 'border-gray-100'}`}
                >
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        {kpi.label}
                    </div>
                    <div className="text-3xl font-semibold text-gray-900">
                        {kpi.value}
                    </div>
                </div>
            ))}
        </div>
    );
}
