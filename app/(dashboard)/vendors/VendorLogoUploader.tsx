"use client";
import { useState } from "react";

interface VendorLogoUploaderProps {
  vendorId: string;
  onUploaded?: (publicUrl: string) => void;
}

export default function VendorLogoUploader({ vendorId, onUploaded }: VendorLogoUploaderProps) {
  const [busy, setBusy] = useState(false);

  if (!vendorId) {
    return (
      <div className="text-xs text-red-400">
        Vendor ID missing
      </div>
    );
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/vendors/${vendorId}/logo`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded?.(data.publicUrl);
    } catch (err:any) {
      alert(err.message || "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <label className="inline-block">
      <input type="file" accept="image/*" onChange={onFileChange} className="" />
      {busy ? "מעלה…" : ""} 
    </label>
  );
}
