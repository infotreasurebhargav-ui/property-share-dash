import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, db, type Partner, type User } from "@/lib/store";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/partners")({
  component: PartnersPage,
});

function PartnersPage() {
  const data = useDB();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", username: "", password: "" });

  const reset = () => setForm({ name: "", email: "", phone: "", username: "", password: "" });

  const create = () => {
    const name = form.name.trim();
    const username = form.username.trim().toLowerCase();
    const password = form.password;
    if (!name) return toast.error("Name is required");
    if (!username || !password) return toast.error("Login username and password are required");
    if (username.length < 3) return toast.error("Username must be at least 3 chars");
    const cur = db.get();
    if (cur.users.some((u) => u.username.toLowerCase() === username)) {
      return toast.error("Username already taken");
    }
    const partner: Partner = {
      id: db.uid("ptr"),
      name,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
    };
    const user: User = {
      id: db.uid("usr"),
      username,
      password,
      role: "partner",
      partnerId: partner.id,
    };
    db.set({ ...cur, partners: [partner, ...cur.partners], users: [...cur.users, user] });
    toast.success(`Partner ${name} added`);
    reset();
    setOpen(false);
  };

  const remove = (partner: Partner) => {
    if (!confirm(`Remove partner ${partner.name}? Their share will be removed from all properties.`)) return;
    const cur = db.get();
    db.set({
      ...cur,
      partners: cur.partners.filter((p) => p.id !== partner.id),
      users: cur.users.filter((u) => u.partnerId !== partner.id),
      properties: cur.properties.map((p) => ({
        ...p,
        partners: p.partners.filter((pp) => pp.partnerId !== partner.id),
      })),
    });
    toast.success("Partner removed");
  };

  const resetPassword = (partner: Partner) => {
    const pwd = prompt(`Set a new password for ${partner.name}:`);
    if (!pwd) return;
    const cur = db.get();
    db.set({
      ...cur,
      users: cur.users.map((u) => (u.partnerId === partner.id ? { ...u, password: pwd } : u)),
    });
    toast.success("Password updated");
  };

  return (
    <div>
      <PageHeader
        title="Partners"
        subtitle="Create accounts so partners can sign in and view their share"
        icon={Users}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-brand"><Plus className="h-4 w-4 mr-1" /> Add Partner</Button>
            </DialogTrigger>
            <DialogContent className="glass border-none">
              <DialogHeader><DialogTitle>Add partner & create login</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div className="border-t border-white/40 pt-3">
                  <p className="text-xs text-muted-foreground mb-2">Login credentials for partner portal:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
                    <div><Label>Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="btn-brand" onClick={create}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {data.partners.length === 0 ? (
        <div className="glass p-10 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3" />
          No partners yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.partners.map((p) => {
            const user = data.users.find((u) => u.partnerId === p.id);
            const properties = data.properties.filter((prop) => prop.partners.some((pp) => pp.partnerId === p.id));
            return (
              <div key={p.id} className="glass p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] flex items-center justify-center text-white font-bold">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{p.name}</div>
                    {p.email && <div className="text-xs text-muted-foreground truncate">{p.email}</div>}
                    {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                  </div>
                </div>
                <div className="glass-soft p-2 text-xs mb-3">
                  <div className="text-muted-foreground">Login</div>
                  <div className="font-mono font-semibold">{user?.username ?? "—"}</div>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  In <span className="font-semibold text-foreground">{properties.length}</span> propert{properties.length === 1 ? "y" : "ies"}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => resetPassword(p)}>
                    <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Pass
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
