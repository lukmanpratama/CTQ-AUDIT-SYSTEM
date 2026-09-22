// apps/web/src/features/rqc/types/index.ts
// Frontend-specific RQC state types

export interface AuditSession {
  selectedModel: {
    setupModelId: number;
    modelName: string;
    picture?: string;
  } | null;

  header: {
    rqcHeaderId: string;
    date: string;
    checkingTime: string;
    po: string;
    article: string;
    model: string;
    qtyOrder: number;
    factory: string;
    inspectorName: string;
  } | null;

  selectedArea: {
    rqcAreaId: string;
    setupAreaId: number;
    areaName: string;
  } | null;

  selectedProcess: {
    rqcProcessId: string;
    setupProcessId: number;
    processName: string;
    qtyChecking: number;
  } | null;
}

export interface InspectionFormEntry {
  defectId: number;
  defectName: string;
  qtyDefect: number;
}
