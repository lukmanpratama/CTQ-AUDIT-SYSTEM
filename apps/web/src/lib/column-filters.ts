import { useMemo, useRef, useState } from 'react';

// Excel-style column filters of the admin tables (see components/admin/ColumnFilter.tsx)

/**
 * A column's filter: the rows whose value is in `values`, or with `exclude`, the rows whose value
 * is not. Exclude keeps "everything except these" exact when the server lists only part of the values.
 * '' stands for an empty cell.
 */
export type ColumnFilterSel = { values: string[]; exclude?: boolean };
export type ColumnFilters = Record<string, ColumnFilterSel>;

/** Sorting from a column header: A → Z (asc) or Z → A (desc) */
export type SortDir = 'asc' | 'desc';
export type ColumnSort = { key: string; dir: SortDir } | null;
/** What the column holds, for the wording of its sort buttons */
export type SortKind = 'text' | 'number' | 'date';

/** The `sort` query param of the server-side tables ("po:asc"); empty without a sort */
export const sortParam = (sort: ColumnSort) => (sort ? `${sort.key}:${sort.dir}` : '');

/** One entry of a column's value list */
export type FilterOption = { value: string; label: string; count?: number };
export type FilterOptionsResult = { options: FilterOption[]; truncated?: boolean };

export const EMPTY_LABEL = '(Kosong)';

/** Numbers inside text sort as numbers: F1-2 before F1-10 */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Is `value` ticked by this filter (no filter ticks everything) */
export const isTicked = (sel: ColumnFilterSel | null | undefined, value: string) =>
    !sel || (sel.exclude ? !sel.values.includes(value) : sel.values.includes(value));

/** The `cols` query param of the server-side tables (Purchase Orders, Inspection Report) */
export const columnFiltersParam = (filters: ColumnFilters) => (Object.keys(filters).length ? JSON.stringify(filters) : '');

type CellValue = string | number | boolean | null | undefined;

export type FilterColumn<T> = {
    /** The cell's value; a list cell (USPs, articles) gives each of its values */
    get: (row: T) => CellValue | CellValue[];
    /** How a value reads in the list, e.g. a formatted date (the raw value sorts the list) */
    format?: (value: string) => string;
    /** Wording of the sort buttons; default text */
    kind?: SortKind;
};

const cellValues = (v: CellValue | CellValue[]): string[] => {
    const list = Array.isArray(v) ? v : [v];
    const out = list.map(x => (x === null || x === undefined ? '' : String(x).trim()));
    return out.length ? out : [''];
};

/** Two cell texts in sort order: both numbers compare as numbers, otherwise as natural text */
const compareCells = (a: string, b: string) => {
    const na = Number(a);
    const nb = Number(b);
    if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return naturalCompare(a, b);
};

/**
 * Column filters for a table whose rows are all loaded in the browser. `columns` maps a filter key
 * to how its value is read. Returns the filtered rows and, per column, the props for <ColumnFilter>.
 * A row stays when one of its values is ticked in every filtered column, like Excel. `filtered`
 * comes sorted when a column header sorted it (a list cell sorts by its first value, empty cells last).
 */
export function useColumnFilters<T>(
    rows: T[],
    columns: Record<string, FilterColumn<T>>,
    onChange?: () => void,
    options?: { initialSort?: ColumnSort },
) {
    const [filters, setFilters] = useState<ColumnFilters>({});
    const [sort, setSortState] = useState<ColumnSort>(options?.initialSort ?? null);
    const columnsRef = useRef(columns);
    columnsRef.current = columns;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const passes = (row: T, active: [string, Set<string>, boolean][], skip?: string) =>
        active.every(([key, set, exclude]) =>
            key === skip || cellValues(columnsRef.current[key].get(row)).some(v => set.has(v) !== exclude));

    const activeList = (f: ColumnFilters) =>
        Object.entries(f)
            .filter(([key]) => columnsRef.current[key])
            .map(([key, sel]) => [key, new Set(sel.values), !!sel.exclude] as [string, Set<string>, boolean]);

    const filtered = useMemo(() => {
        const active = activeList(filters);
        const kept = active.length ? rows.filter(row => passes(row, active)) : rows;
        const col = sort ? columnsRef.current[sort.key] : undefined;
        if (!sort || !col) return kept;
        const sign = sort.dir === 'asc' ? 1 : -1;
        const first = (row: T) => cellValues(col.get(row))[0];
        // Array.sort is stable: rows with the same value keep the order they came in
        return [...kept].sort((a, b) => {
            const x = first(a);
            const y = first(b);
            if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1; // empty cells stay last either way
            return sign * compareCells(x, y);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, filters, sort]);

    const setFilter = (key: string, sel: ColumnFilterSel | null) => {
        setFilters(prev => {
            const next = { ...prev };
            if (sel) next[key] = sel; else delete next[key];
            return next;
        });
        onChangeRef.current?.();
    };

    const setSort = (next: ColumnSort) => {
        setSortState(next);
        onChangeRef.current?.();
    };

    const clearAll = () => {
        setFilters({});
        onChangeRef.current?.();
    };

    // Values of one column among the rows the other filters keep, like Excel's list
    const optionsFor = (key: string): FilterOptionsResult => {
        const col = columnsRef.current[key];
        const active = activeList(filters);
        const counts = new Map<string, number>();
        for (const row of rows) {
            if (!passes(row, active, key)) continue;
            for (const v of new Set(cellValues(col.get(row)))) counts.set(v, (counts.get(v) || 0) + 1);
        }
        const options = [...counts.entries()]
            .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : naturalCompare(a, b)))
            .map(([value, count]) => ({ value, count, label: value === '' ? EMPTY_LABEL : col.format ? col.format(value) : value }));
        return { options };
    };

    /** Props for the <ColumnFilter> of column `key` */
    const bind = (key: string, title: string) => ({
        title,
        sel: filters[key] ?? null,
        loadOptions: () => optionsFor(key),
        onApply: (sel: ColumnFilterSel | null) => setFilter(key, sel),
        sort: sort?.key === key ? sort.dir : null,
        onSort: (dir: SortDir | null) => setSort(dir ? { key, dir } : null),
        sortKind: columns[key]?.kind ?? ('text' as SortKind),
    });

    return { filtered, filters, setFilter, clearAll, activeCount: Object.keys(filters).length, sort, setSort, bind };
}
