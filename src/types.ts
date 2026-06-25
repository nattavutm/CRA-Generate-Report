// In-memory data model only. Nothing here is persisted (see cra.md §2, §7).

import type { BrowserWorker } from '@cloudflare/puppeteer';

// ---------- Worker environment ----------

export interface Env {
  BROWSER: BrowserWorker; // Browser Rendering binding (puppeteer.launch)
  V1_API_TOKEN: string; // secret: Vision One Bearer token
  V1_REGION: string; // var: region key, default 'sg'
  ANTHROPIC_API_KEY?: string; // optional secret: AI draft (§11)
  REPORTS?: R2Bucket; // optional PDF cache (§9)
}

// ---------- Vision One: securityPosture response (GET /v3.0/asrm/securityPosture) ----------

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SecurityPosture {
  schemaVersion: string;
  companyId: string;
  companyName: string;
  createdDateTime: string;
  riskIndex?: number;
  riskCategoryLevel: { exposure: RiskLevel; attack: RiskLevel; securityConfiguration: RiskLevel };
  vulnerabilityAssessmentCoverageRate: number; // already a percentage (e.g. 52.2)
  cveManagementMetrics: {
    count: number;
    mttpDays?: number;
    averageUnpatchedDays: number;
    density: number;
    vulnerableEndpointRate: number;
    legacyOsEndpointCount: number;
  };
  exposureStatus: {
    unexpectedInternetFacingInterfaceStatus: { servicePortCount: number; publicIpCount: number };
    insecureHostConnectionStatus: { insecureHostCount: number; connectionIssueCount: number };
    domainAccountMisconfigurationStatus: {
      weakAuthenticationCount: number;
      increaseAttackSurfaceRiskCount: number;
      excessivePrivilegeCount: number;
    };
  };
  securityConfigurationStatus: {
    endpointAgentStatus: {
      agentAdoptionCount: number;
      agentVersionStatus: { outdatedCount: number; otherCount: number; latestCount: number };
      edrFeatureAdoptionCount: number;
    };
    virtualPatchingStatus: { patchedCount: number; partialPatchedCount: number; notPatchedCount: number };
  };
}

export interface InternetFacingCve {
  cveId: string;
  cveRiskScore: number;
  cvssScore: number;
  affectedAssetCount: number;
  globalExploitActivityLevel: string;
}

export interface DomainAccount {
  name: string;
  id: string;
  role?: string;
  lastDetectedDateTime?: string;
}

export interface HighRiskDevice {
  id: string;
  deviceName: string;
  os: string;
  riskScore: number;
}

export interface AlertSummary {
  name: string;
  severity: string;
  score?: number;
  entity: string;
  time: string;
}

// Live data slice — used to pre-fill editorial defaults and the trend table's latest column.
export interface LiveData {
  available: boolean;
  companyName?: string;
  createdDateTime?: string;
  riskIndex: number | null;
  categoryLevels: { exposure: string; attack: string; securityConfiguration: string };
  coverageRate: number | null;
  cve: { count: number; mttpDays: number | null; averageUnpatchedDays: number; legacyOsEndpointCount: number } | null;
  staleAccountCount: number | null;
  alerts: AlertSummary[];
  errors: Record<string, string>;
}

// ---------- Form input / editorial content (cra.md §2.3, §7) ----------

export type SessionStatus = 'Completed' | 'Upcoming';

export interface TrendPoint {
  day1?: number;
  day30?: number;
  day60?: number;
  day90?: number;
}

export interface HeroMetric {
  value: string;
  label: string;
  accent?: boolean; // render the value in red
}

export interface Finding {
  riskLevel: 'High' | 'Medium' | 'Low';
  category: 'Exposure' | 'Attack' | 'Configuration';
  title: string;
  detail: string[];
  recommendation: string[];
  status: string;
}

export interface Session {
  label: string;
  date: string;
  time: string;
  status: SessionStatus;
}

export interface ReportConfig {
  customerName: string;
  region: string;
  engagement: { docId: string; cycleLabel: string };
  coverTitle?: string;
  coverSubtitle?: string;

  // §01 Executive Summary
  executiveSummary: string;
  hero?: HeroMetric[]; // up to 4 cards; blank → derived from live
  whatChanged: string[];

  // §03 Risk Index trend (manual; Risk Index Day 90 defaults to live)
  trend?: {
    riskIndex?: TrendPoint;
    exposure?: TrendPoint;
    attack?: TrendPoint;
    securityConfiguration?: TrendPoint;
  };
  riskIndexNote?: string;

  // §04 Exposure Overview
  exposure?: { narrative?: string; subNarrative?: string; findings?: string[] };

  // §05 Security Configuration Overview
  securityConfig?: { narrative?: string; endpointProtection?: string; featureAdoption?: string[]; endpointSensor?: string };

  // §06 Attack Overview
  attack?: { narrative?: string; detections?: string[] };

  // §07 Recommendations
  recommendations?: Finding[];

  // §08 cadence
  sessions: Session[];

  dataSourceNotes?: string;
  workbench?: { startDateTime?: string; endDateTime?: string };
}

export interface ReportModel {
  config: ReportConfig;
  live: LiveData;
  generatedAt: string;
}
