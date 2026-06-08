// LocalStorage-backed data store for Property Manage portal.
import { useSyncExternalStore } from "react";

export type Role = "admin" | "partner";

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  partnerId?: string;
}

export interface Partner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface PropertyPartner {
  partnerId: string;
  percent: number;
}

// A rentable unit inside a property (floor + unit breakdown)
export interface Unit {
  id: string;
  floor: string;            // e.g. "GF", "1/F", "2/F"
  label: string;            // e.g. "Shop A", "Flat 101"
  monthlyRent: number;
  tenantName?: string;
  tenantContact?: string;
  tenantMoveIn?: string;    // ISO date
  securityDeposit?: number; // agreed deposit amount
  depositCollectedBy?: string; // partnerId who received the deposit
  depositReceivedDate?: string; // ISO date when deposit was received
  depositNote?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  monthlyRent: number; // used when no units defined
  tenantName?: string;
  tenantContact?: string;
  partners: PropertyPartner[];
  units: Unit[];
  createdAt: string;
}

// "deposit" = security deposit received (income, but separately tracked)
export type TxnType = "rent" | "expense" | "deposit";

export interface Transaction {
  id: string;
  propertyId: string;
  unitId?: string;
  type: TxnType;
  amount: number;
  date: string;           // ISO yyyy-mm-dd
  category?: string;
  note?: string;
  collectedBy?: string;   // partnerId who physically collected / paid this
}

interface DB {
  users: User[];
  partners: Partner[];
  properties: Property[];
  transactions: Transaction[];
}

const KEY = "pm_db_v2";
const SESSION_KEY = "pm_session_v1";

const emptyDB: DB = {
  users: [{ id: "u_admin", username: "admin", password: "123", role: "admin" }],
  partners: [],
  properties: [],
  transactions: [],
};

function migrate(raw: any): DB {
  if (raw.properties) {
    raw.properties = raw.properties.map((p: any) => ({
      ...p,
      units: (p.units ?? []).map((u: any) => ({
        securityDeposit: 0,
        depositCollectedBy: undefined,
        depositReceivedDate: undefined,
        tenantMoveIn: undefined,
        depositNote: undefined,
        ...u,
      })),
    }));
  }
  return raw as DB;
}

function read(): DB {
  if (typeof window === "undefined") return emptyDB;
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      const old = localStorage.getItem("pm_db_v1");
      if (old) {
        const parsed = migrate(JSON.parse(old));
        localStorage.setItem(KEY, JSON.stringify(parsed));
        raw = JSON.stringify(parsed);
      } else {
        localStorage.setItem(KEY, JSON.stringify(emptyDB));
        return emptyDB;
      }
    }
    const parsed = migrate(JSON.parse(raw));
    if (!parsed.users?.some((u) => u.username === "admin")) {
      parsed.users = [...(parsed.users ?? []), emptyDB.users[0]];
      localStorage.setItem(KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return emptyDB;
  }
}

function write(data: DB) {
  localStorage.setItem(KEY, JSON.stringify(data));
  notify();
}

const listeners = new Set<() => void>();
let cachedSnapshot: DB | null = null;

function notify() {
  cachedSnapshot = null;
  listeners.forEach((l) => l());
}

