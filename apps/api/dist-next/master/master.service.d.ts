import { PrismaService } from '../prisma/prisma.service';
export declare class MasterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllAreas(): Promise<{
        areaId: bigint;
        area: string;
    }[]>;
    createArea(data: {
        area: string;
    }): Promise<{
        areaId: bigint;
        area: string;
    }>;
    updateArea(areaId: bigint, data: {
        area: string;
    }): Promise<{
        areaId: bigint;
        area: string;
    }>;
    deleteArea(areaId: bigint): Promise<{
        areaId: bigint;
        area: string;
    }>;
    findAllProcesses(): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }[]>;
    createProcess(data: {
        process: string;
        ctq?: string;
        riskLevel?: string;
    }): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }>;
    updateProcess(processId: bigint, data: {
        process?: string;
        ctq?: string;
        riskLevel?: string;
        sellingPoint?: string;
    }): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }>;
    deleteProcess(processId: bigint): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }>;
    findAllDefects(): Promise<{
        defectId: bigint;
        defect: string;
    }[]>;
    createDefect(data: {
        defect: string;
    }): Promise<{
        defectId: bigint;
        defect: string;
    }>;
    updateDefect(defectId: bigint, data: {
        defect: string;
    }): Promise<{
        defectId: bigint;
        defect: string;
    }>;
    deleteDefect(defectId: bigint): Promise<{
        defectId: bigint;
        defect: string;
    }>;
    findAllFactories(): Promise<{
        factoryId: bigint;
        factory: string;
    }[]>;
    createFactory(data: {
        factory: string;
    }): Promise<{
        factoryId: bigint;
        factory: string;
    }>;
    private buildModelLikeWhere;
    findAllPos(modelLike?: string, setupModelId?: string): Promise<{
        article: string;
        po: string;
        model: string;
        qtyOrder: number;
        destination: string | null;
    }[]>;
    private searchWords;
    private buildPoWhere;
    findPoFilterOptions(field: string, search: string | undefined, filters: {
        q?: string;
        po?: string;
        article?: string;
        model?: string;
        destination?: string;
    }): Promise<{
        options: {
            value: any;
            count: any;
        }[];
        truncated: boolean;
    }>;
    findPosPaged(page?: number, limit?: number, filters?: {
        q?: string;
        po?: string;
        article?: string;
        model?: string;
        destination?: string;
    }): Promise<{
        data: {
            article: string;
            po: string;
            model: string;
            qtyOrder: number;
            destination: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    createPo(data: {
        po: string;
        article: string;
        model: string;
        qtyOrder: number;
        destination?: string;
    }): Promise<{
        article: string;
        po: string;
        model: string;
        qtyOrder: number;
        destination: string | null;
    }>;
    bulkCreatePos(data: {
        po: string;
        article: string;
        model: string;
        qtyOrder: number;
        destination?: string;
    }[]): Promise<{
        success: boolean;
        processed: number;
    }>;
    updatePo(po: string, data: {
        article?: string;
        model?: string;
        qtyOrder?: number;
        destination?: string;
    }): Promise<{
        article: string;
        po: string;
        model: string;
        qtyOrder: number;
        destination: string | null;
    }>;
    deletePo(po: string): Promise<{
        article: string;
        po: string;
        model: string;
        qtyOrder: number;
        destination: string | null;
    }>;
    deleteAllPos(): Promise<{
        message: string;
        deletedCount: number;
    }>;
    findAllUsers(): Promise<{
        nik: string;
        namaUser: string;
        role: string;
        isActive: boolean;
    }[]>;
    createUser(data: {
        nik: string;
        namaUser: string;
        password?: string;
        role?: string;
    }): Promise<{
        nik: string;
        namaUser: string;
        role: string;
        isActive: boolean;
    }>;
    updateUser(nik: string, data: {
        namaUser: string;
        role: string;
        isActive: boolean;
        password?: string;
    }): Promise<{
        nik: string;
        namaUser: string;
        role: string;
        isActive: boolean;
    }>;
    deleteUser(nik: string): Promise<{
        nik: string;
        namaUser: string;
        passwordHash: string;
        role: string;
        isActive: boolean;
    }>;
    findAllUsps(modelId?: bigint, status?: string): Promise<any>;
    createUsp(data: {
        setupModelId: string | bigint | number;
        uspCode: string;
        uspName: string;
        description?: string;
        isActive: boolean;
    }): Promise<any>;
    updateUsp(uspId: bigint, data: {
        setupModelId?: string | bigint | number;
        uspCode?: string;
        uspName?: string;
        description?: string;
        isActive?: boolean;
    }): Promise<any>;
    deleteUsp(uspId: bigint): Promise<any>;
    private serializeBigInt;
}
//# sourceMappingURL=master.service.d.ts.map