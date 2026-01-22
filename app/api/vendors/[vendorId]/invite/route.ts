import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

export async function POST(req: Request, { params }: { params: { vendorId: string } }) {
  const body = await req.json().catch(() => ({}));
  const { email, role = "WAITER", service_area_id } = body;
  const vendorId = params.vendorId;

  if (!email || !vendorId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const token = randomUUID(); // או כל token חזק אחר

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("staff_invites")
    .insert({
      vendor_id: vendorId,
      service_area_id: service_area_id || null,
      email: email.toLowerCase(),
      role,
      token,
    })
    .select("*")
    .single();

  if (error) {
    console.error("invite create error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // כאן אפשר לשלוח אימייל/הודעת SMS עם הקישור -- לדוגמה:
  // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${token}`;
  // sendEmail(email, "הזמנה להצטרף לפלטפורמה", `קישור: ${inviteUrl}`)

  return NextResponse.json({ invite: data });
}
