import { MasterService } from './master.service';
import { CreateAreaDto, CreateProcessDto, CreateDefectDto, CreateFactoryDto, CreateUserDto, CreatePoDto, UpdateAreaDto, UpdateProcessDto, UpdateDefectDto, UpdateUserDto, UpdatePoDto, CreateUspDto, UpdateUspDto } from './dto/master.dto';
export declare class MasterController {
    private readonly masterService;
    constructor(masterService: MasterService);
    getAreas(): Promise<{
        areaId: bigint;
        area: string;
    }[]>;
    createArea(dto: CreateAreaDto): Promise<{
        areaId: bigint;
        area: string;
    }>;
    updateArea(id: string, dto: UpdateAreaDto): Promise<{
        areaId: bigint;
        area: string;
    }>;
    deleteArea(id: string): Promise<{
        areaId: bigint;
        area: string;
    }>;
    getProcesses(): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }[]>;
    createProcess(dto: CreateProcessDto): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }>;
    updateProcess(id: string, dto: UpdateProcessDto): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }>;
    deleteProcess(id: string): Promise<{
        processId: bigint;
        process: string;
        ctq: string | null;
        riskLevel: string | null;
        sellingPoint: string | null;
    }>;
    getDefects(): Promise<{
        defectId: bigint;
        defect: string;
    }[]>;
    createDefect(dto: CreateDefectDto): Promise<{
        defectId: bigint;
        defect: string;
    }>;
    updateDefect(id: string, dto: UpdateDefectDto): Promise<{
        defectId: bigint;
        defect: string;
    }>;
    deleteDefect(id: string): Promise<{
        defectId: bigint;
        defect: string;
    }>;
    getFactories(): Promise<{
        factoryId: bigint;
        factory: string;
    }[]>;
    createFactory(dto: CreateFactoryDto): Promise<{
        factoryId: bigint;
        factory: string;
    }>;
    getPos(modelLike?: string, setupModelId?: string): Promise<{
        article: string;
        po: string;
        model: string;
        qtyOrder: number;
        destination: string | null;
    }[]>;
    getPoFilterOptions(field: string, search?: string, q?: string, po?: string, article?: string, model?: string, destination?: string): Promise<{
        options: {
            value: any;
            count: any;
        }[];
        truncated: boolean;
    }>;
    getPosPaged(page?: string, limit?: string, q?: string, po?: string, article?: string, model?: string, destination?: string): Promise<{
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
    createPo(dto: CreatePoDto): Promise<{
        article: string;
        po: string;
        model: string;
        qtyOrder: number;
        destination: string | null;
    }>;
    bulkCreatePos(dtos: CreatePoDto[]): Promise<{
        success: boolean;
        processed: number;
    }>;
    deleteAllPos(): Promise<{
        message: string;
        deletedCount: number;
    }>;
    updatePo(id: string, dto: UpdatePoDto): Promise<{
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
    getUsers(): Promise<{
        nik: string;
        namaUser: string;
        role: string;
        isActive: boolean;
    }[]>;
    createUser(dto: CreateUserDto): Promise<{
        nik: string;
        namaUser: string;
        role: string;
        isActive: boolean;
    }>;
    updateUser(nik: string, dto: UpdateUserDto): Promise<{
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
    getUsps(modelId?: string, status?: string): Promise<any>;
    createUsp(dto: CreateUspDto): Promise<any>;
    updateUsp(id: string, dto: UpdateUspDto): Promise<any>;
    deleteUsp(id: string): Promise<any>;
}
//# sourceMappingURL=master.controller.d.ts.map