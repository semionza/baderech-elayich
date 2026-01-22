// app/api/vendors/[vendorId]/logo/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Upload vendor logo via server (safe: uses service role).
 * Expects a multipart/form-data POST with "file".
 *
 * Important: `params` may be a Promise in this Next.js environment,
 * so we await it before accessing vendorId.
 */
export async function POST(req: Request, context: { params: any }) {
  try {
    // params can be a Promise — await it.
    const resolvedParams = await context.params;
    const vendorId = resolvedParams?.vendorId;

    if (!vendorId) {
      return NextResponse.json({ error: "Missing vendorId in URL" }, { status: 400 });
    }

    // parse multipart form data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // prepare path
    const ext = (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "");
    const filename = `logo-${Date.now()}.${ext}`;
    const path = `${vendorId}/${filename}`;

    // read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const admin = supabaseAdmin();

    // upload to bucket (vendor-logos)
    const { error: uploadError } = await admin.storage
      .from("vendor-logos")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("upload err", uploadError);
      return NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 });
    }

    // get public url (assuming bucket is public; otherwise use createSignedUrl)
    const { data: publicData } = admin.storage.from("vendor-logos").getPublicUrl(path);
    const publicUrl = publicData?.publicUrl ?? null;

    // update vendor row with image_path (use admin client)
    const { error: dbErr } = await admin
      .from("vendors")
      .update({ image_path: publicUrl })
      .eq("id", vendorId);

    if (dbErr) {
      console.error("db err", dbErr);
      return NextResponse.json({ error: dbErr.message || "DB update failed" }, { status: 500 });
    }

    return NextResponse.json({ path, publicUrl });
  } catch (err: any) {
    console.error("logo upload route error", err);
    return NextResponse.json({ error: err?.message || String(err) || "Unknown error" }, { status: 500 });
  }
}
