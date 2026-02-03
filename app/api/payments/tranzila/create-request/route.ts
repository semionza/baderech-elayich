import { NextResponse } from "next/server";
import { tranzilaHeaders } from "@/lib/tranzilaAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const admin = supabaseAdmin();

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id,total_amount,currency_code,customer_phone,service_area_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    const terminal_name = process.env.TRANZILA_TERMINAL_NAME!;
    if (!siteUrl || !terminal_name) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_SITE_URL / TRANZILA_TERMINAL_NAME" }, { status: 500 });
    }

    // URLs שחוזרים אליך
    const success_url = `${siteUrl}/pay/tranzila/success?orderId=${order.id}`;
    const failure_url = `${siteUrl}/pay/tranzila/fail?orderId=${order.id}`;
    const notify_url  = `${siteUrl}/api/payments/tranzila/notify?orderId=${order.id}`;

    // Payment Request (לפי docs: /v1/pr/create) :contentReference[oaicite:1]{index=1}
    const endpoint = "https://api.tranzila.com/v1/pr/create";

    // payload טיפוסי: ייתכן ששמות שדות משתנים קצת בין חשבונות/מוצרים,
    // לכן בניתי זאת “סובלני”: אתה תראה ב-response אם צריך התאמה.
    const body: any = {
      terminal_name,
      amount: order.total_amount,
      currency_code: order.currency_code ?? "ILS",

      success_url,
      failure_url,
      notify_url,

      // מומלץ להעביר מזהה הזמנה כדי לזהות חזרה
      // (אם יש שדה ייעודי אצלך בטרנזילה - נשנה)
      client: {
        phone: order.customer_phone ?? "",
      },
      reference: order.id,
      description: `Order ${order.id}`,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: tranzilaHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await res.text();
    let data: any = null;
    try { data = JSON.parse(raw); } catch {}

    if (!res.ok) {
      return NextResponse.json({ error: "Tranzila error", status: res.status, raw }, { status: 502 });
    }

    // הרבה APIs שלהם מחזירים URL בשם sale_url / url / payment_url (שונה בין שירותים) :contentReference[oaicite:2]{index=2}
    const payment_url =
      data?.payment_url ?? data?.sale_url ?? data?.url ?? data?.redirect_url ?? null;

    const payment_reference =
      data?.request_id ?? data?.pr_id ?? data?.transaction_id ?? data?.track_id ?? null;

    if (!payment_url) {
      return NextResponse.json({ error: "No payment_url in response", raw: data ?? raw }, { status: 502 });
    }

    await admin
      .from("orders")
      .update({
        payment_url,
        payment_reference,
        payment_status: "PENDING",
      })
      .eq("id", order.id);

    return NextResponse.json({ payment_url, payment_reference, raw: data ?? raw });
  } catch (e: any) {
    console.error("create-request error", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
