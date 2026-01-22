"use client";

import { useEffect, useState, useMemo } from "react";
import InstallAsAppButton from "@/app/components/InstallAsAppButton";

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

// type GeoStatus = "checking" | "granted" | "denied" | "not-supported";
type GeoStatus =
  | "idle"          // עוד לא בדקנו כלום
  | "not-supported" // המכשיר לא תומך
  | "requestable"   // יש תמיכה, צריך לחכות ללחיצה
  | "requesting"    // כרגע מבקשים מיקום
  | "granted"       // יש מיקום
  | "denied";       // המשתמש סירב / תקלה

const STATUS_LABELS: Record<string, string> = {
  PENDING: "הזמנה התקבלה",
  ACCEPTED: "ההזמנה בטיפול",
  IN_PROGRESS: "מכינים עבורך",
  ON_THE_WAY: "ההזמנה בדרך אליך",
  DELIVERED: "ההזמנה סופקה",
  CANCELLED: "ההזמנה בוטלה",
};

export default function ParkClient({ areaSlug, area, products }: Props) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
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

  // לבדוק תמיכה בגיאולוקציה בפעם הראשונה בלבד
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("geolocation" in navigator)) {
      setGeoStatus("not-supported");
      setLocationError("המכשיר לא תומך בזיהוי מיקום.");
      return;
    }

    // יש תמיכה – מחכים ללחיצה מפורשת מהמשתמש
    setGeoStatus("requestable");
  }, []);

  const canOrder = geoStatus === "granted" && allowed === true;
  
  // --- בקשת מיקום בלחיצה (מוכן לאייפון) ---
  async function handleRequestLocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("not-supported");
      setLocationError("המכשיר לא תומך בזיהוי מיקום.");
      return;
    }

    setGeoStatus("requesting");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setGeoStatus("granted");

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
              "נראה שאתם מחוץ לאזור השירות שלנו. השירות זמין רק בתוך הגינה."
            );
          }
        } catch (e) {
          console.error(e);
          setAllowed(false);
          setLocationError("הייתה בעיה בבדיקת המיקום. נסו שוב מאוחר יותר.");
        }
      },
      (err) => {
        console.error("Geo error:", err);
        setGeoStatus("denied");

        if (err.code === err.PERMISSION_DENIED) {
          setLocationError(
            "לא נתנה הרשאה למיקום. ניתן לאפשר מיקום דרך הגדרות הדפדפן / המכשיר ולנסות שוב."
          );
        } else {
          setLocationError("לא הצלחנו לקבל את המיקום. נסו שוב.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  }

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
          אתם נמצאים באזור השירות: <span className="font-mono">{area.name}</span>
        </p>
        {/* להתקין בתור אפליקציה */}
        <div className="mt-3">
          <InstallAsAppButton />
        </div>
      </header>



       {/* סטטוס מיקום + כפתור לאייפון */}
        {geoStatus === "not-supported" && (
          <p className="park-geo-error">
            נראה שהמכשיר לא תומך בזיהוי מיקום. אפשר עדיין לעיין בתפריט, אבל לא נוכל להביא אליכם את ההזמנה.
          </p>
        )}

        {(geoStatus === "idle" || geoStatus === "requestable" || geoStatus === "denied") && (
          <div className="park-geo-info">
            <div className="mb-1">
              כדי שנוכל לבדוק שאתם בתוך הגינה ולהביא אליכם את ההזמנה, יש לאפשר גישה למיקום.
            </div>
            <button
              type="button"
              onClick={handleRequestLocation}
              className="mt-1 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-black"
            >
              אפשר מיקום
            </button>
            {geoStatus === "denied" && (
              <div className="mt-1 text-[11px] text-neutral-300">
                אם לא מופיעה בקשה להרשאת מיקום, ניתן לבדוק בהגדרות הדפדפן / המכשיר (במיוחד באייפון).
              </div>
            )}
          </div>
        )}

        {geoStatus === "requesting" && (
          <p className="park-geo-info">
            בודקים את המיקום שלכם… אם לא מופיעה בקשה להרשאה, נסו שוב או בדקו את הגדרות המיקום במכשיר.
          </p>
        )}

        {allowed === false && locationError && (
          <p className="park-geo-error">{locationError}</p>
        )}

      {/* תפריט מוצרים */}
      <section className="park-card">
        <div className="park-card-header">
          <div>
            <h2 className="park-card-title">מה תרצו להזמין?</h2>
            <p className="park-card-subtitle">
              אנחנו מגיעים עד אליכם — פשוט בחרו פריט אחד או יותר.
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
                  <div className="park-product-image-wrapper">
                    {product.image_url ? (
                      <a href={product.image_url} target="_blank" rel="noreferrer">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="park-product-image"
                        />
                      </a>
                    ) : (
                      <div className="park-product-image-placeholder">
                        אין תמונה
                      </div>
                    )}
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
מספר טלפון — נשלח לכם עדכון כשההזמנה בדרך              
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
              מיקומכם המדויק / כתובתכם (אופציונלי)
            </label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              className="park-textarea"
              rows={2}
              placeholder='לדוגמה:"רח׳ הרצל 10 דירה 10" "ליד המגלשה הצהובה" '
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
            ? "נא להזין מספר טלפון"
            : "שליחה — אנחנו בדרך אליכם!"}
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
            <div>🎉 ההזמנה התקבלה!</div>
            <div>אנחנו מתחילים בהכנה — נעדכן אתכם ברגע שהמלצר יוצא אליכם.</div>
            <div>מספר הזמנה: {orderResult.orderId}</div>
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
