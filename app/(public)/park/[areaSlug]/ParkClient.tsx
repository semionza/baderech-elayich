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
      const res = await fetch(`/api/orders/${activeOrderId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        // מנסים לקרוא טקסט (לא JSON) רק לצורך debug
        const text = await res.text().catch(() => "");
        console.error(
          "Status fetch error:",
          res.status,
          res.statusText,
          text
        );

        // אם השרת מחזיר 404 – ננקה את ההזמנה הפעילה ונפסיק לעקוב
        if (!cancelled && res.status === 404) {
          setActiveOrderId(null);
          setActiveOrderStatus(null);
          if (intervalId) clearInterval(intervalId);
        }

        return;
      }

      // כאן אנחנו מניחים שהתגובה באמת JSON
      const data = await res.json().catch((e) => {
        console.error("Failed to parse JSON from status response:", e);
        return null;
      });

      if (!data || cancelled) return;

      setActiveOrderStatus(data.status);

      // אם סופקה / בוטלה – אפשר לעצור polling
      if (data.status === "DELIVERED" || data.status === "CANCELLED") {
        if (intervalId) clearInterval(intervalId);
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

  const BIT_PAY_URL =
  "https://www.bitpay.co.il/app/me/8C3D0869-135B-BB92-F273-8E81611AAF31ABCC";


  // ========== UI ==========

  return (
  <main className="park-root">
    <div className="park-wrapper">
      {/* כותרת הגינה */}
      <header className="park-header">
        <h1 className="park-title">{area.name}</h1>
        <p className="park-subtitle">
          גינה: <span className="font-mono">{areaSlug}</span>
        </p>
      </header>

      {/* סטטוס מיקום */}
      {allowed === false && (
        <p className="park-geo-error">
          {locationError ??
            "אי אפשר להזמין מהמיקום הנוכחי שלך. נסה להתקרב לגינה או לאפשר גישה למיקום."}
        </p>
      )}

      {allowed === null && (
        <p className="park-geo-info">בודק את המיקום שלך...</p>
      )}

      {/* תפריט מוצרים */}
      <section className="park-card">
        <div className="park-card-header">
          <div>
            <h2 className="park-card-title">תפריט</h2>
            <p className="park-card-subtitle">
              בחרו מה להביא אליכם לגינה
            </p>
          </div>
        </div>

        <ul className="park-product-list">
          {products.map((product) => {
            const qty = cart[product.id] ?? 0;

            return (
              <li key={product.id} className="park-product-item">
                <div className="park-product-main">
                  <div className="park-product-name">
                    {product.name}
                  </div>
                  {product.description && (
                    <div className="park-product-desc">
                      {product.description}
                    </div>
                  )}
                  <div className="park-product-price">
                    {(product.price / 100).toFixed(2)} ₪
                  </div>
                </div>

                <div className="park-qty-controls">
                  <button
                    type="button"
                    onClick={() => decrement(product.id)}
                    disabled={qty === 0}
                    className={
                      "park-qty-btn" +
                      (qty === 0 ? " park-qty-btn-disabled" : "")
                    }
                  >
                    −
                  </button>
                  <span className="park-qty-value">{qty}</span>
                  <button
                    type="button"
                    onClick={() => increment(product.id)}
                    className="park-qty-btn"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* פרטי הזמנה */}
      <section className="park-card space-y-3">
        <h2 className="park-card-title">פרטי ההזמנה</h2>

        <div className="space-y-3">
          <div>
            <label className="park-field-label">
              טלפון ליצירת קשר
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="park-input"
              placeholder="לדוגמה: 050-1234567"
            />
          </div>

          <div>
            <label className="park-field-label">
              איפה אתם יושבים?
            </label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              className="park-textarea"
              rows={2}
              placeholder='לדוגמה: "ליד המגלשה הצהובה"'
            />
          </div>

          <div className="park-summary-row">
            <span>
              פריטים בעגלה:{" "}
              <span className="park-summary-value">
                {totalItems}
              </span>
            </span>
            <span>
              סכום כולל:{" "}
              <span className="park-summary-total">
                {formattedTotal}
              </span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={isOrderButtonDisabled}
          className="park-order-button"
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

        <a
          href={BIT_PAY_URL}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost mt-2 inline-flex w-full items-center justify-center rounded-xl border border-emerald-500/60 bg-transparent px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60"
        >
          תשלום בביט (פתיחת מסך התשלום באפליקציית Bit)
        </a>

        {orderError && (
          <p className="park-order-error">{orderError}</p>
        )}

        {orderResult && (
          <div className="park-order-success">
            <div>✅ ההזמנה נשלחה!</div>
            <div>מספר הזמנה: {orderResult.orderId}</div>
            <div>
              סכום: {(orderResult.totalAmount / 100).toFixed(2)} ₪
            </div>
          </div>
        )}
      </section>

      {/* debug קטן אם אתה רוצה להשאיר */}
      <p className="park-debug">
        Geolocation: {geoStatus} | Allowed:{" "}
        {allowed === null ? "unknown" : allowed ? "yes" : "no"}
      </p>
    </div>

    {/* בר תחתון במובייל לעגלה */}
    {totalItems > 0 && (
      <div className="park-bottom-bar">
        <div className="park-bottom-bar-inner">
          <div className="park-bottom-bar-text">
            <span>
              {totalItems} פריטים •{" "}
              <span className="font-semibold text-emerald-300">
                {formattedTotal}
              </span>
            </span>
            {!customerPhone.trim() && (
              <span className="park-bottom-bar-note">
                יש להכניס מספר טלפון לפני ביצוע ההזמנה
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isOrderButtonDisabled}
            className="park-bottom-bar-button"
          >
            הזמן עכשיו
          </button>
        </div>
      </div>
    )}
  </main>
);

}
