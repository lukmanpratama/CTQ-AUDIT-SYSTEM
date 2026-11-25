import React from 'react';
import { ChevronDown } from 'lucide-react';
import { modelLabel } from '../../../lib/model-label';

export function DashboardHeader({ filters, filtersOptions, onFilterChange }: any) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="admin-page-title">Dashboard Monitoring</h1>
                    <p className="admin-page-subtitle">
                        Centralized quality data monitoring to assist with problem identification, performance analysis, and corrective action taking
                    </p>
                </div>
            </div>

            {/* Same toolbar as the other admin pages: one row of h-9 boxes, the five filters of equal width */}
            <div className="admin-toolbar">
                <FilterSelect
                    label="Model"
                    value={filters.modelId}
                    options={[{ value: 'All', label: 'All' }, ...(filtersOptions?.models?.map((m: any) => ({ value: m.setupModelId, label: modelLabel(m) })) || [])]}
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
        <label className="admin-inline-field relative flex-1 min-w-[8.5rem] max-w-[13rem] cursor-pointer">
            <span className="text-gray-500 flex-shrink-0">{label}:</span>
            <select
                className="appearance-none bg-transparent font-medium text-gray-900 w-full min-w-0 h-full pr-5 focus:outline-none cursor-pointer truncate"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options?.map((opt: any, idx: number) => (
                    <option key={idx} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <ChevronDown className="h-4 w-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </label>
    );
}

function DateInput({ label, placeholder, value, onChange }: any) {
    return (
        <label className="admin-inline-field cursor-pointer">
            <span className="text-gray-500 flex-shrink-0">{label}</span>
            <input
                type="date"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className="bg-transparent border-none outline-none w-32 text-gray-900 placeholder:text-gray-400 cursor-pointer"
            />
        </label>
    );
}
