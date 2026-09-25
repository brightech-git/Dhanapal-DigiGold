// src/types/Scheme/Scheme.ts

export type MetalType = 'G' | 'S' | 'P' | 'D';
export type SchemeType = 'A' | string;
export type YN = 'Y' | 'N';

export interface ApiScheme {
  SchemeId: number;
  schemeName: string;
  SchemeSName: string;
  WeightLedger: YN;
  SCHEMETYPE: SchemeType;
  ACTIVE: YN;
  FixedIns: YN;
  image_path: string;
  Instalment: number;
  ADDNEWMEMBER: YN;
  GroupCodeForAllAmount: YN;
  GROUPCODE: string;
  RegNo: number;
  COMMAMT: number;
  MetalType: MetalType | string;
}

export interface SchemesResponse {
  schemes: ApiScheme[];
}

import { COLORS } from '../../theme/theme';

// ── Display helpers ──────────────────────────────────────────────
export const METAL_LABEL: Record<string, string> = {
  G: 'Gold',
  S: 'Silver',
  P: 'Platinum',
  D: 'Diamond',
};

export const METAL_COLOR: Record<string, string> = {
  G: COLORS.goldPrimary,   // #A8CFA8 Sage Green
  S: COLORS.gray400,       // #9E9E9E Silver gray
  P: COLORS.gray500,       // #757575 Platinum gray
  D: COLORS.infoLight,     // #42A5F5 Diamond blue
};

export const METAL_GRADIENT: Record<string, [string, string]> = {
  G: [COLORS.goldPrimary, COLORS.goldDark],
  S: [COLORS.gray400,     COLORS.gray600],
  P: [COLORS.gray500,     COLORS.gray700],
  D: [COLORS.infoLight,   COLORS.info],
};
