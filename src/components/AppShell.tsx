import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Building2, Users, UserCircle2 } from "lucide-react";
import logoAsset from "@/assets/logo.asset.json";
import { logout, useSession, useDB } from "@/lib/store";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const db = useDB();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location.pathname });

  if (!session) return <>{children}</>;

  const user = db.users.find((u) => u.id === session.userId);
  const partner = session.partnerId ? db.partners.find((p) => p.id === session.partnerId) : null;

  const adminLinks = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/properties", label: "Properties", icon: Building2 },
    { to: "/admin/partners", label: "Partners", icon: Users },
  ] as const;

  const partnerLinks = [
    { to: "/partner", label: "My Portfolio", icon: LayoutDashboard },
  ] as const;

  const links = session.role === "admin" ? adminLinks : partnerLinks;

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex flex-col w-64 p-4 gap-4 sticky top-0 h-screen">
        <div className="glass p-4 flex items-center gap-3">
          <img src={logoAsset.url} alt="Property Manage" className="h-12 w-12 object-contain" />
          <div className="leading-tight">
            <div className="font-bold text-sm text-gradient">PROPERTY</div>
            <div className="text-xs font-semibold text-accent">MANAGE</div>
          </div>
        </div>

        <nav className="glass p-2 flex flex-col gap-1 flex-1">
          {links.map((l) => {
            const active =
              location === l.to || (l.to !== "/admin" && location.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? "btn-brand"
                    : "text-foreground/80 hover:bg-white/40"
                }`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="glass p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] flex items-center justify-center text-white font-semibold">
            {(partner?.name ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {partner?.name ?? user?.username}
            </div>
            <div className="text-xs text-muted-foreground capitalize">{session.role}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-20 glass-soft m-3 p-3 flex items-center gap-3">
          <img src={logoAsset.url} alt="" className="h-8 w-8" />
          <div className="font-bold text-sm text-gradient flex-1">PROPERTY MANAGE</div>
          <Button size="icon" variant="ghost" onClick={() => { logout(); navigate({ to: "/login" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="lg:hidden px-3 pb-3 flex gap-2 overflow-x-auto">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="glass-soft px-3 py-2 text-xs font-medium whitespace-nowrap flex items-center gap-2">
              <l.icon className="h-3.5 w-3.5" /> {l.label}
            </Link>
          ))}
        </div>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: typeof UserCircle2;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest">
          {Icon && <Icon className="h-3.5 w-3.5" />} Portal
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gradient">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
