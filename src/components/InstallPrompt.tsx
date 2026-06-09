import { useEffect, useState } from "react";
import { Download, X, Smartphone, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pm_install_dismissed_v1";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) { setInstalled(true); return; }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      if (!sessionStorage.getItem(DISMISS_KEY)) setOpen(true);
    };
    const onInstalled = () => { setInstalled(true); setOpen(false); };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // iOS doesn't fire beforeinstallprompt — show helper once
    if (isIOS() && !sessionStorage.getItem(DISMISS_KEY)) {
      const t = setTimeout(() => setOpen(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (isIOS()) { setShowIOSHelp(true); return; }
    if (!deferred) return;
    await deferred.prompt();
    const res = await deferred.userChoice;
    if (res.outcome === "accepted") setInstalled(true);
    setDeferred(null);
    setOpen(false);
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  if (installed) return null;

  const canShow = deferred || isIOS();

  return (
    <>
      {/* Floating button — visible whenever install is possible */}
      {canShow && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 lg:bottom-6 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] text-white font-semibold shadow-lg hover:scale-105 transition-transform"
          aria-label="Install app"
        >
          <Download className="h-4 w-4" />
          <span className="text-sm">Install App</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 p-3 rounded-2xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-green)] text-white w-fit">
              <Smartphone className="h-7 w-7" />
            </div>
            <DialogTitle className="text-center text-xl">
              Install Property Manage
            </DialogTitle>
            <DialogDescription className="text-center">
              Get a faster, app-like experience right on your home screen.
            </DialogDescription>
          </DialogHeader>

          {showIOSHelp || isIOS() ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground text-center">
                On iPhone/iPad, install from Safari:
              </p>
              <ol className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[var(--brand-blue)]">1.</span>
                  <span className="flex items-center gap-1">
                    Tap the <Share className="h-4 w-4 inline" /> <b>Share</b> button
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[var(--brand-blue)]">2.</span>
                  <span className="flex items-center gap-1">
                    Choose <Plus className="h-4 w-4 inline" /> <b>Add to Home Screen</b>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[var(--brand-blue)]">3.</span>
                  <span>Tap <b>Add</b> in the top-right</span>
                </li>
              </ol>
              <Button onClick={dismiss} variant="outline" className="w-full mt-2">
                Got it
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-2 px-2">
                <li className="flex gap-2">✓ Works offline-ready & loads instantly</li>
                <li className="flex gap-2">✓ Launches from your home screen</li>
                <li className="flex gap-2">✓ Full-screen, no browser bars</li>
              </ul>
              <div className="flex gap-2 pt-2">
                <Button onClick={dismiss} variant="outline" className="flex-1">
                  <X className="h-4 w-4 mr-1" /> Not now
                </Button>
                <Button onClick={install} className="flex-1 btn-brand">
                  <Download className="h-4 w-4 mr-1" /> Install
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
