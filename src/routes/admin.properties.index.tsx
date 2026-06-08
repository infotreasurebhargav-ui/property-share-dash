import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, db, formatINR, totalPercent, type Property } from "@/lib/store";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/properties/")({
  component: PropertiesPage,
});

const PROPERTY_TYPES = ["Apartment", "House", "Shop", "Office", "Warehouse", "Land", "Other"];

function PropertiesPage() {
  const data = useDB();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    type: "Apartment",
    monthlyRent: "",
    tenantName: "",
    tenantContact: "",
  });

  const reset = () =>
    setForm({ name: "", address: "", type: "Apartment", monthlyRent: "", tenantName: "", tenantContact: "" });

  const create = () => {
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Name and address are required");
      return;
    }
    const rent = Number(form.monthlyRent) || 0;
    if (rent < 0) return toast.error("Rent must be ≥ 0");
    const cur = db.get();
    const p: Property = {
      id: db.uid("prop"),
      name: form.name.trim(),
      address: form.address.trim(),
      type: form.type,
      monthlyRent: rent,
      tenantName: form.tenantName.trim() || undefined,
      tenantContact: form.tenantContact.trim() || undefined,
      partners: [],
      createdAt: new Date().toISOString(),
    };
    db.set({ ...cur, properties: [p, ...cur.properties] });
    toast.success("Property added");
    reset();
    setOpen(false);
  };

  const remove = (id: string) => {
    if (!confirm("Delete this property and all its transactions?")) return;
    const cur = db.get();
    db.set({
      ...cur,
      properties: cur.properties.filter((p) => p.id !== id),
      transactions: cur.transactions.filter((t) => t.propertyId !== id),
    });
    toast.success("Property removed");
  };

  const AddDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-brand">
          <Plus className="h-4 w-4 mr-1" /> Add Property
        </Button>
      </DialogTrigger>
      <DialogContent className="glass border-none max-w-lg mx-4">
        <DialogHeader>
          <DialogTitle>Add new property</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Sunrise Apartments – Flat 302"
              className="text-base"
            />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="text-base"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly Rent (₹)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.monthlyRent}
                onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
                className="text-base"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tenant Name</Label>
              <Input
                value={form.tenantName}
                onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                className="text-base"
              />
            </div>
            <div>
              <Label>Tenant Contact</Label>
              <Input
                value={form.tenantContact}
                onChange={(e) => setForm({ ...form, tenantContact: e.target.value })}
                className="text-base"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button className="btn-brand w-full sm:w-auto" onClick={create}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle="All properties in your portfolio"
        icon={Building2}
        actions={AddDialog}
      />

      {data.properties.length === 0 ? (
        <div className="glass p-10 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3" />
          No properties yet. Click "Add Property" to start.
        </div>
      ) : (
        <>
          {/* ── Mobile card list ── */}
          <div className="sm:hidden space-y-3">
            {data.properties.map((p) => {
              const pct = totalPercent(p);
              return (
                <div key={p.id} className="glass p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-base leading-snug">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.address}</div>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-md font-semibold ${pct === 100 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div className="glass-soft p-2 rounded-lg text-center">
                      <div className="text-muted-foreground uppercase text-[10px]">Type</div>
                      <div className="font-semibold">{p.type}</div>
                    </div>
                    <div className="glass-soft p-2 rounded-lg text-center">
                      <div className="text-muted-foreground uppercase text-[10px]">Rent/mo</div>
                      <div className="font-semibold">{formatINR(p.monthlyRent)}</div>
                    </div>
                    <div className="glass-soft p-2 rounded-lg text-center">
                      <div className="text-muted-foreground uppercase text-[10px]">Tenant</div>
                      <div className="font-semibold truncate">{p.tenantName ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/admin/properties/$id" params={{ id: p.id }} className="flex-1">
                      <Button size="sm" variant="ghost" className="w-full gap-1">
                        View details <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="px-3">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden sm:block glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/40 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Property</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-right p-4">Rent / mo</th>
                    <th className="text-left p-4">Tenant</th>
                    <th className="text-center p-4">Partnership</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.properties.map((p) => {
                    const pct = totalPercent(p);
                    return (
                      <tr key={p.id} className="border-t border-white/30 hover:bg-white/30">
                        <td className="p-4">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.address}</div>
                        </td>
                        <td className="p-4">{p.type}</td>
                        <td className="p-4 text-right font-semibold">{formatINR(p.monthlyRent)}</td>
                        <td className="p-4 text-xs">{p.tenantName ?? "—"}</td>
                        <td className="p-4 text-center">
                          <span className={`text-xs px-2 py-1 rounded-md font-semibold ${pct === 100 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                            {pct}% / 100%
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Link to="/admin/properties/$id" params={{ id: p.id }}>
                              <Button size="sm" variant="ghost"><ArrowRight className="h-4 w-4" /></Button>
                            </Link>
                            <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
