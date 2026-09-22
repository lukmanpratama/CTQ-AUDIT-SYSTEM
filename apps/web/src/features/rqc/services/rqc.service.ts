// apps/web/src/features/rqc/services/rqc.service.ts
// RQC API service calls — all from apiClient

import { apiClient } from '../../../lib/api-client';
import type {
  SetupModelDto,
  MasterPoDto,
  SetupAreaDto,
  SetupProcessDto,
  SetupDefectDto,
  RqcHeaderDto,
  RqcAreaDto,
  RqcProcessDto,
  RqcInspectionDto,
  CreateRqcHeaderRequest,
  CreateRqcAreaRequest,
  CreateRqcProcessRequest,
  CreateRqcInspectionRequest,
  UpdateRqcInspectionRequest,
} from '@ctqaudit/types';

// ─────────────────────────────────────────────
// CTQ Configuration (read-only for frontend)
// ─────────────────────────────────────────────

export const getModels = () =>
  apiClient.get<SetupModelDto[]>('/models');

export const getModelById = (modelId: number) =>
  apiClient.get<SetupModelDto>(`/models/${modelId}`);

export const getPosForModel = (modelId: number) =>
  apiClient.get<MasterPoDto[]>(`/pos?modelId=${modelId}`);

export const getAreasForModel = (modelId: number) =>
  apiClient.get<SetupAreaDto[]>(`/models/${modelId}/areas`);

export const getProcessesForArea = (setupAreaId: number) =>
  apiClient.get<SetupProcessDto[]>(`/setup-areas/${setupAreaId}/processes`);

export const getDefectsForProcess = (setupProcessId: number) =>
  apiClient.get<SetupDefectDto[]>(`/setup-processes/${setupProcessId}/defects`);

// ─────────────────────────────────────────────
// RQC Audit Transactions
// ─────────────────────────────────────────────

export const createRqcHeader = (data: CreateRqcHeaderRequest) =>
  apiClient.post<RqcHeaderDto>('/rqc/headers', data);

export const getRqcHeader = (headerId: string) =>
  apiClient.get<RqcHeaderDto>(`/rqc/headers/${headerId}`);

export const createRqcArea = (headerId: string, data: CreateRqcAreaRequest) =>
  apiClient.post<RqcAreaDto>(`/rqc/headers/${headerId}/areas`, data);

export const createRqcProcess = (
  areaId: string,
  data: CreateRqcProcessRequest,
) => apiClient.post<RqcProcessDto>(`/rqc/areas/${areaId}/processes`, data);

export const createInspection = (
  processId: string,
  data: CreateRqcInspectionRequest,
) =>
  apiClient.post<RqcInspectionDto>(
    `/rqc/processes/${processId}/inspections`,
    data,
  );

export const updateInspection = (
  inspectionId: string,
  data: UpdateRqcInspectionRequest,
) =>
  apiClient.patch<RqcInspectionDto>(
    `/rqc/inspections/${inspectionId}`,
    data,
  );
