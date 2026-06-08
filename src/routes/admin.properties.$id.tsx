import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  useDB, db, formatINR, totalPercent, propertySummary, effectiveRent,
  computeSettlements, type Transaction, type Unit,
} from "@/lib/store";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Building2, Plus, Trash2, Users, TrendingUp, TrendingDown,
  Wallet, Layers, ArrowRightLeft, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/properties/$id")({
  component: PropertyDetail,
  notFoundComponent: () => (
    <div className="glass p-10 text-center">
      <p className="text-muted-foreground mb-4">Property not found.</p>
      <Link to="/admin/properties" className="text-primary underline">Back to properties</Link>
    </div>
  ),
});

const FLOORS = ["GF", "1/F", "2/F", "3/F", "4/F", "5/F", "6/F", "7/F", "8/F", "9/F", "10/F", "Basement", "Terrace", "Other"];

function PropertyDetail() {
  const { id } = Route.useParams();
  const data = useDB();
  const property = data.properties.find((p) => p.id === id);
  if (!property) throw notFound();

  const units = property.units ?? [];
  const summary = propertySummary(id, data.transactions);
  const pct = totalPercent(property);
  const remaining = 100 - pct;
  const txns = data.transactions
    .filter((t) => t.propertyId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // ── Partner management ──
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [pForm, setPForm] = useState({ partnerId: "", percent: "" });
  const availablePartners = data.partners.filter(
    (pt) => !property.partners.some((pp) => pp.partnerId === pt.id),
  );

  const addPartner = () => {
    const percent = Number(pForm.percent);
    if (!pForm.partnerId) return toast.error("Select a partner");
    if (!percent || percent <= 0) return toast.error("Percent must be > 0");
    if (percent > remaining) return toast.error(`Only ${remaining}% remaining`);
    const cur = db.get();
    db.set({
      ...cur,
      properties: cur.properties.map((p) =>
        p.id === id
          ? { ...p, partners: [...p.partners, { partnerId: pForm.partnerId, percent }] }
          : p,
      ),
    });
    setPForm({ partnerId: "", percent: "" });
    setPartnerOpen(false);
    toast.success("Partner added");
  };

  const removePartner = (partnerId: string) => {
    if (!confirm("Remove this partner from the property?")) return;
    const cur = db.get();
    db.set({
      ...cur,
      properties: cur.properties.map((p) =>
        p.id === id ? { ...p, partners: p.partners.filter((x) => x.partnerId !== partnerId) } : p,
      ),
    });
  };

  // ── Unit management ──
  const [unitOpen, setUnitOpen] = useState(false);
  const [uForm, setUForm] = useState({
    floor: "GF", label: "", monthlyRent: "", tenantName: "", tenantContact: "",
  });

  const addUnit = () => {
    if (!uForm.label.trim()) return toast.error("Unit label is required");
    const rent = Number(uForm.monthlyRent) || 0;
    if (rent < 0) return toast.error("Rent must be ≥ 0");
    const unit: Unit = {
      id: db.uid("unit"),
      floor: uForm.floor,
      label: uForm.label.trim(),
      monthlyRent: rent,
      tenantName: uForm.tenantName.trim() || undefined,
      tenantContact: uForm.tenantContact.trim() || undefined,
    };
    const cur = db.get();
    db.set({
      ...cur,
      properties: cur.properties.map((p) =>
        p.id === id ? { ...p, units: [...(p.units ?? []), unit] } : p,
      ),
    });
    setUForm({ floor: "GF", label: "", monthlyRent: "", tenantName: "", tenantContact: "" });
    setUnitOpen(false);
    toast.success("Unit added");
  };

  const removeUnit = (unitId: string) => {
    if (!confirm("Remove this unit? Transactions linked to it will remain but lose the unit reference.")) return;
    const cur = db.get();
    db.set({
      ...cur,
      properties: cur.properties.map((p) =>
        p.id === id ? { ...p, units: (p.units ?? []).filter((u) => u.id !== unitId) } : p,
      ),
    });
    toast.success("Unit removed");
  };

  // ── Transaction management ──
  const [txnOpen, setTxnOpen] = useState(false);
  const [tForm, setTForm] = useState({
    type: "rent" as "rent" | "expense",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    category: "",
    note: "",
    unitId: "",
    collectedBy: "",
  });

  const addTxn = () => {
    const amount = Number(tForm.amount);
    if (!amount || amount <= 0) return toast.error("Amount must be > 0");
    const cur = db.get();
    const t: Transaction = {
      id: db.uid("txn"),
      propertyId: id,
      type: tForm.type,
      amount,
      date: tForm.date,
      category: tForm.category.trim() || undefined,
      note: tForm.note.trim() || undefined,
      unitId: tForm.unitId || undefined,
      collectedBy: tForm.collectedBy || undefined,
    };
    db.set({ ...cur, transactions: [t, ...cur.transactions] });
    setTForm({ type: "rent", amount: "", date: new Date().toISOString().slice(0, 10), category: "", note: "", unitId: "", collectedBy: "" });
    setTxnOpen(false);
    toast.success("Entry added");
  };

  const removeTxn = (txnId: string) => {
    if (!confirm("Delete this entry?")) return;
    const cur = db.get();
    db.set({ ...cur, transactions: cur.transactions.filter((t) => t.id !== txnId) });
    toast.success("Entry deleted");
  };

  // ── Settlement ──
  const settlements = computeSettlements(id, property.partners, data.transactions);

  // Group units by floor
  const byFloor: Record<string, Unit[]> = {};
  for (const u of units) {
    if (!byFloor[u.floor]) byFloor[u.floor] = [];
    byFloor[u.floor].push(u);
  }

  const totalRent = effectiveRent(property);

  return (
    <div>
      <Link to="/admin/properties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> All properties
      </Link>

      <PageHeader
        title={property.name}
        subtitle={`${property.type} • ${property.address}`}
        icon={Building2}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Monthly Rent" value={formatINR(totalRent)} icon={Wallet} tone="from-[var(--brand-blue)] to-[var(--brand-navy)]" />
        <Stat label="Total Income" value={formatINR(summary.income)} icon={TrendingUp} tone="from-emerald-500 to-[var(--brand-green)]" />
        <Stat label="Total Expense" value={formatINR(summary.expense)} icon={TrendingDown} tone="from-red-500 to-orange-500" />
        <Stat label="Net" value={formatINR(summary.net)} icon={Wallet} tone="from-[var(--brand-green)] to-[var(--brand-blue)]" />
      </div>

      <Tabs defaultValue="units" className="w-full">
        <TabsList className="glass-soft p-1 mb-4 w-full flex overflow-x-auto">
          <TabsTrigger value="units" className="flex-1 text-xs sm:text-sm whitespace-nowrap">
            <Layers className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Units {units.length > 0 && <span className="ml-1 text-[10px] bg-white/50 px-1.5 rounded-full">{units.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="partners" className="flex-1 text-xs sm:text-sm whitespace-nowrap">
            <Users className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex-1 text-xs sm:text-sm whitespace-nowrap">Ledger</TabsTrigger>
          <TabsTrigger value="distribution" className="flex-1 text-xs sm:text-sm whitespace-nowrap">Distribution</TabsTrigger>
          <TabsTrigger value="settlement" className="flex-1 text-xs sm:text-sm whitespace-nowrap">
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Settlement
            {settlements.length > 0 && (
              <span className="ml-1 text-[10px] bg-amber-500 text-white px-1.5 rounded-full">{settlements.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════ UNITS TAB ══════════════════════════════ */}
        <TabsContent value="units">
          <div className="glass p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Layers className="h-4 w-4" /> Floor / Units</h3>
                <p className="text-xs text-muted-foreground">
                  {units.length === 0
                    ? "No units added. This property uses a single rent figure."
                    : `${units.length} unit${units.length > 1 ? "s" : ""} · Total rent ${formatINR(totalRent)}/mo`}
                </p>
              </div>
              <Dialog open={unitOpen} onOpenChange={setUnitOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-brand shrink-0" size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Add Unit
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-none mx-4 max-w-md">
                  <DialogHeader><DialogTitle>Add floor / unit</DialogTitle></DialogHeader>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Floor</Label>
                        <Select value={uForm.floor} onValueChange={(v) => setUForm({ ...uForm, floor: v })}>
                          <SelectTrigger className="text-base"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FLOORS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Unit / Label</Label>
                        <Input
                          placeholder='e.g. "Shop A", "Flat 1"'
                          value={uForm.label}
                          onChange={(e) => setUForm({ ...uForm, label: e.target.value })}
                          className="text-base"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Monthly Rent (₹)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={uForm.monthlyRent}
                        onChange={(e) => setUForm({ ...uForm, monthlyRent: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Tenant Name</Label>
                        <Input
                          value={uForm.tenantName}
                          onChange={(e) => setUForm({ ...uForm, tenantName: e.target.value })}
                          className="text-base"
                        />
                      </div>
                      <div>
                        <Label>Tenant Contact</Label>
                        <Input
                          value={uForm.tenantContact}
                          onChange={(e) => setUForm({ ...uForm, tenantContact: e.target.value })}
                          className="text-base"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <Button variant="ghost" onClick={() => setUnitOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button className="btn-brand w-full sm:w-auto" onClick={addUnit}>Add Unit</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {units.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No units yet.</p>
                <p className="text-xs mt-1">Add floor-wise units for GF, 1/F, 2/F etc.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(byFloor).map(([floor, floorUnits]) => (
                  <div key={floor}>
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                      <span className="h-px flex-1 bg-white/30" />
                      {floor}
                      <span className="h-px flex-1 bg-white/30" />
                    </div>
                    <div className="space-y-2">
                      {floorUnits.map((u) => (
                        <div key={u.id} className="glass-soft p-3 rounded-xl flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">{u.label}</div>
                            {u.tenantName && (
                              <div className="text-xs text-muted-foreground">{u.tenantName}{u.tenantContact ? ` · ${u.tenantContact}` : ""}</div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm">{formatINR(u.monthlyRent)}<span className="text-muted-foreground font-normal text-xs">/mo</span></div>
                          </div>
                          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => removeUnit(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="glass-soft rounded-xl p-3 flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-muted-foreground">Total rent / month</span>
                  <span className="font-bold text-lg">{formatINR(totalRent)}</span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════ PARTNERS TAB ══════════════════════════════ */}
        <TabsContent value="partners">
          <div className="glass p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Users className="h-4 w-4" /> Partners</h3>
                <p className="text-xs text-muted-foreground">
                  Allocated <span className="font-semibold">{pct}%</span> · Remaining{" "}
                  <span className={`font-semibold ${remaining === 0 ? "text-emerald-700" : "text-amber-700"}`}>{remaining}%</span>
                </p>
              </div>
              <Dialog open={partnerOpen} onOpenChange={setPartnerOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-brand shrink-0" size="sm" disabled={remaining <= 0 || availablePartners.length === 0}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-none mx-4">
                  <DialogHeader><DialogTitle>Add partner to property</DialogTitle></DialogHeader>
                  <div className="grid gap-4">
                    <div>
                      <Label>Partner</Label>
                      <Select value={pForm.partnerId} onValueChange={(v) => setPForm({ ...pForm, partnerId: v })}>
                        <SelectTrigger className="text-base"><SelectValue placeholder="Select partner" /></SelectTrigger>
                        <SelectContent>
                          {availablePartners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {availablePartners.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          All partners already added. <Link to="/admin/partners" className="text-primary underline">Create more</Link>
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Ownership % (max {remaining}%)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max={remaining}
                        step="0.01"
                        value={pForm.percent}
                        onChange={(e) => setPForm({ ...pForm, percent: e.target.value })}
                        className="text-base"
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <Button variant="ghost" onClick={() => setPartnerOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button className="btn-brand w-full sm:w-auto" onClick={addPartner}>Add</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Ownership progress bar */}
            <div className="h-3 rounded-full bg-white/40 overflow-hidden flex mb-4">
              {property.partners.map((pp, i) => {
                const hues = [
                  "from-[var(--brand-navy)] to-[var(--brand-blue)]",
                  "from-[var(--brand-blue)] to-cyan-500",
                  "from-emerald-500 to-[var(--brand-green)]",
                  "from-amber-500 to-orange-500",
                  "from-fuchsia-500 to-pink-500",
                ];
                const partner = data.partners.find((x) => x.id === pp.partnerId);
                return (
                  <div
                    key={pp.partnerId}
                    className={`bg-gradient-to-r ${hues[i % hues.length]}`}
                    style={{ width: `${pp.percent}%` }}
                    title={`${partner?.name}: ${pp.percent}%`}
                  />
                );
              })}
            </div>

            {property.partners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No partners yet.</p>
            ) : (
              <div className="space-y-2">
                {property.partners.map((pp) => {
                  const partner = data.partners.find((x) => x.id === pp.partnerId);
                  const share = (summary.net * pp.percent) / 100;
                  return (
                    <div key={pp.partnerId} className="glass-soft p-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {(partner?.name ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{partner?.name ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">Net share: {formatINR(share)}</div>
                      </div>
                      <div className="font-bold text-primary shrink-0">{pp.percent}%</div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => removePartner(pp.partnerId)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════ LEDGER TAB ══════════════════════════════ */}
        <TabsContent value="ledger">
          <div className="glass p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Rent & Expenses</h3>
              <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-brand" size="sm"><Plus className="h-4 w-4 mr-1" /> Add Entry</Button>
                </DialogTrigger>
                <DialogContent className="glass border-none mx-4 max-w-md">
                  <DialogHeader><DialogTitle>Add rent or expense</DialogTitle></DialogHeader>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Type</Label>
                        <Select value={tForm.type} onValueChange={(v: "rent" | "expense") => setTForm({ ...tForm, type: v })}>
                          <SelectTrigger className="text-base"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rent">Rent (Income)</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input type="date" value={tForm.date} onChange={(e) => setTForm({ ...tForm, date: e.target.value })} className="text-base" />
                      </div>
                    </div>

                    {/* Unit selector — only if property has units */}
                    {units.length > 0 && (
                      <div>
                        <Label>Unit <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Select value={tForm.unitId} onValueChange={(v) => setTForm({ ...tForm, unitId: v })}>
                          <SelectTrigger className="text-base"><SelectValue placeholder="All units / general" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All units / general</SelectItem>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.floor} · {u.label} ({formatINR(u.monthlyRent)}/mo)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Amount (₹)</Label>
                      <Input type="number" inputMode="numeric" min="1" value={tForm.amount} onChange={(e) => setTForm({ ...tForm, amount: e.target.value })} className="text-base" />
                    </div>

                    {/* Collected / paid by */}
                    {property.partners.length > 0 && (
                      <div>
                        <Label>
                          {tForm.type === "rent" ? "Collected by" : "Paid by"}{" "}
                          <span className="text-muted-foreground text-xs">(which partner?)</span>
                        </Label>
                        <Select value={tForm.collectedBy} onValueChange={(v) => setTForm({ ...tForm, collectedBy: v })}>
                          <SelectTrigger className="text-base"><SelectValue placeholder="Select partner" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Not tracked</SelectItem>
                            {property.partners.map((pp) => {
                              const p = data.partners.find((x) => x.id === pp.partnerId);
                              return <SelectItem key={pp.partnerId} value={pp.partnerId}>{p?.name ?? pp.partnerId}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                        {tForm.collectedBy && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {tForm.type === "rent"
                              ? "This partner collected the rent — settlement will track what they owe others."
                              : "This partner paid the expense — settlement will track what others owe them."}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <Label>Category <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input placeholder="Maintenance, Tax, Repair..." value={tForm.category} onChange={(e) => setTForm({ ...tForm, category: e.target.value })} className="text-base" />
                    </div>
                    <div>
                      <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input value={tForm.note} onChange={(e) => setTForm({ ...tForm, note: e.target.value })} className="text-base" />
                    </div>
                  </div>
                  <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <Button variant="ghost" onClick={() => setTxnOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button className="btn-brand w-full sm:w-auto" onClick={addTxn}>Add</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {txns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No entries yet.</p>
            ) : (
              <>
                {/* Mobile transaction cards */}
                <div className="sm:hidden space-y-2">
                  {txns.map((t) => {
                    const collector = t.collectedBy
                      ? data.partners.find((p) => p.id === t.collectedBy)
                      : null;
                    const unit = t.unitId ? units.find((u) => u.id === t.unitId) : null;
                    return (
                      <div key={t.id} className="glass-soft p-3 rounded-xl flex items-start gap-3">
                        <span className={`mt-0.5 shrink-0 text-xs px-2 py-0.5 rounded font-semibold ${t.type === "rent" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                          {t.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold ${t.type === "rent" ? "text-emerald-700" : "text-red-700"}`}>
                            {t.type === "rent" ? "+" : "−"}{formatINR(t.amount)}
                          </div>
                          <div className="text-xs text-muted-foreground">{t.date}</div>
                          {unit && <div className="text-xs text-muted-foreground">{unit.floor} · {unit.label}</div>}
                          {collector && (
                            <div className="text-xs font-medium text-[var(--brand-blue)] mt-0.5">
                              {t.type === "rent" ? "Collected" : "Paid"} by {collector.name}
                            </div>
                          )}
                          {t.category && <div className="text-xs text-muted-foreground">{t.category}</div>}
                          {t.note && <div className="text-xs text-muted-foreground italic">{t.note}</div>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeTxn(t.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Type</th>
                        {units.length > 0 && <th className="text-left p-2">Unit</th>}
                        <th className="text-left p-2">Collected/Paid by</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-left p-2">Note</th>
                        <th className="text-right p-2">Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((t) => {
                        const collector = t.collectedBy
                          ? data.partners.find((p) => p.id === t.collectedBy)
                          : null;
                        const unit = t.unitId ? units.find((u) => u.id === t.unitId) : null;
                        return (
                          <tr key={t.id} className="border-t border-white/30">
                            <td className="p-2">{t.date}</td>
                            <td className="p-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${t.type === "rent" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                {t.type}
                              </span>
                            </td>
                            {units.length > 0 && (
                              <td className="p-2 text-xs">{unit ? `${unit.floor} · ${unit.label}` : "—"}</td>
                            )}
                            <td className="p-2 text-xs">{collector ? <span className="font-medium text-[var(--brand-blue)]">{collector.name}</span> : "—"}</td>
                            <td className="p-2">{t.category ?? "—"}</td>
                            <td className="p-2 text-muted-foreground">{t.note ?? "—"}</td>
                            <td className={`p-2 text-right font-semibold ${t.type === "rent" ? "text-emerald-700" : "text-red-700"}`}>
                              {t.type === "rent" ? "+" : "−"}{formatINR(t.amount)}
                            </td>
                            <td className="p-2 text-right">
                              <Button size="icon" variant="ghost" onClick={() => removeTxn(t.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════ DISTRIBUTION TAB ══════════════════════════════ */}
        <TabsContent value="distribution">
          <div className="glass p-4 sm:p-5">
            <h3 className="font-bold mb-1">Partner Distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Each partner's share of net cash ({formatINR(summary.net)}) based on ownership %
            </p>
            {property.partners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Add partners to see distribution.</p>
            ) : (
              <div className="space-y-3">
                {property.partners.map((pp) => {
                  const partner = data.partners.find((x) => x.id === pp.partnerId);
                  const share = (summary.net * pp.percent) / 100;
                  const incomeShare = (summary.income * pp.percent) / 100;
                  const expenseShare = (summary.expense * pp.percent) / 100;
                  return (
                    <div key={pp.partnerId} className="glass-soft p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="font-semibold">{partner?.name}</div>
                        <div className="text-sm font-bold text-primary">{pp.percent}%</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="flex sm:block items-center justify-between glass-soft rounded-lg px-3 py-2 sm:p-0 sm:bg-transparent">
                          <div className="text-muted-foreground">Income share</div>
                          <div className="font-semibold text-emerald-700">{formatINR(incomeShare)}</div>
                        </div>
                        <div className="flex sm:block items-center justify-between glass-soft rounded-lg px-3 py-2 sm:p-0 sm:bg-transparent">
                          <div className="text-muted-foreground">Expense share</div>
                          <div className="font-semibold text-red-700">{formatINR(expenseShare)}</div>
                        </div>
                        <div className="flex sm:block items-center justify-between glass-soft rounded-lg px-3 py-2 sm:p-0 sm:bg-transparent">
                          <div className="text-muted-foreground">Net payout</div>
                          <div className="font-bold">{formatINR(share)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════ SETTLEMENT TAB ══════════════════════════════ */}
        <TabsContent value="settlement">
          <div className="glass p-4 sm:p-5">
            <h3 className="font-bold flex items-center gap-2 mb-1">
              <ArrowRightLeft className="h-4 w-4" /> Partner Settlement
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Tracks who collected/paid and calculates what each partner owes the others.
              Use "Collected by / Paid by" when adding ledger entries to enable this.
            </p>

            {property.partners.length < 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Need at least 2 partners for settlement tracking.</p>
              </div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">All settled up!</p>
                <p className="text-xs mt-1">
                  No outstanding balances — or no "Collected by" entries yet.
                  <br />Add transactions with a collector to start tracking.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {settlements.map(({ from, to, amount }) => {
                  const fromPartner = data.partners.find((p) => p.id === from);
                  const toPartner = data.partners.find((p) => p.id === to);
                  return (
                    <div key={`${from}-${to}`} className="glass-soft p-4 rounded-xl border-l-4 border-l-amber-500">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(fromPartner?.name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">
                            <span className="font-bold">{fromPartner?.name ?? from}</span>
                            <span className="text-muted-foreground mx-2">owes</span>
                            <span className="font-bold">{toPartner?.name ?? to}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">Based on collection records</div>
                        </div>
                        <div className="font-bold text-lg text-amber-700 shrink-0">{formatINR(amount)}</div>
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-[var(--brand-green)] flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(toPartner?.name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  These balances reset to zero when partners settle up outside the system.
                </p>
              </div>
            )}

            {/* Per-partner collection summary */}
            {property.partners.length >= 1 && (
              <div className="mt-6">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Collection summary per partner</div>
                <div className="grid gap-2">
                  {property.partners.map((pp) => {
                    const partner = data.partners.find((x) => x.id === pp.partnerId);
                    const collected = txns
                      .filter((t) => t.collectedBy === pp.partnerId && t.type === "rent")
                      .reduce((s, t) => s + t.amount, 0);
                    const paid = txns
                      .filter((t) => t.collectedBy === pp.partnerId && t.type === "expense")
                      .reduce((s, t) => s + t.amount, 0);
                    return (
                      <div key={pp.partnerId} className="glass-soft p-3 rounded-xl flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {(partner?.name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{partner?.name}</div>
                          <div className="text-xs text-muted-foreground">{pp.percent}% ownership</div>
                        </div>
                        <div className="text-right text-xs shrink-0">
                          <div className="text-emerald-700 font-semibold">+{formatINR(collected)} collected</div>
                          <div className="text-red-700 font-semibold">−{formatINR(paid)} paid out</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="glass p-3 sm:p-4">
      <div className={`inline-flex p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${tone} text-white mb-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase">{label}</div>
      <div className="text-base sm:text-lg font-bold leading-tight">{value}</div>
    </div>
  );
}
