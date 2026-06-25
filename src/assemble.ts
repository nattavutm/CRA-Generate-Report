// P3 — pull live data in parallel; a single failure degrades that slice, not the whole report (§6.8).
// Live numbers pre-fill editorial defaults and the trend table's latest column.

import { V1Client } from './v1/client';
import { getSecurityPosture, getDomainAccounts, getWorkbenchAlerts } from './v1/collectors';
import type { ReportConfig, ReportModel, LiveData } from './types';

const STALE_DAYS = 180; // §13: accounts inactive > 180 days

export async function assembleModel(client: V1Client, config: ReportConfig): Promise<ReportModel> {
  const now = Date.now();
  const errors: Record<string, string> = {};
  const fail = (key: string) => (e: unknown) => {
    errors[key] = e instanceof Error ? e.message : String(e);
    return null;
  };

  const [posture, accounts, alerts] = await Promise.all([
    getSecurityPosture(client).catch(fail('securityPosture')),
    getDomainAccounts(client, 20).catch(fail('domainAccounts')),
    getWorkbenchAlerts(client, config.workbench ?? {}, 50).catch(() => {
      errors.alerts = 'unavailable';
      return [];
    }),
  ]);

  const cutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000;
  const staleAccountCount = accounts
    ? accounts.filter((a) => {
        const t = a.lastDetectedDateTime ? Date.parse(a.lastDetectedDateTime) : NaN;
        return Number.isFinite(t) && t < cutoff;
      }).length
    : null;

  const live: LiveData = {
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
          legacyOsEndpointCount: posture.cveManagementMetrics.legacyOsEndpointCount,
        }
      : null,
    staleAccountCount,
    alerts: alerts ?? [],
    errors,
  };

  return { config, live, generatedAt: new Date(now).toISOString() };
}
