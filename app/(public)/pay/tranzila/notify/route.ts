import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  const raw = await req.text(); // Tranzila יכולה לשלוח JSON או form; נשמור raw
  console.log("Tranzila notify:", { orderId, raw });

  if (orderId) {
    const admin = supabaseAdmin();

    // TODO: לפי השדות שתקבל בפועל, תחליט success/failed + reference אמיתי
    // בינתיים “ניטרלי”: מסמן שהתקבלה הודעה
    await admin.from("orders").update({ payment_status: "PENDING" }).eq("id", orderId);
  }

  return NextResponse.json({ ok: true });
}
