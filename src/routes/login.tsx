import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/logo.asset.json";
import { Lock, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Property Manage" },
      { name: "description", content: "Sign in to the Property Manage admin portal." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const s = login(username.trim(), password);
    setLoading(false);
    if (!s) {
      toast.error("Invalid username or password");
      return;
    }
    toast.success(`Welcome ${username}`);
    navigate({ to: s.role === "admin" ? "/admin" : "/partner" });
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="glass p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <img src={logoAsset.url} alt="Property Manage" className="h-24 w-24 object-contain mb-2" />
            <h1 className="text-2xl font-bold text-gradient">Property Manage</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Smart portal to manage properties, partners & rent
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u">Username</Label>
              <div className="relative">
                <UserIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="u"
                  className="pl-9 bg-white/60"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="p"
                  type="password"
                  className="pl-9 bg-white/60"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full btn-brand h-11" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Admin demo: <span className="font-mono font-semibold">admin / 123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
