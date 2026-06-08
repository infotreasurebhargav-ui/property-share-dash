import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession, useDB, useSession, propertySummary, formatINR } from "@/lib/store";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Building2, LayoutDashboard, TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";

export const Route = createFileRoute("/partner")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = getSession();
    if (!s) throw redirect({ to: "/login" });
    if (s.role !== "partner") throw redirect({ to: "/admin" });
  },
  component: () => (
    <AppShell>
      <PartnerHome />
    </AppShell>
  ),
});

function PartnerHome() {
  const session = useSession();
  const data = useDB();
  const partner = data.partners.find((p) => p.id === session?.partnerId);
  const myProps = data.properties
    .map((p) => {
      const me = p.partners.find((pp) => pp.partnerId === session?.partnerId);
      if (!me) return null;
      const s = propertySummary(p.id, data.transactions);
      return {
        property: p,
        percent: me.percent,
        income: (s.income * me.percent) / 100,
        expense: (s.expense * me.percent) / 100,
        net: (s.net * me.percent) / 100,
        rentShare: (p.monthlyRent * me.percent) / 100,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totals = myProps.reduce(
    (a, x) => ({
      income: a.income + x.income,
      expense: a.expense + x.expense,
      net: a.net + x.net,
      rent: a.rent + x.rentShare,
    }),
    { income: 0, expense: 0, net: 0, rent: 0 },
  );

  return (
    <div>
      <PageHeader
        title={`Welcome, ${partner?.name ?? ""}`}
        subtitle="Your portfolio at a glance"
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Properties" value={String(myProps.length)} icon={Building2} tone="from-[var(--brand-blue)] to-[var(--brand-navy)]" />
        <Stat label="Your Monthly Rent" value={formatINR(totals.rent)} icon={Wallet} tone="from-emerald-500 to-[var(--brand-green)]" />
        <Stat label="Income Share" value={formatINR(totals.income)} icon={TrendingUp} tone="from-[var(--brand-green)] to-[var(--brand-blue)]" />
        <Stat label="Net Earnings" value={formatINR(totals.net)} icon={TrendingDown} tone="from-[var(--brand-navy)] to-[var(--brand-blue)]" />
      </div>

      <h2 className="text-xl font-bold mb-3">My Properties</h2>
      {myProps.length === 0 ? (
        <div className="glass p-10 text-center text-muted-foreground">
          You are not yet a partner in any property.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myProps.map(({ property, percent, income, expense, net, rentShare }) => (
            <div key={property.id} className="glass p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground uppercase">{property.type}</div>
                  <div className="font-bold truncate">{property.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{property.address}</div>
                </div>
                <div className="text-xs px-2 py-1 rounded-md font-semibold bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] text-white flex items-center gap-1">
                  <Percent className="h-3 w-3" /> {percent}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="glass-soft p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Rent share</div>
                  <div className="text-sm font-bold">{formatINR(rentShare)}</div>
                </div>
                <div className="glass-soft p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Net</div>
                  <div className="text-sm font-bold">{formatINR(net)}</div>
                </div>
                <div className="glass-soft p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Income</div>
                  <div className="text-sm font-bold text-emerald-700">{formatINR(income)}</div>
                </div>
                <div className="glass-soft p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Expense</div>
                  <div className="text-sm font-bold text-red-700">{formatINR(expense)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="glass p-5">
      <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${tone} text-white mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-xl md:text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
