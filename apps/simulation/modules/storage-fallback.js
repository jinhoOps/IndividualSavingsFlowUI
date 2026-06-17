import { utils } from "./utils.js";

export const STEP2_FALLBACK_STORAGE_KEY = "isf-step2-simulations-fallback-v1";

let fallbackMode = false;

function now() {
  return Date.now();
}

function readFallbackEntries() {
  try {
    const raw = localStorage.getItem(STEP2_FALLBACK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeStep2Entry).filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
}

function writeFallbackEntries(entries) {
  localStorage.setItem(STEP2_FALLBACK_STORAGE_KEY, JSON.stringify(entries));
}

function getStrategyLabel(entry) {
  const sim = entry?.dividendSim || {};
  return sim.presetName || sim.strategyName || sim.strategyKey || sim.selectedBenchmark || "배당 시뮬레이션";
}

function buildDisplayName(entry) {
  if (entry.name) return String(entry.name);
  const timestamp = new Date(entry.updatedAt || now()).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const years = Number(entry.dividendSim?.years || 10);
  return `${getStrategyLabel(entry)} · ${years}년 · ${timestamp}`;
}

export function normalizeStep2Entry(data = {}) {
  if (!data || typeof data !== "object") return null;
  const updatedAt = Number(data.updatedAt) || now();
  const dividendSim = {
    yield: Number(data.dividendSim?.yield ?? 3.5),
    growth: Number(data.dividendSim?.growth ?? 5.0),
    capitalGrowth: Number(data.dividendSim?.capitalGrowth ?? 4.0),
    years: Number(data.dividendSim?.years ?? 10),
    isDrip: data.dividendSim?.isDrip !== false,
    presetName: data.dividendSim?.presetName || "",
    selectedBenchmark: data.dividendSim?.selectedBenchmark || "",
    strategyKey: data.dividendSim?.strategyKey || "",
    strategyName: data.dividendSim?.strategyName || "",
    coveredCallExample: data.dividendSim?.coveredCallExample || "",
  };
  const entry = {
    ...data,
    id: data.id || utils.createId("ds"),
    modelVersion: Number(data.modelVersion) || 10,
    updatedAt,
    totalInitialAsset: utils.toWon(data.totalInitialAsset),
    totalMonthlyInvestCapacity: utils.toWon(data.totalMonthlyInvestCapacity),
    dividendSim,
  };
  entry.name = buildDisplayName(entry);
  return entry;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function activateFallback(error) {
  fallbackMode = true;
  console.warn("Step2Storage: IndexedDB bridge failed; using LocalStorage fallback.", error);
}

export function isStep2FallbackActive() {
  return fallbackMode;
}

export async function saveStep2Simulation(data) {
  const entry = normalizeStep2Entry({
    ...data,
    updatedAt: now(),
  });
  if (!entry) throw new Error("INVALID_STEP2_ENTRY");

  if (!fallbackMode && window.IsfStorageHub?.saveStep2Entry) {
    try {
      return normalizeStep2Entry(await window.IsfStorageHub.saveStep2Entry(entry) || entry);
    } catch (error) {
      activateFallback(error);
    }
  }

  const entries = readFallbackEntries();
  const index = entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) entries[index] = entry;
  else entries.unshift(entry);
  const sorted = sortEntries(entries);
  writeFallbackEntries(sorted);
  return entry;
}

export async function listStep2Simulations() {
  if (!fallbackMode && window.IsfStorageHub?.listStep2Entries) {
    try {
      return sortEntries((await window.IsfStorageHub.listStep2Entries() || []).map(normalizeStep2Entry).filter(Boolean));
    } catch (error) {
      activateFallback(error);
    }
  }
  return sortEntries(readFallbackEntries());
}

export async function getStep2SimulationById(id) {
  if (!id) return null;
  if (!fallbackMode && window.IsfStorageHub?.getStep2EntryById) {
    try {
      return normalizeStep2Entry(await window.IsfStorageHub.getStep2EntryById(id));
    } catch (error) {
      activateFallback(error);
    }
  }
  return readFallbackEntries().find((entry) => entry.id === id) || null;
}

export async function deleteStep2Simulation(id) {
  if (!id) return false;
  if (!fallbackMode && window.IsfStorageHub?.deleteStep2Entry) {
    try {
      await window.IsfStorageHub.deleteStep2Entry(id);
      return true;
    } catch (error) {
      activateFallback(error);
    }
  }
  const nextEntries = readFallbackEntries().filter((entry) => entry.id !== id);
  writeFallbackEntries(nextEntries);
  return true;
}
