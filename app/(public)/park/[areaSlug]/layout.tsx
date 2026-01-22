import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ areaSlug: string }>;
}): Promise<Metadata> {
  const { areaSlug } = await params;
  const admin = supabaseAdmin();

  // למצוא vendorSlug לפי areaSlug
  const { data: area } = await admin
    .from("service_areas")
    .select("slug, vendors(slug)")
    .eq("slug", areaSlug)
    .single();

  const vendorSlug =
    (area as any)?.vendors?.slug ?? null;

  const manifestUrl = vendorSlug
    ? `/manifest.webmanifest?vendor=${vendorSlug}&start=/park/${areaSlug}`
    : `/manifest.webmanifest?start=/park/${areaSlug}`;

  return {
    manifest: manifestUrl,
    themeColor: "#000000",
  };
}

export default function ParkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
