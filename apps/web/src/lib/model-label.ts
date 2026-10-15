// Several Setup CTQ models can share one name (one per Model No), so lists show the Model No too.

type ModelLike = { modelName?: string | null; modelNo?: string | null; articles?: { article: string }[] | null };

export const modelLabel = (model?: ModelLike | null) => {
    if (!model?.modelName) return '';
    return model.modelNo ? `${model.modelName} (${model.modelNo})` : model.modelName;
};

/** A TQC row belongs to a model through its article when the model has articles, else by name. */
export const tqcRowMatchesModel = (row: { model?: string | null; article?: string | null }, model: ModelLike) => {
    const articles = (model.articles || []).map(a => a.article.toUpperCase());
    if (articles.length > 0) return articles.includes(String(row.article || '').trim().toUpperCase());
    return row.model === model.modelName;
};
