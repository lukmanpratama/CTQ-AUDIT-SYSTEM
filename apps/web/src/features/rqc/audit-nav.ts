'use client';

import { usePathname } from 'next/navigation';

/**
 * The audit wizard (Header -> Inspection -> Summary) is used by inspectors under /audit/...
 * and by admins editing a report under /admin/inspections/[headerId]/edit/..., where it is
 * rendered inside the admin sidebar layout. Older admin links used /audit/...?source=admin;
 * those still count as admin and continue inside the admin routes.
 */
export function useAuditNav() {
    const pathname = usePathname() || '';
    const source = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('source') : null;
    const isAdmin = pathname.startsWith('/admin/') || source === 'admin';

    const urls = {
        session: (headerId: string, query = '') =>
            isAdmin ? `/admin/inspections/${headerId}/edit${query}` : `/audit/session/${headerId}${query}`,
        summary: (headerId: string, query = '') =>
            isAdmin ? `/admin/inspections/${headerId}/edit/summary${query}` : `/audit/session/${headerId}/summary${query}`,
        headerEdit: (modelId: string | number, headerId: string) =>
            isAdmin
                ? `/admin/inspections/${headerId}/edit/header/${modelId}?headerId=${headerId}`
                : `/audit/${modelId}/header?headerId=${headerId}`,
        adminReport: '/admin/inspections',
    };

    return { isAdmin, urls };
}
