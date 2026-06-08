import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, db, formatINR, totalPercent, propertySummary, type Transaction } from "@/lib/store";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Plus, Trash2, Users, TrendingUp, TrendingDown, Wallet } from "lucide-react";
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

function PropertyDetail() {
  const { id } = Route.useParams();
  const data = useDB();
  const property = data.properties.find((p) => p.id === id);
  if (!property) throw notFound();

  const summary = propertySummary(id, data.transactions);
  const pct = totalPercent(property);
  const remaining = 100 - pct;
  const txns = data.transactions.filter((t) => t.propertyId === id).sort((a, b) => b.date.localeCompare(a.date));

  const [partnerOpen, setPartnerOpen] = useState(false);
  const [pForm, setPForm] = useState({ partnerId: "", percent: "" });

  const availablePartners = data.partners.filter((pt) => !property.partners.some((pp) => pp.partnerId === pt.id));

  const addPartner = () => {
    const percent = Number(pForm.percent);
    if (!pForm.partnerId) return toast.error("Select a partner");
    if (!percent || percent <= 0) return toast.error("Percent must be > 0");
    if (percent > remaining) return toast.error(`Only ${remaining}% remaining`);
    const cur = db.get();
    db.set({
      ...cur,
      properties: cur.properties.map((p) =>
        p.id === id ? { ...p, partners: [...p.partners, { partnerId: pForm.partnerId, percent }] } : p,
      ),
    });
    setPForm({ partnerId: "", percent: "" });
    setPartnerOpen(false);
    toast.success("Partner added");
  };

  const removePartner = (partnerId: string) => {
    const cur = db.get();
    db.set({
      ...cur,
      properties: cur.properties.map((p) =>
        p.id === id ? { ...p, partners: p.partners.filter((x) => x.partnerId !== partnerId) } : p,
      ),
    });
  };

  const [txnOpen, setTxnOpen] = useState(false);
  const [tForm, setTForm] = useState({
    type: "rent" as "rent" | "expense",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    category: "",
    note: "",
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
    };
    db.set({ ...cur, transactions: [t, ...cur.transactions] });
    setTForm({ type: "rent", amount: "", date: new Date().toISOString().slice(0, 10), category: "", note: "" });
    setTxnOpen(false);
    toast.success("Entry added");
  };

  const removeTxn = (txnId: string) => {
    const cur = db.get();
    db.set({ ...cur, transactions: cur.transactions.filter((t) => t.id !== txnId) });
  };

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Monthly Rent" value={formatINR(property.monthlyRent)} icon={Wallet} tone="from-[var(--brand-blue)] to-[var(--brand-navy)]" />
        <Stat label="Total Income" value={formatINR(summary.income)} icon={TrendingUp} tone="from-emerald-500 to-[var(--brand-green)]" />
        <Stat label="Total Expense" value={formatINR(summary.expense)} icon={TrendingDown} tone="from-red-500 to-orange-500" />
        <Stat label="Net" value={formatINR(summary.net)} icon={Wallet} tone="from-[var(--brand-green)] to-[var(--brand-blue)]" />
      </div>

      <Tabs defaultValue="partners" className="w-full">
        <TabsList className="glass-soft p-1 mb-4 w-full flex">
          <TabsTrigger value="partners" className="flex-1 text-xs sm:text-sm">Partners</TabsTrigger>
          <TabsTrigger value="ledger" className="flex-1 text-xs sm:text-sm">Ledger</TabsTrigger>
          <TabsTrigger value="distribution" className="flex-1 text-xs sm:text-sm">Distribution</TabsTrigger>
        </TabsList>

        {/* ── Partners tab ── */}
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
                      <Label>Percent (max {remaining}%)</Label>
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

            {/* progress bar */}
            <div className="h-3 rounded-full bg-white/40 overflow-hidden flex mb-4">
              {property.partners.map((pp, i) => {
                const partner = data.partners.find((x) => x.id === pp.partnerId);
                const hues = [
                  "from-[var(--brand-navy)] to-[var(--brand-blue)]",
                  "from-[var(--brand-blue)] to-cyan-500",
                  "from-emerald-500 to-[var(--brand-green)]",
                  "from-amber-500 to-orange-500",
                  "from-fuchsia-500 to-pink-500",
                ];
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
                        <div className="text-xs text-muted-foreground">Share: {formatINR(share)}</div>
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

        {/* ── Ledger tab ── */}
        <TabsContent value="ledger">
          <div className="glass p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Rent & Expenses</h3>
              <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-brand" size="sm"><Plus className="h-4 w-4 mr-1" /> Add Entry</Button>
                </DialogTrigger>
                <DialogContent className="glass border-none mx-4">
                  <DialogHeader><DialogTitle>Add rent or expense</DialogTitle></DialogHeader>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <Input
                          type="date"
                          value={tForm.date}
                          onChange={(e) => setTForm({ ...tForm, date: e.target.value })}
                          className="text-base"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Amount (₹)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={tForm.amount}
                        onChange={(e) => setTForm({ ...tForm, amount: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div>
                      <Label>Category (optional)</Label>
                      <Input
                        placeholder="Maintenance, Tax, Repair..."
                        value={tForm.category}
                        onChange={(e) => setTForm({ ...tForm, category: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div>
                      <Label>Note (optional)</Label>
                      <Input
                        value={tForm.note}
                        onChange={(e) => setTForm({ ...tForm, note: e.target.value })}
                        className="text-base"
                      />
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
                  {txns.map((t) => (
                    <div key={t.id} className="glass-soft p-3 rounded-xl flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 text-xs px-2 py-0.5 rounded font-semibold ${t.type === "rent" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {t.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold ${t.type === "rent" ? "text-emerald-700" : "text-red-700"}`}>
                          {t.type === "rent" ? "+" : "−"}{formatINR(t.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t.date}</div>
                        {t.category && <div className="text-xs text-muted-foreground">{t.category}</div>}
                        {t.note && <div className="text-xs text-muted-foreground italic">{t.note}</div>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeTxn(t.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-left p-2">Note</th>
                        <th className="text-right p-2">Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((t) => (
                        <tr key={t.id} className="border-t border-white/30">
                          <td className="p-2">{t.date}</td>
                          <td className="p-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${t.type === "rent" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                              {t.type}
                            </span>
                          </td>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Distribution tab ── */}
        <TabsContent value="distribution">
          <div className="glass p-4 sm:p-5">
            <h3 className="font-bold mb-1">Partner Distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">Each partner's share of net cash ({formatINR(summary.net)})</p>
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
                        <div className="flex sm:block items-center justify-between glass-soft rounded-lg px-3 py-2 sm:p-0 sm:bg-transparent sm:shadow-none">
                          <div className="text-muted-foreground">Income share</div>
                          <div className="font-semibold text-emerald-700">{formatINR(incomeShare)}</div>
                        </div>
                        <div className="flex sm:block items-center justify-between glass-soft rounded-lg px-3 py-2 sm:p-0 sm:bg-transparent sm:shadow-none">
                          <div className="text-muted-foreground">Expense share</div>
                          <div className="font-semibold text-red-700">{formatINR(expenseShare)}</div>
                        </div>
                        <div className="flex sm:block items-center justify-between glass-soft rounded-lg px-3 py-2 sm:p-0 sm:bg-transparent sm:shadow-none">
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
