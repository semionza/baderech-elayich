import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: "Missing productId" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    const { name, price, description, is_active } = body as {
      name?: string;
      price?: number;
      description?: string | null;
      is_active?: boolean;
    };

    const updateData: Record<string, any> = {};

    if (typeof name === "string") {
      updateData.name = name.trim();
    }
    if (typeof price === "number" && price > 0) {
      updateData.price = price;
    }
    if (typeof description === "string") {
      updateData.description = description.trim();
    }
    if (typeof is_active === "boolean") {
      updateData.is_active = is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .eq("vendor_id", staff.vendor_id)
      .eq("service_area_id", staff.service_area_id)
      .select(
        "id, name, price, description, is_active, service_area_id"
      )
      .maybeSingle();

    if (error) {
      console.error("Update product error:", error);
      return NextResponse.json(
        { error: "Failed to update product" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Product not found for this garden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ product: data }, { status: 200 });
  } catch (e) {
    console.error(
      "PATCH /api/dashboard/products/[productId] error:",
      e
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
