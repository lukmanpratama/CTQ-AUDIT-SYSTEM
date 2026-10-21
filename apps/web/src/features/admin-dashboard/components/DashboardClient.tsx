'use client';

import React, { useState, useEffect } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { KPICards } from './KPICards';
import { RecentInspectionsTable } from './RecentInspectionsTable';
import { ActionRequiredWidget } from './ActionRequiredWidget';
import { apiClient } from '../../../lib/api-client';

export function DashboardClient() {
    const [filtersOptions, setFiltersOptions] = useState<any>({});
    const [filters, setFilters] = useState({
        modelId: 'All',
        areaId: 'All',
        checkingTime: 'All',
        factoryId: 'All',
        cell: 'All',
        startDate: '',
        endDate: ''
    });

    const [kpiData, setKpiData] = useState<any>(null);
    const [recentInspections, setRecentInspections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch filter options once
    useEffect(() => {
        apiClient.get('/rqc/filters')
            .then(res => setFiltersOptions(res))
            .catch(console.error);
    }, []);

    // Fetch data whenever filters change
    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const queryParams = new URLSearchParams();
                if (filters.modelId !== 'All') queryParams.append('modelId', filters.modelId);
                if (filters.areaId !== 'All') queryParams.append('areaId', filters.areaId);
                if (filters.checkingTime !== 'All') queryParams.append('checkingTime', filters.checkingTime);
                if (filters.factoryId !== 'All') queryParams.append('factoryId', filters.factoryId);
                if (filters.cell !== 'All') queryParams.append('cell', filters.cell);
                if (filters.startDate) queryParams.append('startDate', filters.startDate);
                if (filters.endDate) queryParams.append('endDate', filters.endDate);

                const [kpis, inspections] = await Promise.all([
                    apiClient.get(`/rqc/kpis?${queryParams.toString()}`),
                    apiClient.get(`/rqc/recent-inspections?${queryParams.toString()}`)
                ]);

                setKpiData(kpis);
                setRecentInspections(inspections as any[]);
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, [filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="flex-1 bg-[#F9FAFB] min-h-screen">
            <div className="w-full h-full">
                {/* Title + filters stay at the top while the dashboard scrolls */}
                <div className="admin-sticky-head mb-4">
                    <DashboardHeader
                        filters={filters}
                        filtersOptions={filtersOptions}
                        onFilterChange={handleFilterChange}
                    />
                </div>

                {loading ? (
                    <div className="py-20 text-center text-gray-500">Loading dashboard data...</div>
                ) : (
                    <>
                        <KPICards data={kpiData} />
                        <div className="flex flex-col gap-2">
                            <ActionRequiredWidget data={kpiData} />
                            <RecentInspectionsTable data={recentInspections} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
