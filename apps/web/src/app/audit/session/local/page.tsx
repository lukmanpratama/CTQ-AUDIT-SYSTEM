'use client';

// Offline route of the Inspection page: /audit/session/local?id=<headerId>. Static, so the service
// worker precaches it and it opens without a connection for any audit (also one started offline,
// whose /audit/session/<id> URL was never loaded). Same page as /audit/session/[headerId].

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import AuditSessionPage from '../[headerId]/page';

function LocalAuditSession() {
    const headerId = useSearchParams().get('id') || '';
    // One stable promise per id: the page reads params with use()
    const params = useMemo(() => Promise.resolve({ headerId }), [headerId]);
    return <AuditSessionPage key={headerId} params={params} />;
}

export default function LocalAuditSessionPage() {
    return (
        <Suspense fallback={null}>
            <LocalAuditSession />
        </Suspense>
    );
}
