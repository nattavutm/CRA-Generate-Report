// P3 — merge live API data + form config + editorial text into ReportModel.
// Runs all collectors in parallel; a single failure degrades that section, not the whole report (§6.8).

import { V1Client } from './v1/client';
import {
  getSecurityPosture,
  getInternetFacingCves,
  getDomainAccounts,
  getHighRiskDevices,
  getWorkbenchAlerts,
} from './v1/collectors';
import type { ReportConfig, ReportModel } from './types';

const STALE_DAYS = 180; // §13: accounts inactive > 180 days

function countStaleAccounts(accounts: Awaited<ReturnType<typeof getDomainAccounts>>, now: number): number {
  const cutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000;
  return accounts.filter((a) => {
    if (!a.lastDetectedDateTime) return false;
    const t = Date.parse(a.lastDetectedDateTime);
    return Number.isFinite(t) && t < cutoff;
  }).length;
}

export async function assembleModel(client: V1Client, config: ReportConfig): Promise<ReportModel> {
  const now = Date.now();
  const errors: Record<string, string> = {};

  const [posture, cves, accounts, devices, alerts] = await Promise.all([
    getSecurityPosture(client).catch((e) => {
      errors.securityPosture = String(e instanceof Error ? e.message : e);
      return null;
    }),
    getInternetFacingCves(client, 50).catch((e) => {
      errors.internetFacingCves = String(e instanceof Error ? e.message : e);
      return [];
    }),
    getDomainAccounts(client, 20).catch((e) => {
      errors.domainAccounts = String(e instanceof Error ? e.message : e);
      return null;
    }),
    getHighRiskDevices(client, 20).catch((e) => {
      errors.highRiskDevices = String(e instanceof Error ? e.message : e);
      return [];
    }),
    getWorkbenchAlerts(client, config.workbench ?? {}, 50).catch((e) => {
      errors.alerts = String(e instanceof Error ? e.message : e);
      return [];
    }),
  ]);

  const live: ReportModel['live'] = {
    available: posture !== null,
    companyName: posture?.companyName,
    createdDateTime: posture?.createdDateTime,
    riskIndex: posture?.riskIndex ?? null,
    categoryLevels: {
      exposure: posture?.riskCategoryLevel.exposure ?? '—',
      attack: posture?.riskCategoryLevel.attack ?? '—',
      securityConfiguration: posture?.riskCategoryLevel.securityConfiguration ?? '—',
    },
    coverageRate: posture?.vulnerabilityAssessmentCoverageRate ?? null,
    cve: posture
      ? {
          count: posture.cveManagementMetrics.count,
          mttpDays: posture.cveManagementMetrics.mttpDays ?? null,
          averageUnpatchedDays: posture.cveManagementMetrics.averageUnpatchedDays,
          density: posture.cveManagementMetrics.density,
          vulnerableEndpointRate: posture.cveManagementMetrics.vulnerableEndpointRate,
          legacyOsEndpointCount: posture.cveManagementMetrics.legacyOsEndpointCount,
        }
      : null,
    exposure: posture?.exposureStatus ?? null,
    securityConfig: posture?.securityConfigurationStatus ?? null,
    internetFacingCves: cves,
    staleAccountCount: accounts ? countStaleAccounts(accounts, now) : null,
    highRiskDevices: devices,
    alerts,
  };

  return {
    config,
    live,
    errors,
    generatedAt: new Date(now).toISOString(),
  };
}
