import { RqcService } from './rqc.service';
import { CreateHeaderDto, CreateInspectionDto, UpdateHeaderDto, ImportInspectionsDto } from './rqc.dto';
import { RqcImportService } from './rqc-import.service';
export declare class RqcController {
    private readonly rqcService;
    private readonly rqcImportService;
    constructor(rqcService: RqcService, rqcImportService: RqcImportService);
    createHeader(dto: CreateHeaderDto): Promise<any>;
    importInspections(dto: ImportInspectionsDto): Promise<{
        applied: boolean;
        summary: {
            rows: number;
            audits: number;
            auditsToCreate: number;
            auditsSkipped: number;
            processes: number;
            noDefectProcesses: number;
            defects: number;
            defectPcs: number;
            immediateActions: number;
            caps: number;
            models: string[];
            dateFrom: string;
            dateTo: string;
            factoriesToCreate: string[];
            setupDefectsToAdd: string[];
        };
        errors: {
            row: number;
            message: string;
        }[];
        errorsTruncated: boolean;
    }>;
    getKpis(modelId?: string, areaId?: string, startDate?: string, endDate?: string, checkingTime?: string, factoryId?: string, cell?: string): Promise<{
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
    getTrends(modelId?: string, areaId?: string, areaName?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string, checkingTime?: string, processName?: string): Promise<any>;
    getCapData(modelId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string): Promise<any>;
    getProcessDefects(modelId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string, checkingTime?: string): Promise<any>;
    getDefectCtqSummary(modelId: string, startDate?: string, endDate?: string, cell?: string): Promise<{
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
    getCtqDetails(modelId: string, ctqType: string, startDate?: string, endDate?: string): Promise<any>;
    getTqcEolSummary(modelId?: string, startDate?: string, endDate?: string, cell?: string): Promise<{
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
    getRecentInspections(modelId?: string, areaId?: string, startDate?: string, endDate?: string, checkingTime?: string, factoryId?: string, cell?: string): Promise<any>;
    getHeaderCells(modelId?: string): Promise<{
        cell: string | null;
    }[]>;
    getFilters(): Promise<any>;
    getImmediateActions(modelId?: string, startDate?: string, endDate?: string, factoryId?: string, cell?: string, areaName?: string): Promise<any>;
    getAllHeaders(model?: string, modelId?: string, startDate?: string, endDate?: string, checkingTime?: string, inspector?: string, factoryId?: string, cell?: string): Promise<any>;
    getHeadersByModel(model?: string, modelId?: string, startDate?: string, endDate?: string, checkingTime?: string, inspector?: string, factoryId?: string, cell?: string, groupModelId?: string, page?: string, pageSize?: string): Promise<any>;
    updateHeader(headerId: string, dto: UpdateHeaderDto): Promise<any>;
    deleteHeader(headerId: string): Promise<{
        success: boolean;
    }>;
    submitInspection(headerId: string, areaId: string, processId: string, dto: CreateInspectionDto): Promise<any>;
    deleteInspection(headerId: string, areaId: string, processId: string): Promise<{
        message: string;
    }>;
    getHeader(headerId: string): Promise<any>;
}
//# sourceMappingURL=rqc.controller.d.ts.map