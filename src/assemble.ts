// P3 — pull live data in parallel; a single failure degrades that slice, not the whole report (§6.8).
// The report's data sections render straight from this live pull (not from form text).

import { V1Client } from './v1/client';
import {
  getSecurityPosture,
  getInternetFacingCves,
  getDomainAccounts,
  getHighRiskDevices,
  getWorkbenchAlerts,
} from './v1/collectors';
import type { ReportConfig, ReportModel, LiveData } from './types';

const STALE_DAYS = 180; // §13: accounts inactive > 180 days

export async function assembleModel(client: V1Client, config: ReportConfig): Promise<ReportModel> {
  const now = Date.now();
  const errors: Record<string, string> = {};
  const fail = (key: string) => (e: unknown) => {
    errors[key] = e instanceof Error ? e.message : String(e);
    return null;
  };

  const [posture, cves, accounts, devices, alerts] = await Promise.all([
    getSecurityPosture(client).catch(fail('securityPosture')),
    getInternetFacingCves(client, 50).catch(() => {
      errors.internetFacingCves = 'unavailable';
      return [];
    }),
    getDomainAccounts(client, 20).catch(fail('domainAccounts')),
    getHighRiskDevices(client, 20).catch(() => []),
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

  const ex = posture?.exposureStatus;
  const sc = posture?.securityConfigurationStatus;

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
          density: posture.cveManagementMetrics.density,
          vulnerableEndpointRate: posture.cveManagementMetrics.vulnerableEndpointRate,
          legacyOsEndpointCount: posture.cveManagementMetrics.legacyOsEndpointCount,
        }
      : null,
    exposure: ex
      ? {
          weakAuthenticationCount: ex.domainAccountMisconfigurationStatus.weakAuthenticationCount,
          excessivePrivilegeCount: ex.domainAccountMisconfigurationStatus.excessivePrivilegeCount,
          increaseAttackSurfaceRiskCount: ex.domainAccountMisconfigurationStatus.increaseAttackSurfaceRiskCount,
          insecureHostCount: ex.insecureHostConnectionStatus.insecureHostCount,
          connectionIssueCount: ex.insecureHostConnectionStatus.connectionIssueCount,
          servicePortCount: ex.unexpectedInternetFacingInterfaceStatus.servicePortCount,
          publicIpCount: ex.unexpectedInternetFacingInterfaceStatus.publicIpCount,
        }
      : null,
    securityConfig: sc
      ? {
          agentAdoptionCount: sc.endpointAgentStatus.agentAdoptionCount,
          latestCount: sc.endpointAgentStatus.agentVersionStatus.latestCount,
          outdatedCount: sc.endpointAgentStatus.agentVersionStatus.outdatedCount,
          otherCount: sc.endpointAgentStatus.agentVersionStatus.otherCount,
          edrFeatureAdoptionCount: sc.endpointAgentStatus.edrFeatureAdoptionCount,
          virtualPatched: sc.virtualPatchingStatus.patchedCount,
          virtualPartial: sc.virtualPatchingStatus.partialPatchedCount,
          virtualNot: sc.virtualPatchingStatus.notPatchedCount,
        }
      : null,
    internetFacingCves: cves ?? [],
    highRiskDevices: devices ?? [],
    staleAccountCount,
    alerts: alerts ?? [],
    errors,
  };

  return { config, live, generatedAt: new Date(now).toISOString() };
}
