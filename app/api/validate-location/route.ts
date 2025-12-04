// app/api/validate-location/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// פונקציה לבדיקה אם נקודה בתוך פוליגון (Ray casting)
function pointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][]
): boolean {
  let inside = false;

  console.log("Checking point:", lat, lng);
  console.log("Polygon coordinates:", polygon);
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0000001) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { areaSlug, lat, lng } = body;

    if (
      !areaSlug ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid parameters" },
        { status: 400 }
      );
    }

    // טוענים את האזור לפי slug
    const { data: area, error: areaError } = await supabase
      .from("service_areas")
      .select("id, slug, polygon, is_active")
      .eq("slug", areaSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (areaError || !area) {
      return NextResponse.json(
        { allowed: false, reason: "area_not_found" },
        { status: 200 }
      );
    }

    // polygon הוא GeoJSON: { type: "Polygon", coordinates: [ [ [lng, lat], ... ] ] }
    const coords: [number, number][] =
      area.polygon?.coordinates?.[0] ?? [];

    if (!coords.length) {
      return NextResponse.json(
        { allowed: false, reason: "no_polygon" },
        { status: 200 }
      );
    }

    const isInside = pointInPolygon(lat, lng, coords);

    return NextResponse.json(
      {
        allowed: isInside,
        reason: isInside ? "inside" : "outside",
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("validate-location error:", e);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
