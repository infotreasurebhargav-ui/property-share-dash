// LocalStorage-backed data store for Property Manage portal.
import { useSyncExternalStore } from "react";

export type Role = "admin" | "partner";

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  partnerId?: string; // for partner role
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

export interface Property {
  id: string;
  name: string;
  address: string;
  type: string; // e.g. Apartment, Shop, Office, Land
  monthlyRent: number;
  tenantName?: string;
  tenantContact?: string;
  partners: PropertyPartner[];
  createdAt: string;
}

export type TxnType = "rent" | "expense";

export interface Transaction {
  id: string;
  propertyId: string;
  type: TxnType;
  amount: number;
  date: string; // ISO yyyy-mm-dd
  category?: string;
  note?: string;
}

interface DB {
  users: User[];
  partners: Partner[];
  properties: Property[];
  transactions: Transaction[];
}

const KEY = "pm_db_v1";
const SESSION_KEY = "pm_session_v1";

const emptyDB: DB = {
  users: [{ id: "u_admin", username: "admin", password: "123", role: "admin" }],
  partners: [],
  properties: [],
  transactions: [],
};

function read(): DB {
  if (typeof window === "undefined") return emptyDB;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(emptyDB));
      return emptyDB;
    }
    const parsed = JSON.parse(raw) as DB;
    // ensure admin exists
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
    if (e.key === KEY || e.key === SESSION_KEY) {
      cachedSnapshot = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const db = {
  get: read,
  set: (data: DB) => {
    write(data);
  },
  uid: (prefix = "id") =>
    `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
};

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getSnapshot, () => emptyDB);
}

// ----- session -----
export interface Session {
  userId: string;
  role: Role;
  partnerId?: string;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
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

// ----- helpers -----
export function totalPercent(p: Property): number {
  return p.partners.reduce((s, x) => s + (Number(x.percent) || 0), 0);
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
