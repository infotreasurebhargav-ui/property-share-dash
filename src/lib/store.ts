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
  floor: string;       // e.g. "GF", "1/F", "2/F", "3/F"
  label: string;       // e.g. "Shop A", "Flat 101", "Office"
  monthlyRent: number;
  tenantName?: string;
  tenantContact?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  monthlyRent: number; // used when no units defined; auto-computed from units when they exist
  tenantName?: string;
  tenantContact?: string;
  partners: PropertyPartner[];
  units: Unit[];       // floor/unit breakdown (may be empty for simple properties)
  createdAt: string;
}

export type TxnType = "rent" | "expense";

export interface Transaction {
  id: string;
  propertyId: string;
  unitId?: string;        // which unit (optional; used when property has units)
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
  // Ensure every property has a units array (migrate from v1)
  if (raw.properties) {
    raw.properties = raw.properties.map((p: any) => ({
      ...p,
      units: p.units ?? [],
    }));
  }
  return raw as DB;
}

function read(): DB {
  if (typeof window === "undefined") return emptyDB;
  try {
    // Try v2 key first
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      // Migrate from v1 if present
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

/** Effective monthly rent: sum of unit rents if units exist, else property.monthlyRent */
export function effectiveRent(p: Property): number {
  if (p.units.length > 0) {
    return p.units.reduce((s, u) => s + u.monthlyRent, 0);
  }
  return p.monthlyRent;
}

export function propertySummary(propertyId: string, txns: Transaction[]) {
  const list = txns.filter((t) => t.propertyId === propertyId);
  const income = list.filter((t) => t.type === "rent").reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense, count: list.length };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

// ----- Settlement computation -----
/**
 * For each transaction that has a `collectedBy` partner:
 *   - If RENT: collector holds the money → owes every other partner their % share
 *   - If EXPENSE: collector paid out of pocket → every other partner owes collector their % share
 *
 * Returns net balances: { from, to, amount } where `from` owes `to` the `amount`.
 */
export interface PartnerBalance {
  from: string;   // partnerId who owes
  to: string;     // partnerId who is owed
  amount: number; // always positive
}

export function computeSettlements(
  propertyId: string,
  partners: PropertyPartner[],
  txns: Transaction[],
): PartnerBalance[] {
  // ledger[A][B] = amount A owes B (can go negative, meaning B owes A)
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

      if (t.type === "rent") {
        // collector received rent → owes other partner their share
        ledger[collector][pp.partnerId] += share;
        ledger[pp.partnerId][collector] -= share;
      } else {
        // collector paid expense → other partner owes collector their share
        ledger[pp.partnerId][collector] += share;
        ledger[collector][pp.partnerId] -= share;
      }
    }
  }

  // Consolidate to net balances
  const result: PartnerBalance[] = [];
  const seen = new Set<string>();

  for (const from of Object.keys(ledger)) {
    for (const to of Object.keys(ledger[from])) {
      const key = [from, to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const net = (ledger[from]?.[to] ?? 0); // already accounts for both directions
      if (Math.abs(net) < 0.5) continue;

      if (net > 0) {
        result.push({ from, to, amount: net });
      } else {
        result.push({ from: to, to: from, amount: -net });
      }
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}
