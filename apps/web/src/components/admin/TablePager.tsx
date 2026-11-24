'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** "Tampilkan N data" choices of every admin table */
export const PAGE_SIZES = [5, 10, 25, 50] as const;

/**
 * Paging for a table whose rows are all loaded in the browser. `resetKey` sends the table back
 * to page 1 whenever it changes (a search, a filter, a sort). A page that no longer exists after
 * a delete or a filter falls back to the last one.
 */
export function usePagination<T>(rows: T[], { initialSize = 10, resetKey }: { initialSize?: number; resetKey?: unknown } = {}) {
    const [pageSize, setPageSizeState] = useState(initialSize);
    const [page, setPage] = useState(1);
    const key = JSON.stringify(resetKey ?? null);
    useEffect(() => { setPage(1); }, [key]);

    const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1);
    const current = Math.min(page, totalPages);
    const firstIndex = (current - 1) * pageSize;
    return {
        pageRows: rows.slice(firstIndex, firstIndex + pageSize),
        page: current,
        pageSize,
        total: rows.length,
        firstIndex,
        setPage,
        setPageSize: (size: number) => { setPageSizeState(size); setPage(1); },
    };
}

/** First, last and the pages around the current one; gaps become an ellipsis */
function pageNumbers(current: number, total: number): (number | 'gap')[] {
    const pages: (number | 'gap')[] = [];
    for (let p = 1; p <= total; p++) {
        if (p === 1 || p === total || Math.abs(p - current) <= 1) pages.push(p);
        else if (pages[pages.length - 1] !== 'gap') pages.push('gap');
    }
    return pages;
}

const pageBtn = 'min-w-[2rem] h-8 px-2 rounded-md border text-xs font-medium transition-colors';
const navBtn = `${pageBtn} bg-white border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`;

/**
 * Footer under a table: "Tampilkan [5 | 10 | 25 | 50] data", the range shown and Prev / page numbers / Next.
 * Controlled, so it serves both the tables paged in the browser (usePagination) and the ones the
 * server pages.
 */
export default function TablePager({ page, pageSize, total, onPage, onPageSize, disabled = false, noun = 'data', extra }: {
    page: number;
    pageSize: number;
    total: number;
    onPage: (page: number) => void;
    onPageSize: (size: number) => void;
    /** While a page is loading */
    disabled?: boolean;
    noun?: string;
    /** Next to the range, e.g. "Hapus filter kolom" */
    extra?: ReactNode;
}) {
    if (total === 0) return null;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
        <div className="flex-shrink-0 flex flex-col lg:flex-row items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1.5 text-xs text-gray-500">
                <label className="flex items-center gap-1.5">
                    Tampilkan
                    <select
                        value={pageSize}
                        onChange={e => onPageSize(Number(e.target.value))}
                        disabled={disabled}
                        className="h-8 pl-2 pr-1 border border-gray-300 rounded-md text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 cursor-pointer"
                    >
                        {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                    {noun}
                </label>
                <span>
                    Menampilkan <strong className="font-semibold text-gray-900">{from.toLocaleString()}–{to.toLocaleString()}</strong> dari{' '}
                    <strong className="font-semibold text-gray-900">{total.toLocaleString()}</strong> {noun}
                </span>
                {extra}
            </div>
            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onPage(page - 1)} disabled={disabled || page <= 1} className={navBtn}>Prev</button>
                    {pageNumbers(page, totalPages).map((p, i) => p === 'gap' ? (
                        <span key={`gap-${i}`} className="px-1 text-xs text-gray-400">…</span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPage(p)}
                            disabled={disabled}
                            aria-current={p === page ? 'page' : undefined}
                            className={`${pageBtn} ${p === page ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                        >
                            {p}
                        </button>
                    ))}
                    <button type="button" onClick={() => onPage(page + 1)} disabled={disabled || page >= totalPages} className={navBtn}>Next</button>
                </div>
            )}
        </div>
    );
}
