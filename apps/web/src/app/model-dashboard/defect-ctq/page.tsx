import React from 'react';
import { DefectCtqClient } from '../../../features/defect-ctq/components/DefectCtqClient';

export default async function DefectCtqPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    return <DefectCtqClient searchParams={params} />;
}
