import { Prisma } from '@prisma/client';
type ModelWithArticles = {
    modelName: string;
    articles?: {
        article: string;
    }[];
};
export declare const MODEL_MATCH_SELECT: {
    setupModelId: true;
    modelName: true;
    modelNo: true;
    isActive: true;
    articles: {
        select: {
            article: true;
        };
    };
};
export declare const normalizeArticle: (s: unknown) => string;
export declare function parseArticles(input: unknown): string[];
export declare const modelArticles: (model: ModelWithArticles) => string[];
export declare function modelNameContainsWhere(modelName?: string): {
    AND: {
        model: {
            contains: string;
            mode: "insensitive";
        };
    }[];
} | undefined;
export declare function poWhereForModel(model: ModelWithArticles): Prisma.MasterPoWhereInput | undefined;
export declare function tqcWhereForModel(model: ModelWithArticles, nameMatch?: 'contains' | 'equals'): Prisma.TqcReportWhereInput;
export declare const modelLabel: (model: {
    modelName: string;
    modelNo?: string | null;
}) => string;
export {};
//# sourceMappingURL=model-match.d.ts.map