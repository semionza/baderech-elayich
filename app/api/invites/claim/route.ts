import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// server helper to read user session
function supabaseUserServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
        set() {},
        remove() {},
      }
    }
  );
}

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  // get current user
  const supabase = supabaseUserServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  // find invite
  const { data: invite, error } = await admin
    .from("staff_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  if (invite.used_at) {
    return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  }

  // create staff_members row pointing to this user
  const { data: staff, error: staffErr } = await admin
    .from("staff_members")
    .insert({
      user_id: user.id,
      vendor_id: invite.vendor_id,
      service_area_id: invite.service_area_id,
      role: invite.role,
      is_active: true
    })
    .select("*")
    .single();

  if (staffErr) {
    console.error("create staff error", staffErr);
    return NextResponse.json({ error: staffErr.message }, { status: 500 });
  }

  // mark invite used
  await admin
    .from("staff_invites")
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq("id", invite.id);

  return NextResponse.json({ staff });
}
