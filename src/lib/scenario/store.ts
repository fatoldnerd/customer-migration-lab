'use client';

import { useSyncExternalStore } from 'react';
import type { CustomerScenario, UnitPrice, UsageAssumptions, ValidationRun } from '@/lib/types';
import { defaultPrices, defaultUsage } from '@/lib/cost/model';

/** Fictional starting point for Heritage House (all values are assumptions). */
export const defaultScenario: CustomerScenario = {
  dailyAnalyses: 8_000,
  typicalImageMB: 1.2,
  geography: 'emea',
  visibility: 'private',
  priority: 'balanced',
};

export interface LabState {
  scenario: CustomerScenario;
  /** Scenario before the most recent edit, used to explain what changed. */
  previousScenario: CustomerScenario | null;
  prices: UnitPrice[];
  usage: UsageAssumptions;
  runs: ValidationRun[];
}

const KEY = 'cmdl-state-v1';
const initial: LabState = { scenario: defaultScenario, previousScenario: null, prices: defaultPrices, usage: defaultUsage, runs: [] };

let state: LabState = initial;
let loaded = false;
const listeners = new Set<() => void>();

// Browser storage is a per-viewer convenience only; every access is guarded.
function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<LabState>;
      state = {
        ...initial,
        ...saved,
        scenario: { ...defaultScenario, ...saved.scenario },
        prices: defaultPrices.map((p) => ({ ...p, ...saved.prices?.find((s) => s.id === p.id) })),
      };
    }
  } catch {
    /* storage unavailable: keep defaults */
  }
}

function set(next: LabState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const actions = {
  updateScenario(patch: Partial<CustomerScenario>) {
    set({ ...state, previousScenario: state.scenario, scenario: { ...state.scenario, ...patch } });
  },
  resetScenario() {
    set({ ...state, previousScenario: state.scenario, scenario: defaultScenario });
  },
  updatePrice(id: UnitPrice['id'], patch: Partial<UnitPrice>) {
    set({ ...state, prices: state.prices.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  },
  updateUsage(patch: Partial<UsageAssumptions>) {
    set({ ...state, usage: { ...state.usage, ...patch } });
  },
  addRun(run: ValidationRun) {
    set({ ...state, runs: [run, ...state.runs].slice(0, 5) });
  },
  clearRuns() {
    set({ ...state, runs: [] });
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  load();
  return state;
}
const getServerSnapshot = () => initial;

export function useLab() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
