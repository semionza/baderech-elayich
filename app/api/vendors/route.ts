import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isPlatformAdmin } from "@/lib/platformAdmin";

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
      },
    }
  );
}

export async function GET() {
  const supabase = supabaseUserServer();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth?.user?.email ?? null;

  if (!auth?.user || !isPlatformAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("vendors")
    .select("id, name, slug, is_active, created_at, image_path")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = supabaseUserServer();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth?.user?.email ?? null;

  if (!auth?.user || !isPlatformAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const slug = String(body.slug || "").trim().toLowerCase();

  if (!name || !slug) {
    return NextResponse.json({ error: "Missing name/slug" }, { status: 400 });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase a-z, 0-9, and dashes only" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("vendors")
    .insert({ name, slug, is_active: true })
    .select("id, name, slug, is_active, created_at, image_path")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendor: data });
}
