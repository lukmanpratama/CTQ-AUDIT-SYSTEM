// packages/types/src/index.ts
// Shared TypeScript types across web and api

// ══════════════════════════════════════════════════════════════════
// ENUMS
// ══════════════════════════════════════════════════════════════════

export enum InspectionStatus {
  IMMEDIATE_ACTION = 'IMMEDIATE_ACTION',
  CAP = 'CAP',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  RQC = 'RQC',
}

export enum CheckingTime {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  EVENING = 'EVENING',
}

// ══════════════════════════════════════════════════════════════════
// API RESPONSE SHAPES
// ══════════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ══════════════════════════════════════════════════════════════════
// MASTER DATA TYPES
// ══════════════════════════════════════════════════════════════════

export interface MasterAreaDto {
  areaId: number;
  area: string;
}

export interface MasterProcessDto {
  processId: number;
  process: string;
  ctq?: string;
  riskLevel?: string;
  sellingPoint?: string;
}

export interface MasterDefectDto {
  defectId: number;
  defect: string;
}

export interface MasterFactoryDto {
  factoryId: number;
  factory: string;
}

export interface MasterUserDto {
  nik: string;
  namaUser: string;
  role: UserRole;
  isActive: boolean;
}

export interface MasterPoDto {
  po: string;
  article: string;
  model: string;
  qtyOrder: number;
}

// ══════════════════════════════════════════════════════════════════
// CTQ SETUP TYPES
// ══════════════════════════════════════════════════════════════════

export interface SetupModelDto {
  setupModelId: number;
  modelName: string;
  picture?: string;
  isActive: boolean;
}

export interface SetupAreaDto {
  setupAreaId: number;
  setupModelId: number;
  area: MasterAreaDto;
}

export interface SetupProcessDto {
  setupProcessId: number;
  setupAreaId: number;
  process: MasterProcessDto;
}

export interface SetupDefectDto {
  setupDefectId: number;
  setupProcessId: number;
  defect: MasterDefectDto;
}

// ══════════════════════════════════════════════════════════════════
// RQC TRANSACTION TYPES
// ══════════════════════════════════════════════════════════════════

export interface RqcHeaderDto {
  rqcHeaderId: string;
  date: string;
  checkingTime: string;
  setupModelId: number;
  modelName: string;
  po: string;
  article: string;
  model: string;
  qtyOrder: number;
  factoryId: number;
  factory: string;
  nik: string;
  inspectorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRqcHeaderRequest {
  date: string;              // ISO date: YYYY-MM-DD
  checkingTime: string;      // MORNING | AFTERNOON | EVENING
  setupModelId: number;
  po: string;
  factoryId: number;
}

export interface RqcAreaDto {
  rqcAreaId: string;
  rqcHeaderId: string;
  setupAreaId: number;
  area: string;
}

export interface CreateRqcAreaRequest {
  setupAreaId: number;
}

export interface RqcProcessDto {
  rqcProcessId: string;
  rqcAreaId: string;
  setupProcessId: number;
  process: string;
  qtyChecking: number;
}

export interface CreateRqcProcessRequest {
  setupProcessId: number;
  qtyChecking: number;
}

export interface RqcInspectionDto {
  rqcInspectionId: string;
  rqcProcessId: string;
  defectId: number;
  defect: string;
  qtyDefect: number;
  qtyChecking: number;
  defectRate: number;
  passRate: number;
  status: InspectionStatus;
  photoDefect?: string;
  actionPlan?: string;
  photoAfterActionPlan?: string;
  durasiStopline?: number;
  rootCause?: string;
  corrective?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRqcInspectionRequest {
  defectId: number;
  qtyDefect: number;
}

export interface UpdateRqcInspectionRequest {
  actionPlan?: string;
  photoDefect?: string;
  photoAfterActionPlan?: string;
  durasiStopline?: number;
  rootCause?: string;
  corrective?: string;
  status?: InspectionStatus;
}

// ══════════════════════════════════════════════════════════════════
// AUTH TYPES
// ══════════════════════════════════════════════════════════════════

export interface LoginRequest {
  nik: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: MasterUserDto;
}

export interface JwtPayload {
  sub: string;  // nik
  role: UserRole;
  iat?: number;
  exp?: number;
}
