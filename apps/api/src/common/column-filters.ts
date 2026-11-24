import { BadRequestException } from '@nestjs/common';

// Excel-style column filters of the admin tables that page on the server (Purchase Orders,
// Inspection Report). The web sends them as the `cols` query param:
// {"cell": {"values": ["F1-1", "F1-2"]}, "po": {"values": ["0903…"], "exclude": true}}
// '' in `values` stands for an empty cell.

export type ColumnFilterSel = { values: string[]; exclude: boolean };

const MAX_VALUES = 5000;

/** Parses `cols`, accepting only the `allowed` columns. */
export function parseColumnFilters<F extends string>(raw: string | undefined, allowed: readonly F[]): Partial<Record<F, ColumnFilterSel>> {
    if (!raw) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new BadRequestException('cols must be JSON.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestException('cols must be an object.');
    const out: Partial<Record<F, ColumnFilterSel>> = {};
    for (const [field, sel] of Object.entries(parsed as Record<string, any>)) {
        if (!allowed.includes(field as F)) throw new BadRequestException(`Unknown filter column "${field}".`);
        const values = sel?.values;
        if (!Array.isArray(values) || values.length > MAX_VALUES || values.some(v => typeof v !== 'string')) {
            throw new BadRequestException(`Filter "${field}" needs a list of up to ${MAX_VALUES} text values.`);
        }
        out[field as F] = { values, exclude: sel.exclude === true };
    }
    return out;
}

/**
 * Prisma condition for one column filter. `match` builds the condition for listed values,
 * `empty` the one for an empty cell (omit it when the column is never empty).
 * Without `exclude` the row's value must be listed (nothing listed: no rows).
 * With `exclude` it must not be; an empty cell stays unless '' is listed, which plain SQL
 * NOT IN would get wrong for NULL.
 */
export function columnFilterWhere(sel: ColumnFilterSel, match: (values: string[]) => object, empty?: object): object {
    const listed = [...new Set(sel.values.filter(v => v !== ''))];
    const withEmpty = !!empty && sel.values.includes('');
    if (!sel.exclude) {
        const parts: object[] = [];
        if (listed.length) parts.push(match(listed));
        if (withEmpty) parts.push(empty!);
        return { OR: parts };
    }
    const and: object[] = [];
    if (listed.length) and.push(empty ? { OR: [{ NOT: match(listed) }, empty] } : { NOT: match(listed) });
    if (withEmpty) and.push({ NOT: empty! });
    return { AND: and };
}

/**
 * Parses the `sort` query param ("column:asc" / "column:desc") of a table that sorts from its
 * column headers. Returns null when there is none; an unknown column or direction is a 400.
 */
export function parseSort<F extends string>(raw: string | undefined, allowed: readonly F[]): { field: F; dir: 'asc' | 'desc' } | null {
    if (!raw) return null;
    const [field, dir] = raw.split(':');
    if (!allowed.includes(field as F)) throw new BadRequestException(`Unknown sort column "${field}".`);
    if (dir !== 'asc' && dir !== 'desc') throw new BadRequestException('sort direction must be asc or desc.');
    return { field: field as F, dir };
}

/** Words of a search box, for "contains every word" filters */
export const searchWords = (search?: string) => (search ?? '').trim().split(/\s+/).filter(Boolean);
