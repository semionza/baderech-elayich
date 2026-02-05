import { NextResponse } from "next/server";
import { tranzilaHeaders } from "@/lib/tranzilaAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import util from "util";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json().catch(() => ({}));
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const admin = supabaseAdmin();

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select(`
        id,
        total_amount,
        currency,
        customer_phone,
        order_items (
          name,
          price,
          quantity
        )
      `)
      .eq("id", orderId)
      .single();

    console.error(
      "Creating Tranzila request for order:",
      util.inspect(order, { depth: null, colors: true })
    );

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const terminal_name = process.env.TRANZILA_TERMINAL_NAME!;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    if (!terminal_name || !siteUrl) {
      return NextResponse.json(
        { error: "Missing TRANZILA_TERMINAL_NAME / NEXT_PUBLIC_SITE_URL" },
        { status: 500 }
      );
    }

    const success_url = `${siteUrl}/pay/tranzila/success?orderId=${order.id}`;
    const failure_url = `${siteUrl}/pay/tranzila/fail?orderId=${order.id}`;
    const notify_url = `${siteUrl}/api/payments/tranzila/notify?orderId=${order.id}`;

    const toIls = (agorot: number) => Number((agorot / 100).toFixed(2));

    const items = (order.order_items ?? []).map((it: any) => ({
      name: it.name,
      unit_price: toIls(Number(it.price)),
      type: "I",
  
      units_number: Number(it.quantity ?? 1),
      currency_code: order.currency ?? "ILS",
      vat_percent: 0,
    }));

    if (!items.length) {
      return NextResponse.json({ error: "Order has no items" }, { status: 400 });
    }

    const endpoint = "https://api.tranzila.com/v1/pr/create";

    // מינימום שדות כדי לעבור schema
    const body: any = {
      terminal_name,
      created_by_user: "semionza",
      created_by_system: "baderech-elayich",
      created_via: "TRAPI",
      request_date: null,
      amount: toIls(Number(order.total_amount)),         // אם יגידו שהסכום נגזר מה-items, נוכל להסיר
      currency_code: order.currency ?? "ILS",
      success_url,
      failure_url,
      notify_url,
      client: {
        external_id: null,
        name: "Zaslavsky Semion",
        contact_person: "Zaslavsky Semion",
        email: "semionza@gmail.com",
      },
      items,
      payment_plans: [1],
      payment_methods: [1],
      payments_number: 1,
      request_language: "hebrew",
      response_language: "hebrew",
      send_email: {
        "sender_name": "Baderex - Tranzila",
        "sender_email": "donotreply@tranzila.com"
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: tranzilaHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!res.ok) {
      return NextResponse.json({ error: "Tranzila error", status: res.status, data }, { status: 502 });
    }

    const payment_url =
      data?.pr_link ?? null;

    const payment_reference =
      data?.pr_id ?? null;

    console.error(
      "Tranzila response:",
      util.inspect(data, { depth: null, colors: true })
    );

    if (!payment_url) {
      console.error(
        "Tranzila mismatch_info:",
        util.inspect(data?.mismatch_info, { depth: null, colors: true })
      );
      return NextResponse.json({ error: "No payment_url in response", data }, { status: 502 });
    }

    await admin
      .from("orders")
      .update({
        payment_url,
        payment_reference,
        payment_status: "PENDING",
      })
      .eq("id", order.id);

    return NextResponse.json({ payment_url, payment_reference, data });
  } catch (e: any) {
    console.error("create-request error", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
