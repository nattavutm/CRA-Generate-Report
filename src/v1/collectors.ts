// One collector per cra.md §5 row. Each returns a typed slice of ReportModel.live.
// Collectors throw on failure; the assembler decides how to degrade (§6.8).

import { V1Client, ListResponse } from './client';
import type {
  SecurityPosture,
  InternetFacingCve,
  DomainAccount,
  HighRiskDevice,
  HighRiskUser,
  PublicIpAsset,
  CloudAsset,
  AssetGroup,
  VulnerableDevice,
  RiskIndicatorEvent,
  GlobalFqdn,
  AlertSummary,
} from '../types';

export function getSecurityPosture(client: V1Client): Promise<SecurityPosture> {
  // Single call — feeds §01/03/04/05.
  return client.fetchJson<SecurityPosture>('/v3.0/asrm/securityPosture');
}

// ASRM list endpoints: skip server-side orderBy (it can trigger HTTP 400) and sort client-side.
function sortCves(items: InternetFacingCve[], top: number): InternetFacingCve[] {
  return items.slice().sort((a, b) => (b.cveRiskScore ?? 0) - (a.cveRiskScore ?? 0)).slice(0, top);
}

export async function getInternetFacingCves(client: V1Client, top = 50): Promise<InternetFacingCve[]> {
  const res = await client.fetchJson<ListResponse<InternetFacingCve>>('/v3.0/asrm/internetFacingAssetVulnerabilities', { query: { top } });
  return sortCves(res.items ?? [], top);
}

export async function getInternalCves(client: V1Client, top = 50): Promise<InternetFacingCve[]> {
  const res = await client.fetchJson<ListResponse<InternetFacingCve>>('/v3.0/asrm/internalAssetVulnerabilities', { query: { top } });
  return sortCves(res.items ?? [], top);
}

export function getDomainAccounts(client: V1Client, cap = 20): Promise<DomainAccount[]> {
  return client.paginate<DomainAccount>('/v3.0/asrm/attackSurfaceDomainAccounts', { query: { top: 200 } }, cap);
}

export async function getHighRiskDevices(client: V1Client, top = 20): Promise<HighRiskDevice[]> {
  const res = await client.fetchJson<ListResponse<HighRiskDevice>>('/v3.0/asrm/highRiskDevices', { query: { top } });
  return (res.items ?? []).slice().sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0)).slice(0, top);
}

export async function getHighRiskUsers(client: V1Client, top = 20): Promise<HighRiskUser[]> {
  const res = await client.fetchJson<ListResponse<HighRiskUser>>('/v3.0/asrm/highRiskUsers', { query: { top } });
  return (res.items ?? []).slice().sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0)).slice(0, top);
}

export async function getPublicIpAddresses(client: V1Client, top = 20): Promise<PublicIpAsset[]> {
  const res = await client.fetchJson<ListResponse<PublicIpAsset>>('/v3.0/asrm/attackSurfacePublicIpAddresses', { query: { top } });
  return (res.items ?? []).slice().sort((a, b) => (b.latestRiskScore ?? 0) - (a.latestRiskScore ?? 0)).slice(0, top);
}

export async function getCloudAssets(client: V1Client, top = 20): Promise<CloudAsset[]> {
  const res = await client.fetchJson<ListResponse<CloudAsset>>('/v3.0/asrm/attackSurfaceCloudAssets', { query: { top } });
  return (res.items ?? []).slice().sort((a, b) => (b.latestRiskScore ?? 0) - (a.latestRiskScore ?? 0)).slice(0, top);
}

export async function getAssetGroups(client: V1Client, top = 20): Promise<AssetGroup[]> {
  const res = await client.fetchJson<ListResponse<AssetGroup>>('/v3.0/asrm/assetGroups', { query: { top } });
  return (res.items ?? []).slice().sort((a, b) => (b.riskIndex ?? 0) - (a.riskIndex ?? 0)).slice(0, top);
}

