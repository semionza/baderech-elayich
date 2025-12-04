// app/(dashboard)/dashboard/orders/OrdersTable.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";

type DbOrderRow = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer_phone: string;
  customer_note: string | null;
  service_areas: {
    name: string;
    slug: string;
  }[];
  order_items: {
    name: string;
    quantity: number;
  }[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "התקבלה",
  ACCEPTED: "בטיפול",
  IN_PROGRESS: "בהכנה",
  ON_THE_WAY: "בדרך",
  DELIVERED: "סופקה",
  CANCELLED: "בוטלה",
};

const STATUS_FILTERS = [
  { value: "", label: "הכול" },
  { value: "PENDING", label: "התקבלה" },
  { value: "ACCEPTED", label: "בטיפול" },
  { value: "ON_THE_WAY", label: "בדרך" },
  { value: "DELIVERED", label: "סופקה" },
];

export default function OrdersTable({
  orders,
  statusFilter,
}: {
  orders: DbOrderRow[];
  statusFilter: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const formatAmount = (amount: number) =>
    (amount / 100).toFixed(2) + " ₪";

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  function applyFilter(value: string) {
    const current = new URLSearchParams(searchParams.toString());

    if (!value) current.delete("status");
    else current.set("status", value);

    // עדכון URL בלי רענון מלא
    router.push(`/dashboard/orders?${current.toString()}`);
    router.refresh();
  }

  async function updateStatus(orderId: string, status: string) {
    try {
      setUpdatingId(orderId);
      setErrorMsg(null);

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "שגיאה בעדכון הסטטוס");
        return;
      }

      router.refresh();
    } catch (e) {
      console.error(e);
      setErrorMsg("שגיאה כללית בעדכון סטטוס");
    } finally {
      setUpdatingId(null);
    }
  }

  const renderActions = (order: DbOrderRow) => {
    const curr = order.status;

    const buttons: { label: string; status: string }[] = [];

    if (curr === "PENDING") {
      buttons.push({ label: "קיבלתי", status: "ACCEPTED" });
    }
    if (curr === "ACCEPTED" || curr === "PENDING") {
      buttons.push({ label: "בדרך", status: "ON_THE_WAY" });
    }
    if (curr !== "DELIVERED" && curr !== "CANCELLED") {
      buttons.push({ label: "סופק", status: "DELIVERED" });
    }

    return (
      <div className="flex flex-col gap-1">
        {buttons.map((btn) => (
          <button
            key={btn.status}
            type="button"
            onClick={() => updateStatus(order.id, btn.status)}
            disabled={!!updatingId}
            className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-400"
          >
            {btn.label}
          </button>
        ))}
      </div>
    );
  };

  async function markAsPaid(orderId: string) {
    try {
      setUpdatingId(orderId);
      setErrorMsg(null);

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "PAID" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "שגיאה בעדכון סטטוס התשלום");
        return;
      }

      router.refresh();
    } catch (e) {
      console.error(e);
      setErrorMsg("שגיאה כללית בעדכון התשלום");
    } finally {
      setUpdatingId(null);
    }
  }


  return (
    <div className="space-y-4">
      {/* 🔥 פילטרים */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500 mr-2">סינון לפי סטטוס: </span>

        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => applyFilter(f.value)}
            className={`px-3 py-1 text-sm rounded border ${
              statusFilter === f.value || (!statusFilter && f.value === "")
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white hover:bg-slate-100"
            }`}
          >
            {f.label}
          </button>
        ))}

        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="ml-auto px-3 py-1 text-sm rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-50"
        >
          {isPending ? "מרענן..." : "רענן"}
        </button>
      </div>

      {/* טבלה */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-right p-2 border-b">#</th>
              <th className="text-right p-2 border-b">זמן</th>
              <th className="text-right p-2 border-b">אזור</th>
              <th className="text-right p-2 border-b">טלפון</th>
              <th className="text-right p-2 border-b">פריטים</th>
              <th className="text-right p-2 border-b">סכום</th>
              <th className="text-right p-2 border-b">סטטוס</th>
              <th className="text-right p-2 border-b">תשלום</th>
              <th className="text-right p-2 border-b">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, idx) => (
              <tr key={order.id} className="hover:bg-slate-50 align-top">
                <td className="p-2 border-b text-slate-500">{idx + 1}</td>
                <td className="p-2 border-b whitespace-nowrap">
                  {formatDateTime(order.created_at)}
                </td>
                <td className="p-2 border-b whitespace-nowrap">
                  {order.service_areas?.[0]?.name ?? "-"}
                  <div className="text-xs text-slate-400">
                    {order.service_areas?.[0]?.slug}
                  </div>
                </td>
                <td className="p-2 border-b whitespace-nowrap">
                  {order.customer_phone}
                  {order.customer_note && (
                    <div className="text-xs text-slate-500 mt-1">
                      {order.customer_note}
                    </div>
                  )}
                </td>
                <td className="p-2 border-b">
                  <ul className="space-y-1">
                    {order.order_items.map((item, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="text-slate-700">{item.name}</span>
                        <span className="text-slate-500">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="p-2 border-b whitespace-nowrap font-semibold">
                  {formatAmount(order.total_amount)}
                </td>
                <td className="p-2 border-b">
                  <span className="inline-block px-2 py-1 text-xs rounded bg-slate-100">
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </td>
                <td className="p-2 border-b border-neutral-800">
                  <div className="flex flex-col gap-1 items-start">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded ${
                        order.payment_status === "PAID"
                          ? "bg-emerald-900 text-emerald-300"
                          : order.payment_status === "FAILED"
                          ? "bg-red-900 text-red-300"
                          : "bg-neutral-800 text-neutral-200"
                      }`}
                    >
                      {order.payment_status}
                    </span>

                    {order.payment_status === "UNPAID" && (
                      <button
                        type="button"
                        onClick={() => markAsPaid(order.id)}
                        disabled={!!updatingId}
                        className="mt-1 text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:bg-neutral-600"
                      >
                        סמן כשולם (ביט)
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-2 border-b">{renderActions(order)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errorMsg && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
