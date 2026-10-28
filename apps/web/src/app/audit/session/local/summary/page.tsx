'use client';

// Offline route of the Summary page: /audit/session/local/summary?id=<headerId>
// (see ../page.tsx). Same page as /audit/session/[headerId]/summary.

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import AuditSummaryPage from '../../[headerId]/summary/page';

function LocalAuditSummary() {
    const headerId = useSearchParams().get('id') || '';
    // One stable promise per id: the page reads params with use()
    const params = useMemo(() => Promise.resolve({ headerId }), [headerId]);
    return <AuditSummaryPage key={headerId} params={params} />;
}

export default function LocalAuditSummaryPage() {
    return (
        <Suspense fallback={null}>
            <LocalAuditSummary />
        </Suspense>
    );
}
