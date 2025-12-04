import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ParkClient from "./ParkClient";


export default async function ParkPage({
  params,
}: {
  params: Promise<{ areaSlug: string }>;
}) {
  const { areaSlug } = await params;

  // 1. נטען את אזור השירות (service_area) לפי ה-slug
  const { data: area, error: areaError } = await supabase
    .from("service_areas")
    .select("id, vendor_id, name, slug, polygon, is_active")
    .eq("slug", areaSlug)
    .eq("is_active", true)
    .maybeSingle();


  if (areaError) {
    console.error("Error loading area:", areaError);
    notFound();
  }

  if (!area) {
    notFound();
  }

  // 2. נטען את המוצרים לפי vendor_id של האזור
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, description, image_url")
    .eq("vendor_id", area.vendor_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (productsError) {
    console.error("Error loading products:", productsError);
    notFound();
  }

  // 3. שולחים הכל ל-client component
  return (
    <ParkClient
      areaSlug={areaSlug}
      area={area}
      products={products ?? []}
    />
  );
}
