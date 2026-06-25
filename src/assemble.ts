// P3 — pull live data in parallel; a single failure degrades that slice, not the whole report (§6.8).
// The report's data sections render straight from this live pull (not from form text).

import { V1Client } from './v1/client';
import {
  getSecurityPosture,
  getInternetFacingCves,
  getInternalCves,
  getDomainAccounts,
  getHighRiskDevices,
  getHighRiskUsers,
  getPublicIpAddresses,
  getCloudAssets,
  getAssetGroups,
  getVulnerableDevices,
  getRiskIndicatorEvents,
  getGlobalFqdns,
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

  const [posture, cves, internalCves, accounts, devices, users, publicIps, cloudAssets, assetGroups, vulnDevices, riskEvents2, fqdns, alerts] =
    await Promise.all([
      getSecurityPosture(client).catch(fail('securityPosture')),
      getInternetFacingCves(client, 50).catch((e) => (fail('internetFacingCves')(e), [])),
      getInternalCves(client, 50).catch((e) => (fail('internalCves')(e), [])),
      getDomainAccounts(client, 20).catch(fail('domainAccounts')),
      getHighRiskDevices(client, 20).catch((e) => (fail('highRiskDevices')(e), [])),
      getHighRiskUsers(client, 20).catch((e) => (fail('highRiskUsers')(e), [])),
      getPublicIpAddresses(client, 20).catch((e) => (fail('publicIps')(e), [])),
      getCloudAssets(client, 20).catch((e) => (fail('cloudAssets')(e), [])),
      getAssetGroups(client, 20).catch((e) => (fail('assetGroups')(e), [])),
      getVulnerableDevices(client, 20).catch((e) => (fail('vulnerableDevices')(e), [])),
      getRiskIndicatorEvents(client, 10).catch((e) => (fail('riskIndicatorEvents')(e), [])),
      getGlobalFqdns(client, 20).catch((e) => (fail('globalFqdns')(e), [])),
      getWorkbenchAlerts(client, config.workbench ?? {}, 50).catch((e) => (fail('alerts')(e), [])),
    ]);

  const topAccounts = (accounts ?? [])
    .slice()
    .sort((a, b) => (b.latestRiskScore ?? 0) - (a.latestRiskScore ?? 0))
    .slice(0, 5);

  const cutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000;
  const staleAccountCount = accounts
    ? accounts.filter((a) => {
        const t = a.lastDetectedDateTime ? Date.parse(a.lastDetectedDateTime) : NaN;
        return Number.isFinite(t) && t < cutoff;
      }).length
    : null;

  const ex = posture?.exposureStatus;
  const sc = posture?.securityConfigurationStatus;

  // Flatten agent feature-adoption across all platform groups; keep the worst rate per feature.
  const featureAdoption: Array<{ feature: string; adoptionRate: number }> = [];
  const featSeen = new Map<string, number>();
  for (const group of Object.values(sc?.endpointAgentStatus.agentFeatureStatus ?? {})) {
    for (const f of group ?? []) {
      const prev = featSeen.get(f.feature);
      if (prev === undefined || f.adoptionRate < prev) featSeen.set(f.feature, f.adoptionRate);
    }
  }
  for (const [feature, adoptionRate] of featSeen) featureAdoption.push({ feature, adoptionRate });
  featureAdoption.sort((a, b) => a.adoptionRate - b.adoptionRate); // worst adoption first

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
    riskEvents: posture?.highImpactRiskEvents ?? [],
    exposure: ex
      ? {
          weakAuthenticationCount: ex.domainAccountMisconfigurationStatus.weakAuthenticationCount,
          excessivePrivilegeCount: ex.domainAccountMisconfigurationStatus.excessivePrivilegeCount,
          increaseAttackSurfaceRiskCount: ex.domainAccountMisconfigurationStatus.increaseAttackSurfaceRiskCount,
          insecureHostCount: ex.insecureHostConnectionStatus.insecureHostCount,
          connectionIssueCount: ex.insecureHostConnectionStatus.connectionIssueCount,
          servicePortCount: ex.unexpectedInternetFacingInterfaceStatus.servicePortCount,
          publicIpCount: ex.unexpectedInternetFacingInterfaceStatus.publicIpCount,
          cloudHighRiskCount: ex.cloudAssetMisconfigurationStatus?.highRiskCount ?? null,
          cloudMediumRiskCount: ex.cloudAssetMisconfigurationStatus?.mediumRiskCount ?? null,
          accountCompromiseEventCount: ex.domainAccountCompromiseEventCount ?? null,
          legacyAuthProtocolCount: ex.legacyAuthenticationProtocolCount ?? null,
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
          emailExchangeEnabled: sc.emailSensorStatus?.exchange.enabledMailboxCount ?? null,
          emailExchangeTotal: sc.emailSensorStatus?.exchange.totalMailboxCount ?? null,
          emailGmailEnabled: sc.emailSensorStatus?.gmail.enabledMailboxCount ?? null,
          emailGmailTotal: sc.emailSensorStatus?.gmail.totalMailboxCount ?? null,
          sanctionedAppCount: sc.cloudAppsStatus?.sanctionedAppCount ?? null,
          unsanctionedAppCount: sc.cloudAppsStatus?.unsanctionedAppCount ?? null,
          featureAdoption,
        }
      : null,
    internetFacingCves: cves ?? [],
    internalCves: internalCves ?? [],
    topAccounts,
    publicIps: publicIps ?? [],
    cloudAssets: cloudAssets ?? [],
    assetGroups: assetGroups ?? [],
    vulnerableDevices: vulnDevices ?? [],
    riskIndicatorEvents: riskEvents2 ?? [],
    globalFqdns: fqdns ?? [],
    highRiskDevices: devices ?? [],
    highRiskUsers: users ?? [],
    staleAccountCount,
    alerts: alerts ?? [],
    errors,
  };

  return { config, live, generatedAt: new Date(now).toISOString() };
}
