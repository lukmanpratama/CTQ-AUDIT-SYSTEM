"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelLabel = exports.modelArticles = exports.normalizeArticle = exports.MODEL_MATCH_SELECT = void 0;
exports.parseArticles = parseArticles;
exports.modelNameContainsWhere = modelNameContainsWhere;
exports.poWhereForModel = poWhereForModel;
exports.tqcWhereForModel = tqcWhereForModel;
exports.MODEL_MATCH_SELECT = {
    setupModelId: true,
    modelName: true,
    modelNo: true,
    isActive: true,
    articles: { select: { article: true } },
};
const normalizeArticle = (s) => String(s ?? '').replace(/ /g, ' ').trim().toUpperCase();
exports.normalizeArticle = normalizeArticle;
function parseArticles(input) {
    const parts = Array.isArray(input) ? input : String(input ?? '').split(/[\s,;]+/);
    return [...new Set(parts.map(exports.normalizeArticle).filter(Boolean))];
}
const modelArticles = (model) => (model.articles || []).map(a => a.article);
exports.modelArticles = modelArticles;
function modelNameContainsWhere(modelName) {
    const words = String(modelName ?? '').split(/\s+/).map(w => w.trim()).filter(Boolean);
    return words.length > 0
        ? { AND: words.map(word => ({ model: { contains: word, mode: 'insensitive' } })) }
        : undefined;
}
function poWhereForModel(model) {
    const articles = (0, exports.modelArticles)(model);
    if (articles.length > 0)
        return { article: { in: articles, mode: 'insensitive' } };
    return modelNameContainsWhere(model.modelName);
}
function tqcWhereForModel(model, nameMatch = 'contains') {
    const articles = (0, exports.modelArticles)(model);
    if (articles.length > 0)
        return { article: { in: articles, mode: 'insensitive' } };
    return nameMatch === 'equals'
        ? { model: model.modelName }
        : { model: { contains: model.modelName, mode: 'insensitive' } };
}
const modelLabel = (model) => model.modelNo ? `${model.modelName} (${model.modelNo})` : model.modelName;
exports.modelLabel = modelLabel;
//# sourceMappingURL=model-match.js.map