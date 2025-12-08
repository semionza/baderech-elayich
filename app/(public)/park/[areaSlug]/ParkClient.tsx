"use client";

import { useEffect, useState, useMemo } from "react";

type Area = {
  id: string;
  name: string;
  slug: string;
  polygon: any;
};

type Product = {
  id: string;
  name: string;
  price: number; // באגורות
  description?: string;
  image_url?: string;
};

type Props = {
  areaSlug: string;
  area: Area;
  products: Product[];
};

type GeoStatus = "checking" | "granted" | "denied" | "not-supported";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "הזמנה התקבלה",
  ACCEPTED: "ההזמנה בטיפול",
  IN_PROGRESS: "מכינים עבורך",
  ON_THE_WAY: "ההזמנה בדרך אליך",
  DELIVERED: "ההזמנה סופקה",
  CANCELLED: "ההזמנה בוטלה",
};

export default function ParkClient({ areaSlug, area, products }: Props) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("checking");
  const [allowed, setAllowed] = useState<null | boolean>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // cart[productId] = quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // 🔹 מעקב אחרי הזמנה פעילה
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderStatus, setActiveOrderStatus] = useState<string | null>(
    null
  );

  // ========== גיאולוקציה + בדיקת אזור שירות ==========
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("not-supported");
      setLocationError("המכשיר לא תומך במיקום.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoStatus("granted");

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });

        try {
          const res = await fetch("/api/validate-location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ areaSlug, lat, lng }),
          });

          const data = await res.json();

          if (data.allowed) {
            setAllowed(true);
          } else {
            setAllowed(false);
            setLocationError(
              "נראה שאתה מחוץ לאזור השירות של הגינה הזאת."
            );
          }
        } catch (e) {
          console.error(e);
          setAllowed(false);
          setLocationError("שגיאה בבדיקת המיקום.");
        }
      },
      (err) => {
        console.error("Geo error:", err);
        setGeoStatus("denied");
        setLocationError("לא ניתן לקבל אישור למיקום.");
      }
    );
  }, [areaSlug]);

  const canOrder = geoStatus === "granted" && allowed === true;

  // ========== לוגיקת עגלה ==========

  function increment(productId: string) {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));
  }

  function decrement(productId: string) {
    setCart((prev) => {
      const current = prev[productId] ?? 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: current - 1 };
    });
  }

  const cartItems = useMemo(
    () =>
      products
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((p) => ({
          productId: p.id,
          name: p.name,
          price: p.price,
          quantity: cart[p.id],
        })),
    [products, cart]
  );

  const totalItems = useMemo(
    () => cartItems.reduce((sum, it) => sum + it.quantity, 0),
    [cartItems]
  );

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, it) => sum + it.quantity * it.price, 0),
    [cartItems]
  );

  const formattedTotal = (totalAmount / 100).toFixed(2) + " ₪";

  // ========== שליחת הזמנה ל-API ==========

  async function handlePlaceOrder() {
    setIsPlacingOrder(true);
    setOrderError(null);
    setOrderResult(null);

    try {
      if (!canOrder) {
        setOrderError("לא ניתן להזמין מהמיקום הנוכחי.");
        return;
      }

      if (!customerPhone.trim()) {
        setOrderError("נא להזין מספר טלפון.");
        return;
      }

      if (cartItems.length === 0) {
        setOrderError("העגלה ריקה.");
        return;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaSlug,
          customerPhone: customerPhone.trim(),
          customerNote: customerNote.trim() || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          items: cartItems.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Order error:", data);
        setOrderError(data.error || "שגיאה בהזמנה");
        return;
      }

      setOrderResult(data);
      setActiveOrderId(data.orderId || null);
      setActiveOrderStatus(data.status || null);

      // נשמור מזהה הזמנה אחרון ב-localStorage כדי שאפשר יהיה לראות אחרי רענון
      if (data.orderId) {
        try {
          localStorage.setItem("lastOrderId", data.orderId);
        } catch {}
      }

      // מנקים עגלה אחרי הזמנה מוצלחת
      setCart({});
      setCustomerNote("");
      // טלפון נשאיר – נוח ללקוח
    } catch (e) {
      console.error(e);
      setOrderError("שגיאה כללית בזמן ההזמנה");
    } finally {
      setIsPlacingOrder(false);
    }
  }

  const isOrderButtonDisabled =
    !canOrder || isPlacingOrder || totalItems === 0 || !customerPhone.trim();

  // ========== Polling לסטטוס ההזמנה ==========
  useEffect(() => {
    // נטען הזמנה אחרונה מ-localStorage (אם יש) – רק פעם ראשונה
    try {
      const stored = localStorage.getItem("lastOrderId");
      if (stored && !activeOrderId) {
        setActiveOrderId(stored);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeOrderId) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${activeOrderId}`);
        const data = await res.json();

        if (!res.ok) {
          console.error("Status fetch error:", data);
          return;
        }

        if (!cancelled) {
          setActiveOrderStatus(data.status);
          // אם סופק או בוטל – אפשר לעצור מעקב
          if (data.status === "DELIVERED" || data.status === "CANCELLED") {
            // אפשר להשאיר את הסטטוס על המסך, אבל להפסיק polling
            if (intervalId) {
              clearInterval(intervalId);
            }
          }
        }
      } catch (e) {
        console.error("Status polling error:", e);
      }
    };

    // נעדכן מיד ואז כל 10 שניות
    fetchStatus();
    intervalId = window.setInterval(fetchStatus, 10000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeOrderId]);

  const statusLabel =
    (activeOrderStatus && STATUS_LABELS[activeOrderStatus]) ||
    (activeOrderId ? "בודק סטטוס..." : null);

  // ========== UI ==========

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold mb-1">{area.name}</h1>
        <p className="text-neutral-400 text-sm">
          גינה: <span className="font-mono">{areaSlug}</span>
        </p>
      </header>

      {/* תפריט מוצרים + כפתורי + / - */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold">תפריט</h2>

        {allowed === false && (
          <p className="mb-3 text-sm text-red-400">
            {locationError ??
              "אי אפשר להזמין מהמיקום הנוכחי שלך."}
          </p>
        )}

        {allowed === null && (
          <p className="mb-3 text-sm text-neutral-400">
            בודק את המיקום שלך...
          </p>
        )}

        <ul className="space-y-3">
          {products.map((product) => {
            const qty = cart[product.id] ?? 0;

            return (
              <li
                key={product.id}
                className="flex items-center justify-between border-b border-neutral-800 pb-2 last:border-none gap-3"
              >
                <div className="flex-1">
                  <div className="font-medium text-neutral-100">
                    {product.name}
                  </div>
                  {product.description && (
                    <div className="text-sm text-neutral-400">
                      {product.description}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-neutral-100">
                    {(product.price / 100).toFixed(2)} ₪
                  </div>
                  <div className="mt-2 flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => decrement(product.id)}
                      disabled={qty === 0}
                      className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-lg disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => increment(product.id)}
                      className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* פרטי לקוח + עגלה + סטטוס הזמנה */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">פרטי ההזמנה</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-neutral-300">
              טלפון ליצירת קשר
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm text-neutral-100"
              placeholder="לדוגמה: 050-1234567"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-neutral-300">
              הערה (איפה אתם יושבים / תיאור)
            </label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm text-neutral-100"
              rows={2}
              placeholder='לדוגמה: "ליד המגלשה הצהובה"'
            />
          </div>

          <div className="border-t border-neutral-800 pt-3 flex items-center justify-between text-sm text-neutral-200">
            <span>
              פריטים בעגלה:{" "}
              <strong>{totalItems}</strong>
            </span>
            <span>
              סכום כולל:{" "}
              <strong>{formattedTotal}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={isOrderButtonDisabled}
          className="w-full mt-2 px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium disabled:bg-neutral-600"
        >
          {isPlacingOrder
            ? "שולח הזמנה..."
            : !canOrder
            ? "לא ניתן להזמין מהמיקום הנוכחי"
            : totalItems === 0
            ? "בחר פריטים להזמנה"
            : !customerPhone.trim()
            ? "הכנס מספר טלפון"
            : "ביצוע הזמנה"}
        </button>

        {orderError && (
          <p className="mt-2 text-sm text-red-400">{orderError}</p>
        )}

        {/* {orderResult && (
          <div className="mt-3 text-sm bg-emerald-950 border border-emerald-700 p-2 rounded text-emerald-100">
            <div>✅ ההזמנה נשלחה!</div>
            <div>מספר הזמנה: {orderResult.orderId}</div>
            <div>
              סכום:{" "}
              {(orderResult.totalAmount / 100).toFixed(2)} ₪
            </div>
          </div>
        )} */}

        {orderResult && (
          <div className="mt-3 text-sm bg-emerald-950 border border-emerald-700 p-2 rounded text-emerald-100">
            <div>✅ ההזמנה נשלחה!</div>
            <div>מספר הזמנה: {orderResult.orderId}</div>
            <div>
              סכום: {(orderResult.totalAmount / 100).toFixed(2)} ₪
            </div>

            {/* 👇 חדש: הכנה ללינק תשלום בביט */}
            {orderResult.paymentUrl ? (
              <a
                href={orderResult.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-emerald-300 underline"
              >
                תשלום אונליין (ביט)
              </a>
            ) : (
              <div className="mt-2 text-xs text-neutral-300">
                התשלום יתבצע כרגע במזומן מול השליח.
              </div>
            )}
          </div>
        )}


        {activeOrderId && (
          <div className="mt-3 text-sm bg-neutral-900 border border-neutral-700 p-2 rounded">
            <div className="font-semibold mb-1">
              סטטוס ההזמנה שלך:
            </div>
            <div className="text-neutral-200">
              {statusLabel}
            </div>
          </div>
        )}
      </section>

      <p className="text-xs bg-neutral-900 border border-neutral-800 p-2 inline-block rounded text-neutral-400">
        Geolocation: {geoStatus} | Allowed:{" "}
        {allowed === null ? "unknown" : allowed ? "yes" : "no"}
      </p>
    </main>
  );
}
