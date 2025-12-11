"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

function buildGoogleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

type WaiterOrderRow = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer_phone: string;
  customer_note: string | null;
  lat: number | null;
  lng: number | null;
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
  ON_THE_WAY: "בדרך ללקוח",
  DELIVERED: "סופקה",
};

export default function WaiterView({ orders }: { orders: WaiterOrderRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatAmount = (amount: number) =>
    (amount / 100).toFixed(2) + " ₪";

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const refresh = () =>
    startTransition(() => {
      router.refresh();
    });

  async function updateOrder(
    orderId: string,
    updates: { status?: string; paymentStatus?: string },
    options?: { sendSmsOnPaid?: boolean }
  ) {
    try {
      setBusyId(orderId);
      setErrorMsg(null);

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updates.status,
          paymentStatus: updates.paymentStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error(data);
        setErrorMsg(data.error || "שגיאה בעדכון ההזמנה");
        return;
      }

      // שליחת SMS לאחר סימון תשלום שהתקבל (פשוט למימוש בהמשך)
      if (options?.sendSmsOnPaid) {
        try {
          await fetch("/api/sms/payment-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
        } catch (e) {
          console.error("SMS error:", e);
        }
      }

      refresh();
    } catch (e) {
      console.error(e);
      setErrorMsg("שגיאה כללית בעדכון");
    } finally {
      setBusyId(null);
    }
  }

  if (!orders.length) {
    return (
      <div className="p-3 text-sm text-neutral-400">
        אין כרגע הזמנות פתוחות.
        <button
          onClick={refresh}
          disabled={isPending}
          className="ml-2 px-3 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700"
        >
          רענון
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">מסך מלצר</h1>
          <p className="text-xs text-neutral-400">
            הזמנות פתוחות לגינה הנוכחית
          </p>
        </div>

        <a
          href="/bit-qr.jpeg"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost text-xs px-3 py-1"
        >
          הצג QR לתשלום בביט
        </a>
      </header>

      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-neutral-400">
          {orders.length} הזמנות ממתינות
        </span>
        <button
          onClick={refresh}
          disabled={isPending}
          className="px-3 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "מרענן..." : "רענן"}
        </button>
      </div>

      {errorMsg && (
        <div className="text-sm text-red-400 bg-red-950 border border-red-700 rounded p-2">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          const isBusy = busyId === order.id;
          const statusLabel =
            STATUS_LABELS[order.status] || order.status;

          return (
            <div
              key={order.id}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 space-y-2"
            >
              <div className="flex justify-between items-center text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-neutral-500">
                    {formatTime(order.created_at)}
                  </span>
                  <span className="text-xs text-neutral-500">
                    אזור: {order.service_areas?.[0]?.name} (
                    {order.service_areas?.[0]?.slug})
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {formatAmount(order.total_amount)}
                  </div>
                  <div className="text-xs text-neutral-400">
                    סטטוס: {statusLabel}
                  </div>
                  <div className="text-xs text-neutral-400">
                    תשלום:{" "}
                    {order.payment_status === "PAID"
                      ? "שולם"
                      : "מזומן - טרם שולם"}
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-2 text-sm">
                <div className="font-semibold mb-1">
                  פריטים:
                </div>
                <ul className="space-y-1">
                  {order.order_items.map((item, i) => (
                    <li
                      key={i}
                      className="flex justify-between text-xs"
                    >
                      <span>{item.name}</span>
                      <span className="text-neutral-400">
                        × {item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-neutral-800 pt-2 text-xs space-y-1">
                <div>
                  טלפון לקוח:{" "}
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="font-mono text-emerald-300 underline"
                  >
                    {order.customer_phone}
                  </a>
                </div>
                {order.customer_note && (
                  <div>
                    הערה:{" "}
                    <span className="text-neutral-300">
                      {order.customer_note}
                    </span>
                </div>
                )}
                {order.lat && order.lng && (
                  <div>
                    מיקום: {order.lat.toFixed(5)},{" "}
                    {order.lng.toFixed(5)}
                      <div className="flex flex-wrap gap-2 mt-1">
                        <a
                          href={buildGoogleMapsUrl(order.lat, order.lng)}
                          target="_blank"
                          className="btn btn-outline text-xs px-3 py-1"
                        >
                          ניווט ב-Google Maps
                        </a>
                      </div>
                  </div>

                )}
              </div>

              {/* כפתורי פעולה */}
              <div className="pt-2 flex gap-2 text-xs">
                {order.status === "PENDING" && (
                  <button
                    onClick={() =>
                      updateOrder(order.id, { status: "ON_THE_WAY" })
                    }
                    disabled={isBusy}
                    className="flex-1 px-2 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700"
                  >
                    אני בדרך
                  </button>
                )}

                {order.status === "ON_THE_WAY" && (
                  <>
                    <button
                      onClick={() =>
                        updateOrder(order.id, {
                          paymentStatus: "PAID",
                        })
                      }
                      disabled={
                        isBusy || order.payment_status === "PAID"
                      }
                      className="flex-1 px-2 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700"
                    >
                      קיבלתי מזומן
                    </button>
                    <button
                      onClick={() =>
                        updateOrder(
                          order.id,
                          {
                            status: "DELIVERED",
                            paymentStatus:
                              order.payment_status === "PAID"
                                ? undefined
                                : "PAID",
                          },
                          {
                            sendSmsOnPaid: true,
                          }
                        )
                      }
                      disabled={isBusy}
                      className="flex-1 px-2 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700"
                    >
                      סופק + SMS
                    </button>
                  </>
                )}

                {order.status === "ACCEPTED" && (
                  <button
                    onClick={() =>
                      updateOrder(order.id, { status: "ON_THE_WAY" })
                    }
                    disabled={isBusy}
                    className="flex-1 px-2 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700"
                  >
                    בדרך ללקוח
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
