import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getSession } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/login", replace: true });
    else if (s.role === "admin") navigate({ to: "/admin", replace: true });
    else navigate({ to: "/partner", replace: true });
  }, [navigate]);
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}
