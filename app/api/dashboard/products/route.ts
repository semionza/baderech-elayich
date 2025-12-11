import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. מי המשתמש?
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. staff_members – מאיזו גינה/וונדור?
    const { data: staff, error: staffError } = await supabase
      .from("staff_members")
      .select("vendor_id, service_area_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (staff.role !== "DASHBOARD" && staff.role !== "BOTH") {
      return NextResponse.json(
        { error: "Not allowed" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { name, price, description } = body as {
      name?: string;
      price?: number;
      description?: string | null;
    };

    if (!name || typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid name/price" },
        { status: 400 }
      );
    }

    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert({
        vendor_id: staff.vendor_id,
        service_area_id: staff.service_area_id,
        name: name.trim(),
        price,
        description: description?.trim() || null,
        is_active: true,
      })
      .select(
        "id, name, price, description, is_active, service_area_id"
      )
      .single();

    if (insertError || !product) {
      console.error("Insert product error:", insertError);
      return NextResponse.json(
        { error: "Failed to create product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    console.error("POST /api/dashboard/products error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
