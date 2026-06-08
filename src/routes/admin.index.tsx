import { createFileRoute, Link } from "@tanstack/react-router";
import { useDB, propertySummary, formatINR, totalPercent, effectiveRent } from "@/lib/store";
import { PageHeader } from "@/components/AppShell";
import { Building2, Users, TrendingUp, TrendingDown, ArrowRight, LayoutDashboard, AlertTriangle, Layers } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const data = useDB();
  const totals = data.properties.reduce(
    (acc, p) => {
      const s = propertySummary(p.id, data.transactions);
      acc.income += s.income;
      acc.expense += s.expense;
      acc.rent += effectiveRent(p);
      return acc;
    },
    { income: 0, expense: 0, rent: 0 },
  );

  const incomplete = data.properties.filter((p) => totalPercent(p) !== 100);

  const stats = [
    { label: "Properties", value: data.properties.length, icon: Building2, tone: "from-[var(--brand-blue)] to-[var(--brand-navy)]" },
    { label: "Partners", value: data.partners.length, icon: Users, tone: "from-[var(--brand-green)] to-[var(--brand-blue)]" },
    { label: "Monthly Rent Roll", value: formatINR(totals.rent), icon: TrendingUp, tone: "from-[var(--brand-green)] to-emerald-500" },
    { label: "Net Cash (all time)", value: formatINR(totals.income - totals.expense), icon: TrendingDown, tone: "from-[var(--brand-navy)] to-[var(--brand-blue)]" },
  ];

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Overview of your entire property portfolio"
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="glass p-5">
            <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${s.tone} text-white mb-3`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
            <div className="text-xl md:text-2xl font-bold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {incomplete.length > 0 && (
        <div className="glass p-4 mb-6 border-l-4 border-l-amber-500 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-sm">Partnership not balanced</div>
            <p className="text-xs text-muted-foreground">
              {incomplete.length} {incomplete.length === 1 ? "property does" : "properties do"} not total 100% partnership.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Properties</h2>
        <Link to="/admin/properties" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
          Manage all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {data.properties.length === 0 ? (
        <div className="glass p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No properties yet. Add your first one.</p>
          <Link to="/admin/properties" className="btn-brand inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold">
            <Building2 className="h-4 w-4" /> Add property
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.properties.map((p) => {
            const s = propertySummary(p.id, data.transactions);
            const pct = totalPercent(p);
            const rent = effectiveRent(p);
            const unitCount = (p.units ?? []).length;
            return (
              <Link
                key={p.id}
                to="/admin/properties/$id"
                params={{ id: p.id }}
                className="glass p-5 hover:scale-[1.01] transition group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground uppercase">{p.type}</div>
                      {unitCount > 0 && (
                        <span className="text-[10px] flex items-center gap-0.5 text-[var(--brand-blue)] font-semibold">
                          <Layers className="h-3 w-3" /> {unitCount} unit{unitCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="font-bold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-md font-semibold shrink-0 ${pct === 100 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {pct}%
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="glass-soft p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Rent</div>
                    <div className="text-sm font-bold">{formatINR(rent)}</div>
                  </div>
                  <div className="glass-soft p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Income</div>
                    <div className="text-sm font-bold text-emerald-700">{formatINR(s.income)}</div>
                  </div>
                  <div className="glass-soft p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Net</div>
                    <div className={`text-sm font-bold ${s.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatINR(s.net)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
