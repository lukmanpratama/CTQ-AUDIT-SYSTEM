// Model names and articles taken from the Purchase Orders (master_po), for adding a Setup CTQ
// model from PO data instead of typing it. Uses the PO page's column filter endpoint, which
// returns distinct values with their PO counts.

export type PoModelOption = {
    /** Upper-case name with single spaces: what a Setup CTQ model is saved as */
    name: string;
    /** Spellings of that name as they appear in the POs (e.g. "Adizero Pacer J" and "ADIZERO PACER J") */
    variants: string[];
    poCount: number;
};

export type PoArticleOption = { article: string; poCount: number };

/** Excel imports leave non-breaking spaces and mixed case in PO model names. */
export const normalizePoName = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

async function fetchOptions(params: Record<string, string>, signal?: AbortSignal) {
    const res = await fetch(`/api/master/pos/filter-options?${new URLSearchParams(params).toString()}`, { signal });
    const body = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(body?.options)) {
        throw new Error(body?.message || `Gagal memuat data PO (${res.status}).`);
    }
    return body as { options: { value: string; count: number }[]; truncated: boolean };
}

/** PO model names matching `search` (every word must appear), merged across spellings. */
export async function searchPoModels(search: string, signal?: AbortSignal) {
    const { options, truncated } = await fetchOptions({ field: 'model', search }, signal);
    const byName = new Map<string, PoModelOption>();
    for (const o of options) {
        const name = normalizePoName(o.value);
        if (!name) continue;
        const entry = byName.get(name) ?? { name, variants: [], poCount: 0 };
        entry.variants.push(o.value);
        entry.poCount += o.count;
        byName.set(name, entry);
    }
    // Exact name first, then names starting with the search, then the rest A-Z: Enter picks the
    // top one, and "DURAMO SL2 W WIDE" must not lose to "DURAMO SL2 M WIDE" (W matches WIDE)
    const q = normalizePoName(search);
    const rank = (name: string) => (!q ? 0 : name === q ? 0 : name.startsWith(q) ? 1 : 2);
    const models = [...byName.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
    return { models, truncated };
}

/** Articles found in the POs of these model spellings, with their PO counts. */
export async function fetchPoArticles(variants: string[], signal?: AbortSignal) {
    const results = await Promise.all(variants.map(model => fetchOptions({ field: 'article', model }, signal)));
    const byArticle = new Map<string, number>();
    for (const { options } of results) {
        for (const o of options) {
            const article = normalizePoName(o.value);
            if (article) byArticle.set(article, (byArticle.get(article) ?? 0) + o.count);
        }
    }
    return {
        articles: [...byArticle.entries()]
            .map(([article, poCount]) => ({ article, poCount }))
            .sort((a, b) => a.article.localeCompare(b.article)),
        truncated: results.some(r => r.truncated),
    };
}

/** Articles of the POs whose model name equals `modelName` (any spelling). */
export async function fetchPoArticlesForModelName(modelName: string, signal?: AbortSignal) {
    const name = normalizePoName(modelName);
    const { models } = await searchPoModels(name, signal);
    const match = models.find(m => m.name === name);
    if (!match) return { articles: [] as PoArticleOption[], truncated: false, found: false };
    return { ...(await fetchPoArticles(match.variants, signal)), found: true };
}
