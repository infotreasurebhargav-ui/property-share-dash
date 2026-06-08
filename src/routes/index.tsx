import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = getSession();
    if (!s) throw redirect({ to: "/login" });
    if (s.role === "admin") throw redirect({ to: "/admin" });
    throw redirect({ to: "/partner" });
  },
  component: () => null,
});
