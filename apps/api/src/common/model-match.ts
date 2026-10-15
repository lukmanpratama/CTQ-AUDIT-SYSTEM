import { Prisma } from '@prisma/client';

/**
 * Several Setup CTQ models can share one name (e.g. 3 x "TAEKWONDO MEI BALLET W"), each with
 * its own Model No and its own USP/CTQ/process setup. PO and TQC rows don't carry a Model No,
 * only an article, so a model's article list is what links them to the right Model No.
 * Models without articles fall back to the old name matching.
 */

type ModelWithArticles = { modelName: string; articles?: { article: string }[] };

export const normalizeArticle = (s: unknown) => String(s ?? '').replace(/ /g, ' ').trim().toUpperCase();

/** Accepts "LA0398, LA0399", one per line, or an array; returns unique upper-case articles. */
export function parseArticles(input: unknown): string[] {
    const parts = Array.isArray(input) ? input : String(input ?? '').split(/[\s,;]+/);
    return [...new Set(parts.map(normalizeArticle).filter(Boolean))];
}

export const modelArticles = (model: ModelWithArticles) => (model.articles || []).map(a => a.article);

/** Name words must all appear (handles non-breaking spaces from Excel imports). */
export function modelNameContainsWhere(modelName?: string) {
    const words = String(modelName ?? '').split(/\s+/).map(w => w.trim()).filter(Boolean);
    return words.length > 0
        ? { AND: words.map(word => ({ model: { contains: word, mode: 'insensitive' as const } })) }
        : undefined;
}

/** Master PO rows that belong to this model. */
export function poWhereForModel(model: ModelWithArticles): Prisma.MasterPoWhereInput | undefined {
    const articles = modelArticles(model);
    if (articles.length > 0) return { article: { in: articles, mode: 'insensitive' } };
    return modelNameContainsWhere(model.modelName);
}

/** TQC report rows that belong to this model. `nameMatch` keeps each caller's legacy name behaviour. */
export function tqcWhereForModel(model: ModelWithArticles, nameMatch: 'contains' | 'equals' = 'contains'): Prisma.TqcReportWhereInput {
    const articles = modelArticles(model);
    if (articles.length > 0) return { article: { in: articles, mode: 'insensitive' } };
    return nameMatch === 'equals'
        ? { model: model.modelName }
        : { model: { contains: model.modelName, mode: 'insensitive' } };
}

/** Label used wherever models are listed, so models sharing a name can be told apart. */
export const modelLabel = (model: { modelName: string; modelNo?: string | null }) =>
    model.modelNo ? `${model.modelName} (${model.modelNo})` : model.modelName;
