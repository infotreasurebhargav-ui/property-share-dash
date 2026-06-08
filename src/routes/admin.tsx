import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = getSession();
    if (!s) throw redirect({ to: "/login" });
    if (s.role !== "admin") throw redirect({ to: "/partner" });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
