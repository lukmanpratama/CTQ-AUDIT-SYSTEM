'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { isOffline } from '../../lib/offline/connectivity';

/**
 * Inspection / Summary page of an audit for inspectors. Without a connection it is the static
 * /audit/session/local?id=... route: precached by the service worker, it opens for any audit,
 * including one started offline whose /audit/session/<id> URL was never loaded on this device.
 * `query` is like '?view=true'.
 */
export const inspectorSessionUrl = (headerId: string, query = '') =>
    isOffline()
        ? `/audit/session/local?id=${encodeURIComponent(headerId)}${query.replace(/^\?/, '&')}`
        : `/audit/session/${headerId}${query}`;

export const inspectorSummaryUrl = (headerId: string, query = '') =>
    isOffline()
        ? `/audit/session/local/summary?id=${encodeURIComponent(headerId)}${query.replace(/^\?/, '&')}`
        : `/audit/session/${headerId}/summary${query}`;

/**
 * The audit wizard (Header -> Inspection -> Summary) is used by inspectors under /audit/...
 * and by admins editing a report under /admin/inspections/[headerId]/edit/..., where it is
 * rendered inside the admin sidebar layout. Older admin links used /audit/...?source=admin;
 * those still count as admin and continue inside the admin routes.
 */
export function useAuditNav() {
    const pathname = usePathname() || '';
    // useSearchParams, not window.location: the server render must see the same value (hydration)
    const source = useSearchParams()?.get('source') ?? null;
    const isAdmin = pathname.startsWith('/admin/') || source === 'admin';

    const urls = {
        session: (headerId: string, query = '') =>
            isAdmin ? `/admin/inspections/${headerId}/edit${query}` : inspectorSessionUrl(headerId, query),
        summary: (headerId: string, query = '') =>
            isAdmin ? `/admin/inspections/${headerId}/edit/summary${query}` : inspectorSummaryUrl(headerId, query),
        headerEdit: (modelId: string | number, headerId: string) =>
            isAdmin
                ? `/admin/inspections/${headerId}/edit/header/${modelId}?headerId=${headerId}`
                : `/audit/${modelId}/header?headerId=${headerId}`,
        adminReport: '/admin/inspections',
    };

    return { isAdmin, urls };
}
