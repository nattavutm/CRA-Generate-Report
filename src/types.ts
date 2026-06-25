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
// Mirrors sp-api-open-v3.0.json. Only the fields the report consumes are typed in full;
// the rest are kept loose to survive schema drift.

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SecurityPosture {
  schemaVersion: string;
  companyId: string;
  companyName: string;
  createdDateTime: string;
  riskIndex?: number;
  riskCategoryLevel: {
    exposure: RiskLevel;
    attack: RiskLevel;
    securityConfiguration: RiskLevel;
  };
  highImpactRiskEvents: Array<{ factor: string; eventCount: number; affectedAssetCount: number }>;
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
    cloudAssetMisconfigurationStatus: { highRiskCount: number; mediumRiskCount: number };
    unexpectedInternetFacingInterfaceStatus: { servicePortCount: number; publicIpCount: number };
    insecureHostConnectionStatus: { insecureHostCount: number; connectionIssueCount: number };
    domainAccountMisconfigurationStatus: {
      weakAuthenticationCount: number;
      increaseAttackSurfaceRiskCount: number;
      excessivePrivilegeCount: number;
    };
    domainAccountCompromiseEventCount: number;
    legacyAuthenticationProtocolCount: number;
  };
  securityConfigurationStatus: {
    endpointAgentStatus: {
      agentAdoptionCount: number;
      agentVersionStatus: { outdatedCount: number; otherCount: number; latestCount: number };
      edrFeatureAdoptionCount: number;
      agentFeatureStatus: Record<string, Array<{ feature: string; adoptionRate: number }>>;
    };
    virtualPatchingStatus: { patchedCount: number; partialPatchedCount: number; notPatchedCount: number };
    emailSensorStatus: {
      exchange: { enabledMailboxCount: number; totalMailboxCount: number };
      gmail: { enabledMailboxCount: number; totalMailboxCount: number };
    };
    cloudAppsStatus: { sanctionedAppCount: number; unsanctionedAppCount: number };
  };
}

export interface InternetFacingCve {
  cveId: string;
  cveRiskLevel?: string;
  cveRiskScore: number;
  cvssScore: number;
  affectedAssetCount: number;
  exploitAttemptsCount?: number;
  globalExploitActivityLevel: string;
}

export interface DomainAccount {
  name: string;
  id: string;
  latestRiskScore?: number;
  criticality?: string;
  type?: string;
  role?: string;
  lastDetectedDateTime?: string;
}

export interface HighRiskDevice {
  id: string;
  deviceName: string;
  os: string;
  riskScore: number;
  lastLogonUser?: string;
  ip?: string[];
}

export interface AlertSummary {
  name: string;
  severity: string;
  score?: number;
  entity: string;
  time: string;
}

// ---------- Form input (cra.md §7) ----------

export type SessionStatus = 'Completed' | 'Upcoming';

export interface PriorPeriod {
  day1?: number;
  day30?: number;
  day60?: number;
}

export interface Finding {
  riskLevel: 'High' | 'Medium' | 'Low';
  category: 'Exposure' | 'Attack' | 'Configuration';
  title: string;
  detail: string[];
  recommendation: string[];
  status: string;
}

export interface ReportConfig {
  customerName: string;
  region: string;
  engagement: { docId: string; cycleLabel: string };
  sessions: Array<{ label: string; date: string; time: string; status: SessionStatus }>;
  priorRiskIndex?: PriorPeriod;
  priorCategory?: {
    exposure?: PriorPeriod;
    attack?: PriorPeriod;
    securityConfiguration?: PriorPeriod;
  };
  executiveSummary: string;
  whatChanged: string[];
  dataSourceNotes?: string;
  recommendationsOverride?: Finding[];
  workbench?: { startDateTime?: string; endDateTime?: string };
}

// ---------- Assembled report model (cra.md §7) ----------

export interface ReportModel {
  config: ReportConfig;
  live: {
    available: boolean; // false if securityPosture failed entirely
    companyName?: string;
    createdDateTime?: string;
    riskIndex: number | null;
    categoryLevels: { exposure: string; attack: string; securityConfiguration: string };
    coverageRate: number | null;
    cve: {
      count: number;
      mttpDays: number | null;
      averageUnpatchedDays: number;
      density: number;
      vulnerableEndpointRate: number;
      legacyOsEndpointCount: number;
    } | null;
    exposure: SecurityPosture['exposureStatus'] | null;
    securityConfig: SecurityPosture['securityConfigurationStatus'] | null;
    internetFacingCves: InternetFacingCve[];
    staleAccountCount: number | null;
    highRiskDevices: HighRiskDevice[];
    alerts: AlertSummary[];
  };
  // Per-section data availability, so the template can show "data unavailable" notices (§6.8).
  errors: Record<string, string>;
  generatedAt: string;
}
