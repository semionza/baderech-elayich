"use client";

import { useEffect, useMemo, useState } from "react";

export default function InstallAsAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  const isIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod unanimous/i.test(navigator.userAgent.toLowerCase()) ||
      /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    // iOS + some browsers
    return (
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      // @ts-ignore
      window.navigator.standalone === true
    );
  }, []);

  useEffect(() => {
    setInstalled(isStandalone);
  }, [isStandalone]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", () => setInstalled(true));
    };
  }, []);

  if (installed) return null;

  // iOS: אין beforeinstallprompt
  if (isIOS && !deferredPrompt) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200">
        <div className="font-semibold mb-1">התקנה כאפליקציה</div>
        <div className="text-neutral-400 text-xs">
          באייפון: לחצו על כפתור השיתוף (□↑) ואז “הוסף למסך הבית”.
        </div>
      </div>
    );
  }

  // Android/Chrome: יש prompt
  if (!deferredPrompt) return null;

  return (
    <button
      className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-black font-semibold"
      onClick={async () => {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
      }}
    >
      Download as app
    </button>
  );
}
