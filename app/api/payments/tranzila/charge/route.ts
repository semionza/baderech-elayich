import { NextResponse } from "next/server";
import { tranzilaPost } from "@/lib/tranzila";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ChargeRequest = {
  orderId: string;

  // ⚠️ אם אתה שולח כרטיס לשרת — זה PCI.
  // אם אתה עובד Hosted Fields אז לא שולחים את זה בכלל.
  card_number: string;
  exp_month: string; // "12"
  exp_year: string;  // "29" or "2029" (תלוי טרנזילה)
  cvv: string;

  holder_name?: string;
  id_number?: string; // ת"ז אם נדרש
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ChargeRequest;

    if (!payload?.orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    // 1) טוענים הזמנה מסופאבייס
    const admin = supabaseAdmin();
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id,total_amount,currency,customer_phone,customer_note")
      .eq("id", payload.orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const terminal_name = process.env.TRANZILA_TERMINAL_NAME!;
    if (!terminal_name) {
      return NextResponse.json({ error: "Missing TRANZILA_TERMINAL_NAME" }, { status: 500 });
    }

    // 2) בקשת חיוב
    // לפי מסמכי 3DS/Transaction: POST /v1/transaction/credit_card/create :contentReference[oaicite:2]{index=2}
    const tranzilaBody: any = {
      terminal_name,
      amount: order.total_amount,
      currency_code: order.currency ?? "ILS",

      // נתוני כרטיס (⚠️ PCI)
      card_number: payload.card_number,
      exp_month: payload.exp_month,
      exp_year: payload.exp_year,
      cvv: payload.cvv,
      holder_name: payload.holder_name,
      identity_number: payload.id_number,

      // שדות “רכים” (תלוי במסוף שלך מה נתמך)
      contact: order.customer_phone,
      pdesc: `Order ${order.id}`,
      // אם תרצה לקבל עדכון אסינכרוני:
      // notify_url: "https://YOUR_DOMAIN/api/payments/tranzila/webhook"
    };

    const r = await tranzilaPost("/v1/transaction/credit_card/create", tranzilaBody);
    // לפעמים ה-response הוא JSON, לפעמים טקסט; נשמור raw וננסה parse
    let data: any = null;
    try { data = JSON.parse(r.raw); } catch {}

    if (!r.ok) {
      return NextResponse.json({ error: "Tranzila error", status: r.status, raw: r.raw }, { status: 502 });
    }

    // 3) שמירה להזמנה:
    // כאן תלוי במבנה התשובה שתקבל (track_id / index / etc).
    const payment_reference =
      data?.track_id ?? data?.transaction_id ?? data?.index ?? null;

    await admin
      .from("orders")
      .update({
        payment_reference,
        payment_status: data?.code === "000" ? "PAID" : "PENDING",
        // אם Tranzila מחזירה redirect ל-3DS:
        payment_url: data?.auth_3ds_redirect ?? null,
      })
      .eq("id", order.id);

    return NextResponse.json({
      ok: true,
      tranzila: data ?? r.raw,
      payment_reference,
      payment_url: data?.auth_3ds_redirect ?? null,
    });
  } catch (e: any) {
    console.error("Tranzila charge error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
