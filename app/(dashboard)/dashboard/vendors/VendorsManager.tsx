"use client";

import { useEffect, useState } from "react";
import VendorLogoUploader from "../../vendors/VendorLogoUploader";

type Vendor = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  image_path?: string | null;
};

export default function VendorsManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadVendors() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load vendors");
      setVendors(data.vendors ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
  }, []);

  function suggestSlug(v: string) {
    return v
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  async function createVendor() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create vendor");

      setName("");
      setSlug("");
      setVendors((prev) => [data.vendor, ...prev]);
    } catch (e: any) {
      setError(e.message || "Failed to create vendor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <h2 className="text-sm font-semibold">הוספת ונדור חדש</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="block text-xs text-neutral-400 mb-1">שם</label>
          <input
            className="w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-100"
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              if (!slug) setSlug(suggestSlug(v));
            }}
            placeholder='למשל: "חנות פרחים"'
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs text-neutral-400 mb-1">Slug</label>
          <input
            className="w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-100 font-mono"
            value={slug}
            onChange={(e) => setSlug(suggestSlug(e.target.value))}
            placeholder="flower-shop"
          />
          <div className="mt-1 text-[11px] text-neutral-500">
            רק אותיות קטנות/מספרים/מקף
          </div>
        </div>

        <div className="sm:col-span-1 flex items-end h-[55px]">
          <button
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
            disabled={busy || !name.trim() || !slug.trim()}
            onClick={createVendor}
          >
            {busy ? "יוצר..." : "צור ונדור"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-300">{error}</div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">ונדורים קיימים</h2>
        <button
          className="rounded-lg border border-neutral-800 bg-black px-3 py-1.5 text-xs text-neutral-200"
          onClick={loadVendors}
          disabled={loading}
        >
          רענן
        </button>
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-neutral-400">טוען…</div>
      ) : vendors.length === 0 ? (
        <div className="mt-3 text-sm text-neutral-400">
          אין ונדורים עדיין.
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-200">
              <tr>
                <th className="p-2 text-left">שם</th>
                <th className="p-2 text-left">slug</th>
                <th className="p-2 text-left">סטטוס</th>
                <th className="p-2 text-left">נוצר</th>
                <th className="p-2 text-left">"העלה/החלף לוגו"</th>
                <th className="p-2 text-left">לוגו</th>
              </tr>
            </thead>
            <tbody className="bg-black text-neutral-100">
              {vendors.map((v) => (
                <tr key={v.id} className="border-t border-neutral-900">
                  <td className="p-2">{v.name}</td>
                  <td className="p-2 font-mono text-xs">{v.slug}</td>
                  <td className="p-2">
                    <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-200">
                      {v.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-neutral-400">
                    {new Date(v.created_at).toLocaleString()}
                  </td>
                  <td className="p-2"> 
                  <VendorLogoUploader
                    vendorId={v.id}
                    onUploaded={(url) => {
                        setVendors(prev =>
                        prev.map(x => x.id === v.id ? { ...x, image_url: url } : x)
                        );
                    }}
                  />
                  </td>
                  <td className="p-2">
                    {v.image_path ? (
                      <img
                        src={`${v.image_path}`}
                        alt="Vendor Logo"
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <span className="text-xs text-neutral-500">No logo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
