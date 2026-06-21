import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type HermesFallbackState = {
  status: string;
  fallbackActive: boolean;
  activeProvider: string;
  activeModel: string;
  generatedAt?: string;
  lastEventType?: string;
  lastEventAt?: string;
  lastEventSource?: string;
  eventCount?: number;
  fallbackEventCount?: number;
  recentFallbackEventCount?: number;
  recentWindowHours?: number;
  containsSecrets?: boolean;
  safety?: { containsSecrets?: boolean; containsMessageContent?: boolean; redacted?: boolean };
};

export function euro(value: number) { return `${value.toFixed(4)} €`; }
export function integer(value: number) { return Math.round(value).toLocaleString("fr-FR"); }

export function readHermesFallbackState(baseDir = process.cwd()): HermesFallbackState {
  const fallbackPath = join(baseDir, "public", "hermes-fallback-state.json");
  if (!existsSync(fallbackPath)) return { status: "missing", fallbackActive: false, activeProvider: "non disponible", activeModel: "non disponible" };
  try {
    const parsed = JSON.parse(readFileSync(fallbackPath, "utf8"));
    return {
      status: typeof parsed.status === "string" ? parsed.status : "unknown",
      fallbackActive: Boolean(parsed.fallbackActive),
      activeProvider: typeof parsed.activeProvider === "string" ? parsed.activeProvider : "non disponible",
      activeModel: typeof parsed.activeModel === "string" ? parsed.activeModel : "non disponible",
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
      lastEventType: typeof parsed.lastEventType === "string" ? parsed.lastEventType : undefined,
      lastEventAt: typeof parsed.lastEventAt === "string" ? parsed.lastEventAt : undefined,
      lastEventSource: typeof parsed.lastEventSource === "string" ? parsed.lastEventSource : undefined,
      eventCount: typeof parsed.eventCount === "number" ? parsed.eventCount : undefined,
      fallbackEventCount: typeof parsed.fallbackEventCount === "number" ? parsed.fallbackEventCount : undefined,
      recentFallbackEventCount: typeof parsed.recentFallbackEventCount === "number" ? parsed.recentFallbackEventCount : undefined,
      recentWindowHours: typeof parsed.recentWindowHours === "number" ? parsed.recentWindowHours : undefined,
      containsSecrets: Boolean(parsed.containsSecrets),
      safety: typeof parsed.safety === "object" && parsed.safety ? parsed.safety : undefined,
    };
  } catch {
    return { status: "invalid", fallbackActive: false, activeProvider: "non disponible", activeModel: "non disponible" };
  }
}

export function fallbackFreshness(generatedAt?: string, nowMs = Date.now()) {
  if (!generatedAt) return { label: "inconnue", stale: true };
  const ageSeconds = Math.max(0, Math.round((nowMs - Date.parse(generatedAt)) / 1000));
  if (!Number.isFinite(ageSeconds)) return { label: "inconnue", stale: true };
  if (ageSeconds < 60) return { label: `${ageSeconds}s`, stale: false };
  const minutes = Math.round(ageSeconds / 60);
  return { label: `${minutes}min`, stale: ageSeconds > 90 };
}

export function buildDashboardSectionSummary(data: any, fallback: HermesFallbackState) {
  const agents = Array.isArray(data.projectAiSetups) ? data.projectAiSetups : [];
  const accounts = Array.isArray(data.aiAccounts) ? data.aiAccounts : [];
  const usageEntries = Array.isArray(data.usageEntries) ? data.usageEntries : [];
  const recentFallback = fallback.recentFallbackEventCount ?? 0;
  const freshness = fallbackFreshness(fallback.generatedAt);
  return {
    projects: {
      total: data.projects?.length ?? 0,
      selected: data.selectedProject?.name ?? "Aucun projet",
      usageTokens: data.projectUsage?.tokens ?? 0,
      usageCost: data.projectUsage?.cost ?? 0,
      subscriptionMonthly: data.projectUsage?.subscriptionMonthly ?? 0,
    },
    agents: {
      totalAccounts: accounts.length,
      totalSetups: agents.length,
      apiSetups: agents.filter((a: any) => a.connectionType === "api").length,
      subscriptionSetups: agents.filter((a: any) => a.connectionType === "subscription").length,
      localSetups: agents.filter((a: any) => a.connectionType === "local").length,
    },
    consumption: {
      totalTokens: data.usage?.tokens ?? 0,
      totalCost: data.usage?.cost ?? 0,
      selectedProjectTokens: data.projectUsage?.tokens ?? 0,
      selectedProjectCost: data.projectUsage?.cost ?? 0,
      entryCount: data.totalUsageEntries ?? usageEntries.length,
    },
    logs: {
      usageEntries: usageEntries.length,
      totalUsageEntries: data.totalUsageEntries ?? usageEntries.length,
      fallbackEvents: fallback.fallbackEventCount ?? 0,
      recentFallbackEvents: recentFallback,
      lastEventType: fallback.lastEventType ?? "non disponible",
    },
    alerts: {
      recentFallback,
      fallbackWindowHours: fallback.recentWindowHours ?? 24,
      fallbackFrequent: recentFallback > 10,
      staleFallbackJson: freshness.stale,
      containsSecrets: Boolean(fallback.containsSecrets || fallback.safety?.containsSecrets),
      freshnessLabel: freshness.label,
    },
  };
}
