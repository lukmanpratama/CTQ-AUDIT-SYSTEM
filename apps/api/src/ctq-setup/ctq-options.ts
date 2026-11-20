// Values a setup process's CTQ category and risk level can take. Keep in sync with
// apps/web/src/lib/ctq-options.ts, which offers them on the Configure page.

export const CTQ_CATEGORIES = [
    'External Compliance',
    'Safety',
    'Function',
    'Durability',
    'Appearance',
    'Color',
    'Fit & Comfort',
] as const;

export const RISK_LEVELS = ['Low', 'Medium', 'Critical'] as const;
