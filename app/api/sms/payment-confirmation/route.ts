// app/api/sms/payment-confirmation/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSms } from "@/lib/sms";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    // נטען את ההזמנה כדי לדעת למי לשלוח
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer_phone, status, payment_status, total_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      console.error("SMS order load error:", error);
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // כאן בעתיד תתחבר לספק SMS אמיתי (Twilio / אחר)
    const text = `התשלום על ההזמנה שלך התקבל. תודה רבה!`;
    await sendSms(order.customer_phone, text);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("SMS route error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
