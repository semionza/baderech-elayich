import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vendorSlug = url.searchParams.get("vendor");
  const start = url.searchParams.get("start") ?? "/";

  const admin = supabaseAdmin();

  // default icons (fallback)
  let icons = [
    { src: "/icons/public/icons/279a4dec-1bd2-4864-b8ad-51be5014d143.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/public/icons/279a4dec-1bd2-4864-b8ad-51be5014d143.png", sizes: "512x512", type: "image/png" },
  ];

  if (vendorSlug) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("image_path")
      .eq("slug", vendorSlug)
      .single();

    if (vendor?.image_path) {
    //   const { data: publicData } = admin.storage
    //     .from("vendor-logos")
    //     .getPublicUrl(vendor.image_path);

    //   const logoUrl = publicData.publicUrl;

      const logoUrl = vendor.image_path

      // לפיילוט מספיק להשתמש באותו logoUrl לשני גדלים
      icons = [
        { src: logoUrl, sizes: "192x192", type: "image/png" },
        { src: logoUrl, sizes: "512x512", type: "image/png" },
      ];
    }
  }

  const manifest = {
    name: "בדרך אליך",
    short_name: "בדרך",
    start_url: start,
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "he-IL",
    dir: "rtl",
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      "content-type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, s-maxage=60",
    },
  });
}
