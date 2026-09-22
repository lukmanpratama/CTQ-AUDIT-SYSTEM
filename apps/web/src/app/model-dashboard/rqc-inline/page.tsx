import { RqcInlineClient } from '../../../features/rqc-inline/components/RqcInlineClient';
import React from 'react';

export default async function RqcInlineDashboardPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    return <RqcInlineClient searchParams={params} />;
}