interface RawVulnDevice {
  id: string;
  deviceName: string;
  criticality?: string;
  cveRecords?: unknown[];
  ip?: string[];
  lastScannedDateTime?: string;
}
export async function getVulnerableDevices(client: V1Client, top = 20): Promise<VulnerableDevice[]> {
  const res = await client.fetchJson<ListResponse<RawVulnDevice>>('/v3.0/asrm/vulnerableDevices', { query: { top } });
  return (res.items ?? [])
    .map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      criticality: d.criticality,
      cveCount: Array.isArray(d.cveRecords) ? d.cveRecords.length : 0,
      ip: d.ip,
      lastScannedDateTime: d.lastScannedDateTime,
    }))
    .sort((a, b) => b.cveCount - a.cveCount)
    .slice(0, top);
}

interface RawRiskEvent {
  id: string;
  name: string;
  riskLevel?: string;
  assetName?: string;
  assetType?: string;
  detectedDateTime?: string;
}
// Merge account-compromise + anomaly indicator events into one Top-N feed.
export async function getRiskIndicatorEvents(client: V1Client, top = 10): Promise<RiskIndicatorEvent[]> {
  const map: Array<[string, RiskIndicatorEvent['kind']]> = [
    ['/v3.0/asrm/accountCompromiseRiskIndicatorEvents', 'Account compromise'],
    ['/v3.0/asrm/anomalyDetectionRiskIndicatorEvents', 'Anomaly'],
  ];
  const batches = await Promise.all(
    map.map(async ([path, kind]) => {
      const res = await client.fetchJson<ListResponse<RawRiskEvent>>(path, { query: { top: 50 } }).catch(() => ({ items: [] }) as ListResponse<RawRiskEvent>);
      return (res.items ?? []).map((e) => ({ ...e, kind }));
    }),
  );
  return batches
    .flat()
    .sort((a, b) => Date.parse(b.detectedDateTime ?? '') - Date.parse(a.detectedDateTime ?? ''))
    .slice(0, top);
}

export async function getGlobalFqdns(client: V1Client, top = 20): Promise<GlobalFqdn[]> {
  const res = await client.fetchJson<ListResponse<GlobalFqdn>>('/v3.0/asrm/attackSurfaceGlobalFqdns', { query: { top } });
  return (res.items ?? []).slice().sort((a, b) => (b.latestRiskScore ?? 0) - (a.latestRiskScore ?? 0)).slice(0, top);
}

// workbench/alerts items are polymorphic (oneOf SAE/TI) — read fields defensively (cra.md §5 gotcha).
interface RawAlert {
  model?: string;
  description?: string;
  severity?: string;
  score?: number;
  createdDateTime?: string;
  impactScope?: {
    entities?: Array<{ entityType?: string; entityValue?: unknown }>;
    desktopCount?: number;
    serverCount?: number;
    accountCount?: number;
  };
}

function entityLabel(scope: RawAlert['impactScope']): string {
  const first = scope?.entities?.[0];
  if (first?.entityValue) {
    const v = first.entityValue;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const name = o.name ?? o.fullName ?? o.value;
      if (typeof name === 'string') return name;
    }
  }
  // Fall back to an affected-asset summary.
  const counts: string[] = [];
  if (scope?.desktopCount) counts.push(`${scope.desktopCount} desktop(s)`);
  if (scope?.serverCount) counts.push(`${scope.serverCount} server(s)`);
  if (scope?.accountCount) counts.push(`${scope.accountCount} account(s)`);
  return counts.join(', ') || '—';
}

// Trend v3 requires ISO 8601 WITHOUT milliseconds (e.g. 2026-05-26T15:00:00Z);
// a `.000Z` fraction triggers HTTP 400 "not properly formatted" (error 3090003).
function isoNoMillis(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? s : new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export async function getWorkbenchAlerts(
  client: V1Client,
  range: { startDateTime?: string; endDateTime?: string },
  top = 50,
): Promise<AlertSummary[]> {
  // No server-side orderBy (the param is finicky); sort by severity score client-side.
  const res = await client.fetchJson<ListResponse<RawAlert>>('/v3.0/workbench/alerts', {
    query: { startDateTime: isoNoMillis(range.startDateTime), endDateTime: isoNoMillis(range.endDateTime) },
  });
  return (res.items ?? [])
    .map((a) => ({
      name: a.model ?? a.description ?? 'Unknown detection',
      severity: a.severity ?? 'unknown',
      score: a.score,
      entity: entityLabel(a.impactScope),
      time: a.createdDateTime ?? '',
    }))
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    .slice(0, top);
}
