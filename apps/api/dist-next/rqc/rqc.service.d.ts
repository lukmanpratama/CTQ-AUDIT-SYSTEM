import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateHeaderDto, CreateInspectionDto, UpdateHeaderDto } from './rqc.dto';
type HeaderListFilters = {
    model?: string;
    modelId?: string;
    startDate?: string;
    endDate?: string;
    checkingTime?: string;
    inspector?: string;
    factoryId?: string;
    cell?: string;
};
export declare class RqcService {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    createHeader(dto: CreateHeaderDto): Promise<any>;
    private findSameClientHeader;
    updateHeader(headerId: string, dto: UpdateHeaderDto): Promise<any>;
    private resolveFactoryId;
    submitProcessInspection(headerId: string, setupAreaId: string, setupProcessId: string, dto: CreateInspectionDto): Promise<any>;
    deleteProcessInspection(headerId: string, setupAreaId: string, setupProcessId: string): Promise<{
        message: string;
    }>;
    deleteHeader(headerId: string): Promise<{
        success: boolean;
    }>;
    getHeaderSession(headerId: string): Promise<any>;
    getAllHeaders(filters: HeaderListFilters): Promise<any>;
    getHeadersByModel(filters: HeaderListFilters & {
        groupModelId?: string;
        page?: string;
        pageSize?: string;
    }): Promise<any>;
    getHeaderCells(modelId?: string): Promise<{
        cell: string | null;
    }[]>;
    private buildHeaderWhere;
    getDashboardFilterOptions(): Promise<any>;
    getDashboardKpis(filters?: {
        modelId?: string;
        areaId?: string;
        startDate?: string;
        endDate?: string;
        checkingTime?: string;
        factoryId?: string;
        cell?: string;
    }): Promise<{
        totalInspection: number;
        totalQtyChecking: number;
        totalQtyDefect: number;
        avgDefectRate: number;
        avgPassRate: number;
        openFindings: number;
        passCount: number;
        immediateActionCount: number;
        capCount: number;
        immediateActionUnfilled: number;
        capUnfilled: number;
        totalFindingsProcess: number;
        ctqKpis: {
            label: string;
            passRate: number;
        }[];
    }>;
    getRecentInspections(filters?: {
        modelId?: string;
        areaId?: string;
        startDate?: string;
        endDate?: string;
        checkingTime?: string;
        factoryId?: string;
        cell?: string;
    }): Promise<any>;
    getTrends(filters?: {
        modelId?: string;
        areaId?: string;
        areaName?: string;
        startDate?: string;
        endDate?: string;
        factoryId?: string;
        cell?: string;
        checkingTime?: string;
        processName?: string;
    }): Promise<any>;
    getProcessDefects(filters?: {
        modelId?: string;
        startDate?: string;
        endDate?: string;
        factoryId?: string;
        cell?: string;
        checkingTime?: string;
    }): Promise<any>;
    getImmediateActionData(filters?: {
        modelId?: string;
        startDate?: string;
        endDate?: string;
        factoryId?: string;
        cell?: string;
        areaName?: string;
    }): Promise<any>;
    getTqcEolSummary(filters?: {
        modelId?: string;
        startDate?: string;
        endDate?: string;
        cell?: string;
    }): Promise<{
        cells: never[];
        passRateData: never[];
        averagePassRate: number;
        averageDefectRate: number;
        topDefects: never[];
        qtyChecking: number;
        qtyDefect: number;
        tabs?: undefined;
    } | {
        tabs: string[];
        passRateData: any[];
        averagePassRate: number;
        averageDefectRate: number;
        topDefects: {
            name: string;
            absoluteVal: number;
            qty: number;
        }[];
        qtyChecking: number;
        qtyDefect: number;
        cells?: undefined;
    }>;
    getCapData(filters?: {
        modelId?: string;
        startDate?: string;
        endDate?: string;
        factoryId?: string;
        cell?: string;
    }): Promise<any>;
    getCtqDetails(filters: {
        modelId: string;
        ctqType: string;
        startDate?: string;
        endDate?: string;
    }): Promise<any>;
    getDefectCtqSummary(modelIdStr: string, startDate?: string, endDate?: string, cell?: string): Promise<{
        usps: never[];
        rqcData: {};
        tqcData: {};
        rqcTopProcesses: never[];
        tqcTopDefects: never[];
        rqcTopProcessesByUsp?: undefined;
        rqcTopDefectsByUsp?: undefined;
        tqcTopDefectsByUsp?: undefined;
    } | {
        usps: string[];
        rqcData: any;
        tqcData: any;
        rqcTopProcessesByUsp: any;
        rqcTopDefectsByUsp: any;
        tqcTopDefectsByUsp: any;
        rqcTopProcesses?: undefined;
        tqcTopDefects?: undefined;
    }>;
    private serializeBigInt;
}
export {};
//# sourceMappingURL=rqc.service.d.ts.map