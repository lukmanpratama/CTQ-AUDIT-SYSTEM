import React from 'react';
import { TqcEolClient } from '../../../features/tqc-eol/components/TqcEolClient';

export default async function TqcEolPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;

    if (!params.modelId) {
        return <div className="p-10 text-center font-bold text-red-500">Access Denied: Model ID Required</div>;
    }

    return <TqcEolClient searchParams={params} />;
}
