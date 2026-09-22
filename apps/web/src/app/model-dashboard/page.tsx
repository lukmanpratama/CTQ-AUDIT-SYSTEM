import { ModelDashboardClient } from '../../features/admin-dashboard/components/ModelDashboardClient';
import React from 'react';
export default async function ModelDashboardPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    return <ModelDashboardClient searchParams={params} />;
}
