// app/(dashboard)/dashboard/products/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import ProductsManager from "./ProductsManager";

type DbProductRow = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
  service_area_id: string | null;
  image_url: string | null;
};

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient();

  // 1. מי המשתמש?
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. מאיזו גינה/וונדור הוא?
  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("vendor_id, service_area_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError || !staff) {
    redirect("/auth/login");
  }

  // רק משתמש עם DASHBOARD או BOTH
  if (staff.role !== "DASHBOARD" && staff.role !== "BOTH") {
    redirect("/waiter");
  }

  // 3. טוענים מוצרים של הגינה של המשתמש
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, name, price, description, is_active, service_area_id, image_url"
    )
    .eq("vendor_id", staff.vendor_id)
    .eq("service_area_id", staff.service_area_id)
    .order("name", { ascending: true });

  if (productsError) {
    console.error("Error loading products:", productsError);
  }

  return (
    <main className="screen-root">
      <header className="screen-header">
        <div>
          <h1 className="screen-header-title">ניהול מוצרים</h1>
          <p className="screen-header-subtitle">
            גינה זו בלבד (לפי המשתמש המחובר)
            {staff.service_area_id
              ? ` - אזור שירות: ${staff.service_area_id}`
              : " - כל האזורים"}
          </p>
        </div>
      </header>

      <section className="screen-section">
        <div className="card">
          <ProductsManager
            initialProducts={(products ?? []) as DbProductRow[]}
            vendorSlug={staff.vendor_id}
            areaSlug={staff.service_area_id}
          />
        </div>
      </section>
    </main>
  );
}
