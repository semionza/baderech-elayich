"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallAsAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  const isIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore
      window.navigator.standalone === true
    );
  }, []);

  useEffect(() => {
    setInstalled(isStandalone);
  }, [isStandalone]);

  useEffect(() => {
    const handler = (e: Event) => {
      // חשוב: למנוע את ה־prompt האוטומטי
      e.preventDefault();

      // שמירה עם cast בטוח
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", () => setInstalled(true));
    };
  }, []);

  console.log("PWA installed:", installed, "deferredPrompt:", deferredPrompt);

  // כבר מותקן → לא להציג
  if (installed) return null;

  // iOS – אין beforeinstallprompt
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

  // אין prompt זמין (Chrome החליט שעדיין לא installable)
  if (!deferredPrompt) return null;

  return (
    <button
      className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-black font-semibold"
      onClick={async () => {
        try {
          // 🔑 כאן זה בטוח
          await deferredPrompt.prompt();

          const choice = await deferredPrompt.userChoice;
          console.log("PWA install choice:", choice);

          setDeferredPrompt(null);
        } catch (err) {
          console.error("PWA prompt failed", err);
        }
      }}
    >
      Download as app
    </button>
  );
}
