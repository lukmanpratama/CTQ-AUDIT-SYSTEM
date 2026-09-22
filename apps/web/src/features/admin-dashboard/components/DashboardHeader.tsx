import React from 'react';
import { ChevronDown, Calendar, FileDown } from 'lucide-react';

export function DashboardHeader({ filters, filtersOptions, onFilterChange }: any) {
    return (
        <div className="flex flex-col gap-6 mb-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard Monitoring</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Centralized quality data monitoring to assist with problem identification, performance analysis, and corrective action taking
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 flex flex-wrap items-center gap-6 rounded-lg shadow-sm border border-gray-100">
                <FilterSelect
                    label="Model"
                    value={filters.modelId}
                    options={[{ value: 'All', label: 'All' }, ...(filtersOptions?.models?.map((m: any) => ({ value: m.setupModelId, label: m.modelName })) || [])]}
                    onChange={(v: any) => onFilterChange('modelId', v)}
                />
                <FilterSelect
                    label="Area"
                    value={filters.areaId}
                    options={[
                        { value: 'All', label: 'All' },
                        ...(filtersOptions?.areas?.map((a: any) => ({ value: a.areaId, label: a.area })) || []),
                        { value: 'NOSEW', label: 'NOSEW' },
                        { value: 'PRINTING', label: 'PRINTING' },
                        { value: 'EMBOSS', label: 'EMBOSS' },
                        { value: 'EMBROIDERY', label: 'EMBROIDERY' }
                    ]}
                    onChange={(v: any) => onFilterChange('areaId', v)}
                />
                <FilterSelect
                    label="Time"
                    value={filters.checkingTime}
                    options={[{ value: 'All', label: 'All' }, ...(filtersOptions?.checkingTimes?.map((t: string) => ({ value: t, label: t })) || [])]}
                    onChange={(v: any) => onFilterChange('checkingTime', v)}
                />
                <FilterSelect
                    label="Factory"
                    value={filters.factoryId}
                    options={[{ value: 'All', label: 'All' }, ...(filtersOptions?.factories?.map((f: any) => ({ value: f.factoryId, label: f.factory })) || [])]}
                    onChange={(v: any) => onFilterChange('factoryId', v)}
                />
                <FilterSelect
                    label="Cell"
                    value={filters.cell}
                    options={[{ value: 'All', label: 'All' }, ...(filtersOptions?.cells?.map((c: string) => ({ value: c, label: c })) || [])]}
                    onChange={(v: any) => onFilterChange('cell', v)}
                />

                <div className="flex items-center gap-2 ml-auto">
                    <DateInput
                        label="Start"
                        placeholder="yyyy-mm-dd"
                        value={filters.startDate}
                        onChange={(e: any) => onFilterChange('startDate', e.target.value)}
                    />
                    <span className="text-gray-400">-</span>
                    <DateInput
                        label="End"
                        placeholder="yyyy-mm-dd"
                        value={filters.endDate}
                        onChange={(e: any) => onFilterChange('endDate', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}

function FilterSelect({ label, value, options, onChange }: any) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">{label}:</span>
            <div className="relative">
                <select
                    className="appearance-none bg-transparent font-medium text-gray-900 hover:text-gray-600 px-2.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors pr-6 focus:outline-none cursor-pointer"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {options?.map((opt: any, idx: number) => (
                        <option key={idx} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <ChevronDown className="h-4 w-4 text-gray-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
        </div>
    );
}

function DateInput({ label, placeholder, value, onChange }: any) {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-gray-400 mb-1">{label}</span>
            <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-md px-3 py-1.5 text-sm">
                <input
                    type="date"
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    className="bg-transparent border-none outline-none w-32 text-gray-700 placeholder:text-gray-400"
                />
            </div>
        </div>
    );
}
