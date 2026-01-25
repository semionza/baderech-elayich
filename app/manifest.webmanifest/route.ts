import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vendorSlug = url.searchParams.get("vendor");
  const start = url.searchParams.get("start") ?? "/";

  const admin = supabaseAdmin();

  // default icons (fallback)
  let icons = [
    { src: "../../public/icons/279a4dec-1bd2-4864-b8ad-51be5014d143.png", sizes: "192x192", type: "image/png" },
    { src: "../../public/icons/279a4dec-1bd2-4864-b8ad-51be5014d143.png", sizes: "512x512", type: "image/png" },
  ];

  let vendor: { image_path?: string; name?: string } | null = null;
  let vendorName = "";

  if (vendorSlug) {
    const { data } = await admin
      .from("vendors")
      .select("image_path, name")
      .eq("slug", vendorSlug)
      .single();

    vendor = data;

    if (vendor?.image_path) {
      const logoUrl = vendor.image_path

      // לפיילוט מספיק להשתמש באותו logoUrl לשני גדלים
      icons = [
        { src: logoUrl, sizes: "192x192", type: "image/png" },
        { src: logoUrl, sizes: "512x512", type: "image/png" },
      ];
    }

    console.log(`Vendor logo URL for ${vendorSlug}: ${icons[0].src}`);
    if (vendor?.name) {
      console.log(`Generating manifest for vendor: ${vendorSlug} (${vendor.name})`);
      vendorName = vendor.name.length > 15 ? vendor.name.slice(0, 15) + "…" : vendor.name;
    } else {
      console.log(`Generating manifest for vendor: ${vendorSlug} (name not found)`);
    }
  }

  const manifest = {
    name: "בדרך אליך " + vendorName,
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
