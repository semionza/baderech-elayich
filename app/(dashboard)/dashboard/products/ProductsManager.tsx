"use client";

import { useState } from "react";

type DbProductRow = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
  service_area_id: string | null;
};

export default function ProductsManager({
  initialProducts,
}: {
  initialProducts: DbProductRow[];
}) {
  const [products, setProducts] = useState<DbProductRow[]>(initialProducts);
  const [name, setName] = useState("");
  const [priceIls, setPriceIls] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    if (!name.trim()) {
      setErrorMsg("שם מוצר חובה.");
      return;
    }
    const numericPrice = Number(
      priceIls.replace(",", ".").trim()
    );
    if (!numericPrice || numericPrice <= 0) {
      setErrorMsg("נא להזין מחיר תקין בשקלים.");
      return;
    }

    const priceInAgorot = Math.round(numericPrice * 100);

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: priceInAgorot,
          description: description.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Create product error:", data);
        setErrorMsg(
          data?.error || "שגיאה ביצירת מוצר חדש."
        );
        return;
      }

      if (!data?.product) {
        setErrorMsg("לא התקבלה תגובה תקינה מהשרת.");
        return;
      }

      setProducts((prev) => [...prev, data.product]);
      setName("");
      setPriceIls("");
      setDescription("");
      setSuccessMsg("המוצר נוצר בהצלחה.");
    } catch (e) {
      console.error(e);
      setErrorMsg("שגיאה כללית ביצירת מוצר.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: DbProductRow) {
    resetMessages();

    const newActive = !product.is_active;

    // אופטימיסטי – נעדכן UI לפני השרת
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, is_active: newActive } : p
      )
    );

    try {
      const res = await fetch(
        `/api/dashboard/products/${product.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: newActive }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Update product error:", data);
        setErrorMsg(
          data?.error || "שגיאה בעדכון מצב המוצר."
        );
        // להחזיר אחורה
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, is_active: product.is_active } : p
          )
        );
        return;
      }

      setSuccessMsg("המוצר עודכן בהצלחה.");
    } catch (e) {
      console.error(e);
      setErrorMsg("שגיאה כללית בעדכון מוצר.");
      // להחזיר אחורה
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_active: product.is_active } : p
        )
      );
    }
  }

  const sortedProducts = [...products].sort((a, b) =>
    a.name.localeCompare(b.name, "he")
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">
          מוצרים בגינה הנוכחית
        </h2>
        <p className="text-xs text-neutral-400">
          המערכת מזהה את הגינה לפי המשתמש המחובר (staff_members).
        </p>
      </div>

      {/* הודעות */}
      {errorMsg && (
        <div className="text-sm text-red-300 bg-red-950/60 border border-red-700 rounded px-3 py-2">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="text-sm text-emerald-200 bg-emerald-950/60 border border-emerald-700 rounded px-3 py-2">
          {successMsg}
        </div>
      )}

      {/* טופס הוספת מוצר */}
      <form
        onSubmit={handleCreateProduct}
        className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 space-y-3"
      >
        <h3 className="text-sm font-semibold mb-1">
          הוספת מוצר חדש
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-neutral-300 mb-1">
              שם מוצר
            </label>
            <input
              type="text"
              className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm text-neutral-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: אמריקנו"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-300 mb-1">
              מחיר (₪)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm text-neutral-100"
              value={priceIls}
              onChange={(e) => setPriceIls(e.target.value)}
              placeholder="לדוגמה: 12"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-300 mb-1">
              תיאור (אופציונלי)
            </label>
            <input
              type="text"
              className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm text-neutral-100"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="לדוגמה: חם / קר, גודל כוס"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary mt-2 px-4 py-2 text-sm"
        >
          {saving ? "שומר..." : "שמור מוצר חדש"}
        </button>
      </form>

      {/* רשימת מוצרים */}
      <div className="table-wrapper">
        <table className="table">
          <thead className="table-head">
            <tr>
              <th className="table-th">שם</th>
              <th className="table-th">מחיר</th>
              <th className="table-th hidden sm:table-cell">
                תיאור
              </th>
              <th className="table-th">סטטוס</th>
              <th className="table-th">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-900">
                <td className="table-td text-sm">{p.name}</td>
                <td className="table-td text-sm whitespace-nowrap">
                  {(p.price / 100).toFixed(2)} ₪
                </td>
                <td className="table-td hidden sm:table-cell text-xs text-neutral-300">
                  {p.description || "-"}
                </td>
                <td className="table-td text-xs">
                  <span
                    className={
                      "status-badge " +
                      (p.is_active ? "status-accepted" : "status-cancelled")
                    }
                  >
                    {p.is_active ? "פעיל" : "לא פעיל"}
                  </span>
                </td>
                <td className="table-td text-xs">
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className={
                      "btn px-3 py-1 " +
                      (p.is_active ? "btn-gray" : "btn-blue")
                    }
                  >
                    {p.is_active ? "כבה" : "הפעל"}
                  </button>
                </td>
              </tr>
            ))}

            {sortedProducts.length === 0 && (
              <tr>
                <td
                  className="table-td text-center text-xs text-neutral-400"
                  colSpan={5}
                >
                  אין עדיין מוצרים לגינה הזו.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
