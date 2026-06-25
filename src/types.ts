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
  highImpactRiskEvents?: Array<{ factor: string; eventCount: number; affectedAssetCount: number }>;
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
    cloudAssetMisconfigurationStatus?: { highRiskCount: number; mediumRiskCount: number };
    unexpectedInternetFacingInterfaceStatus: { servicePortCount: number; publicIpCount: number };
    insecureHostConnectionStatus: { insecureHostCount: number; connectionIssueCount: number };
    domainAccountMisconfigurationStatus: {
      weakAuthenticationCount: number;
      increaseAttackSurfaceRiskCount: number;
      excessivePrivilegeCount: number;
    };
    domainAccountCompromiseEventCount?: number;
    legacyAuthenticationProtocolCount?: number;
  };
  securityConfigurationStatus: {
    endpointAgentStatus: {
      agentAdoptionCount: number;
      agentVersionStatus: { outdatedCount: number; otherCount: number; latestCount: number };
      edrFeatureAdoptionCount: number;
      agentFeatureStatus?: Record<string, Array<{ feature: string; adoptionRate: number }>>;
    };
    virtualPatchingStatus: { patchedCount: number; partialPatchedCount: number; notPatchedCount: number };
    emailSensorStatus?: {
      exchange: { enabledMailboxCount: number; totalMailboxCount: number };
      gmail: { enabledMailboxCount: number; totalMailboxCount: number };
    };
    cloudAppsStatus?: { sanctionedAppCount: number; unsanctionedAppCount: number };
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

export interface HighRiskUser {
  id: string;
  userName: string;
  userPrincipalName?: string;
  riskScore: number;
}

export interface AlertSummary {
  name: string;
  severity: string;
  score?: number;
  entity: string;
  time: string;
}

// Live data slice — the report's data sections render straight from this (pulled from the API).
export interface LiveData {
  available: boolean;
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
  riskEvents: Array<{ factor: string; eventCount: number; affectedAssetCount: number }>;
  exposure: {
    weakAuthenticationCount: number;
    excessivePrivilegeCount: number;
    increaseAttackSurfaceRiskCount: number;
    insecureHostCount: number;
    connectionIssueCount: number;
    servicePortCount: number;
    publicIpCount: number;
    cloudHighRiskCount: number | null;
    cloudMediumRiskCount: number | null;
    accountCompromiseEventCount: number | null;
    legacyAuthProtocolCount: number | null;
  } | null;
  securityConfig: {
    agentAdoptionCount: number;
    latestCount: number;
    outdatedCount: number;
    otherCount: number;
    edrFeatureAdoptionCount: number;
    virtualPatched: number;
    virtualPartial: number;
    virtualNot: number;
    emailExchangeEnabled: number | null;
    emailExchangeTotal: number | null;
    emailGmailEnabled: number | null;
    emailGmailTotal: number | null;
    sanctionedAppCount: number | null;
    unsanctionedAppCount: number | null;
    featureAdoption: Array<{ feature: string; adoptionRate: number }>; // flattened, worst-first
  } | null;
  internetFacingCves: InternetFacingCve[];
  internalCves: InternetFacingCve[];
  topAccounts: DomainAccount[];
  highRiskDevices: HighRiskDevice[];
  highRiskUsers: HighRiskUser[];
  staleAccountCount: number | null;
  alerts: AlertSummary[];
  errors: Record<string, string>;
}

// ---------- Form input (cra.md §7) — only what has no API source ----------

export type SessionStatus = 'Completed' | 'Upcoming';

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

  // Optional human commentary — never replaces the live data, only adds context.
  executiveSummary?: string;
  whatChanged?: string[];

  // §03 Risk Index — current snapshot only (the API returns no history).
  riskIndexNote?: string;

  // §07 Recommendations — optional manual override; otherwise derived from live data.
  recommendations?: Finding[];

  // §08 cadence — engagement logistics, no API source.
  sessions: Session[];

  dataSourceNotes?: string;
  workbench?: { startDateTime?: string; endDateTime?: string };
}

export interface ReportModel {
  config: ReportConfig;
  live: LiveData;
  generatedAt: string;
}
