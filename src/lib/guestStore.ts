// Client-only localStorage store for guest (unauthenticated) users.
// Keys are namespaced under "dirham:guest:" to avoid collisions.
// All functions are SSR-safe: they no-op on the server.

export interface GuestTransaction {
  id: string;
  clientId: string;
  type: "expense" | "income";
  amountMinor: number;
  currency: string;
  rateToBase: number;
  category: string;
  note: string;
  receiptUrl: null;
  isVatable: boolean;
  vatRate: number;
  occurredAt: string; // ISO string
}

export interface GuestBudget {
  id: string;
  clientId: string;
  category: string;
  limitMinorBase: number;
  warnAtPercent: number;
}

export interface GuestMeta {
  startedAt: string; // ISO string
  dismissed14Modal: boolean;
}

const META_KEY = "dirham:guest:meta";
const TX_KEY = "dirham:guest:transactions";
const BU_KEY = "dirham:guest:budgets";

const TRIAL_DAYS = 14;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readMeta(): GuestMeta {
  if (!isBrowser()) return { startedAt: new Date().toISOString(), dismissed14Modal: false };
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as GuestMeta;
  } catch {}
  return { startedAt: new Date().toISOString(), dismissed14Modal: false };
}

function writeMeta(meta: GuestMeta): void {
  if (!isBrowser()) return;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/** Initialises guest meta on first visit. Returns current meta. */
export function initGuest(): GuestMeta {
  if (!isBrowser()) return { startedAt: new Date().toISOString(), dismissed14Modal: false };
  const existing = localStorage.getItem(META_KEY);
  if (existing) {
    try { return JSON.parse(existing) as GuestMeta; } catch {}
  }
  const meta: GuestMeta = { startedAt: new Date().toISOString(), dismissed14Modal: false };
  writeMeta(meta);
  return meta;
}

export function getTrialDaysElapsed(): number {
  const meta = readMeta();
  const started = new Date(meta.startedAt).getTime();
  return Math.floor((Date.now() - started) / (1000 * 60 * 60 * 24));
}

export function getDaysRemaining(): number {
  return Math.max(0, TRIAL_DAYS - getTrialDaysElapsed());
}

/** Day 0 = welcome, days 1-9 = active, days 10-13 = warning, day 14+ = expired. */
export function getTrialPhase(): "welcome" | "active" | "warning" | "expired" {
  const days = getTrialDaysElapsed();
  if (days === 0) return "welcome";
  if (days < 10) return "active";
  if (days < TRIAL_DAYS) return "warning";
  return "expired";
}

export function dismissModal(): void {
  const meta = readMeta();
  meta.dismissed14Modal = true;
  writeMeta(meta);
}

export function isModalDismissed(): boolean {
  return readMeta().dismissed14Modal;
}

export function getTransactions(): GuestTransaction[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (raw) return JSON.parse(raw) as GuestTransaction[];
  } catch {}
  return [];
}

function writeTransactions(txs: GuestTransaction[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(TX_KEY, JSON.stringify(txs));
}

export function addTransaction(
  tx: Omit<GuestTransaction, "id" | "clientId" | "receiptUrl">,
): GuestTransaction {
  const id = crypto.randomUUID();
  const full: GuestTransaction = { ...tx, id, clientId: id, receiptUrl: null };
  writeTransactions([full, ...getTransactions()]);
  return full;
}

export function updateTransaction(
  id: string,
  updates: Partial<Omit<GuestTransaction, "id" | "clientId" | "receiptUrl">>,
): void {
  writeTransactions(
    getTransactions().map((tx) => (tx.id === id ? { ...tx, ...updates } : tx)),
  );
}

export function deleteTransaction(id: string): void {
  writeTransactions(getTransactions().filter((tx) => tx.id !== id));
}

export function getBudgets(): GuestBudget[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(BU_KEY);
    if (raw) return JSON.parse(raw) as GuestBudget[];
  } catch {}
  return [];
}

/** Removes all guest localStorage keys. Call after successful migration. */
export function clearGuestData(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(META_KEY);
  localStorage.removeItem(TX_KEY);
  localStorage.removeItem(BU_KEY);
}

/** True if the guest has any stored data (used to decide whether to run migration). */
export function hasGuestData(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(META_KEY) !== null || getTransactions().length > 0;
}
