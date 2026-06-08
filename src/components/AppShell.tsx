import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Building2, Users, UserCircle2 } from "lucide-react";
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

  const displayName = partner?.name ?? user?.username ?? "?";

  return (
    <div className="min-h-screen flex">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 p-4 gap-4 sticky top-0 h-screen">
        <div className="glass p-4 flex items-center gap-3">
          <img src="/logo.png" alt="Property Manage" className="h-12 w-12 object-contain" />
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
                  active ? "btn-brand" : "text-foreground/80 hover:bg-white/40"
                }`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="glass p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] flex items-center justify-center text-white font-semibold shrink-0">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground capitalize">{session.role}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { logout(); navigate({ to: "/login" }); }}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top header */}
        <div className="lg:hidden sticky top-0 z-20 glass-soft mx-3 mt-3 mb-0 px-4 py-3 flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
          <div className="font-bold text-sm text-gradient flex-1">PROPERTY MANAGE</div>
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] flex items-center justify-center text-white text-xs font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        </div>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-white/30">
        <div className="flex items-stretch">
          {links.map((l) => {
            const active =
              location === l.to || (l.to !== "/admin" && location.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-[var(--brand-blue)]"
                    : "text-foreground/50 hover:text-foreground/80"
                }`}
              >
                <l.icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                {l.label}
              </Link>
            );
          })}
          {/* Logout tab */}
          <button
            onClick={() => { logout(); navigate({ to: "/login" }); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-foreground/50 hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </nav>
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
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest">
          {Icon && <Icon className="h-3.5 w-3.5" />} Portal
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gradient leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
