// CTQ category and risk level of a setup process: set per model on the Configure page.
// Keep in sync with apps/api/src/ctq-setup/ctq-options.ts, which validates them.

export const CTQ_CATEGORIES = [
    'External Compliance',
    'Safety',
    'Function',
    'Durability',
    'Appearance',
    'Color',
    'Fit & Comfort',
];

export const RISK_LEVELS = ['Low', 'Medium', 'Critical'];

/** Text, background and border classes for a risk level. Older upper-case values still match (HIGH = Critical). */
export function riskTone(level?: string | null) {
    switch ((level ?? '').trim().toUpperCase()) {
        case 'CRITICAL':
        case 'HIGH':
            return 'text-red-700 bg-red-50 border-red-200';
        case 'MEDIUM':
            return 'text-yellow-700 bg-yellow-50 border-yellow-200';
        case 'LOW':
            return 'text-green-700 bg-green-50 border-green-200';
        default:
            return '';
    }
}