function getSnapshot(): DB {
  if (!cachedSnapshot) cachedSnapshot = read();
  return cachedSnapshot;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cachedSnapshot = null;
    if (e.key === SESSION_KEY) cachedSession = undefined;
    if (e.key === KEY || e.key === SESSION_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const db = {
  get: read,
  set: (data: DB) => write(data),
  uid: (prefix = "id") =>
    `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
};

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getSnapshot, () => emptyDB);
}

// ----- Session -----
export interface Session {
  userId: string;
  role: Role;
  partnerId?: string;
}

let cachedSession: Session | null | undefined = undefined;

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (cachedSession !== undefined) return cachedSession;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    cachedSession = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
}

export function setSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  cachedSession = s;
  listeners.forEach((l) => l());
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null);
}

export function login(username: string, password: string): Session | null {
  const data = read();
  const u = data.users.find(
    (x) => x.username.toLowerCase() === username.toLowerCase() && x.password === password,
  );
  if (!u) return null;
  const s: Session = { userId: u.id, role: u.role, partnerId: u.partnerId };
  setSession(s);
  return s;
}

export function logout() {
  setSession(null);
}

// ----- Helpers -----
export function totalPercent(p: Property): number {
  return p.partners.reduce((s, x) => s + (Number(x.percent) || 0), 0);
}

export function effectiveRent(p: Property): number {
  if ((p.units ?? []).length > 0) {
    return p.units.reduce((s, u) => s + u.monthlyRent, 0);
  }
  return p.monthlyRent;
}

export interface PropertySummary {
  income: number;    // rent only
  deposit: number;   // security deposits received
  expense: number;
  net: number;       // income - expense (deposit excluded from net — it's a liability)
  count: number;
}

export function propertySummary(propertyId: string, txns: Transaction[]): PropertySummary {
  const list = txns.filter((t) => t.propertyId === propertyId);
  const income  = list.filter((t) => t.type === "rent").reduce((s, t) => s + t.amount, 0);
  const deposit = list.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, deposit, expense, net: income - expense, count: list.length };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

// ----- Cash position per partner -----
/**
 * How much each partner has physically collected or paid,
 * and what they're entitled to based on ownership %.
 * Used in the Distribution tab.
 */
export interface PartnerCashPosition {
  partnerId: string;
  entitled: number;         // ownership % × net
  cashCollected: number;    // rent + deposit they personally collected
  cashPaid: number;         // expenses they personally paid
  cashInHand: number;       // cashCollected - cashPaid (what they physically hold)
  balance: number;          // cashInHand - entitled  (positive = owes pool, negative = pool owes them)
}

export function computeCashPositions(
  propertyId: string,
  partners: PropertyPartner[],
  txns: Transaction[],
  net: number,
): PartnerCashPosition[] {
  return partners.map((pp) => {
    const entitled = (net * pp.percent) / 100;
    const list = txns.filter((t) => t.propertyId === propertyId && t.collectedBy === pp.partnerId);
    const cashCollected = list.filter((t) => t.type === "rent" || t.type === "deposit").reduce((s, t) => s + t.amount, 0);
    const cashPaid = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const cashInHand = cashCollected - cashPaid;
    return { partnerId: pp.partnerId, entitled, cashCollected, cashPaid, cashInHand, balance: cashInHand - entitled };
  });
}

// ----- Settlement computation -----
export interface PartnerBalance {
  from: string;
  to: string;
  amount: number;
}

export function computeSettlements(
  propertyId: string,
  partners: PropertyPartner[],
  txns: Transaction[],
): PartnerBalance[] {
  const ledger: Record<string, Record<string, number>> = {};

  const ensure = (a: string, b: string) => {
    if (!ledger[a]) ledger[a] = {};
    if (!ledger[a][b]) ledger[a][b] = 0;
    if (!ledger[b]) ledger[b] = {};
    if (!ledger[b][a]) ledger[b][a] = 0;
  };

  for (const t of txns) {
    if (t.propertyId !== propertyId || !t.collectedBy) continue;
    const collector = t.collectedBy;

    for (const pp of partners) {
      if (pp.partnerId === collector) continue;
      const share = (t.amount * pp.percent) / 100;
      ensure(collector, pp.partnerId);

      if (t.type === "rent" || t.type === "deposit") {
        // collector received money → owes other partner their share
        ledger[collector][pp.partnerId] += share;
        ledger[pp.partnerId][collector] -= share;
      } else if (t.type === "expense") {
        // collector paid → other partner owes collector their share
        ledger[pp.partnerId][collector] += share;
        ledger[collector][pp.partnerId] -= share;
      }
    }
  }

  const result: PartnerBalance[] = [];
  const seen = new Set<string>();

  for (const from of Object.keys(ledger)) {
    for (const to of Object.keys(ledger[from])) {
      const key = [from, to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const net = ledger[from]?.[to] ?? 0;
      if (Math.abs(net) < 0.5) continue;
      if (net > 0) result.push({ from, to, amount: net });
      else result.push({ from: to, to: from, amount: -net });
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}
