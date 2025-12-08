// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type OrderItemInput = {
  productId: string;
  quantity: number;
};

type CreateOrderBody = {
  areaSlug: string;
  customerPhone: string;
  customerNote?: string;
  lat?: number;
  lng?: number;
  items: OrderItemInput[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateOrderBody;

    const { areaSlug, customerPhone, customerNote, lat, lng, items } = body;

    if (!areaSlug || !customerPhone || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedItems = items
      .map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity) || 0,
      }))
      .filter((it) => it.quantity > 0);

    if (normalizedItems.length === 0) {
      return NextResponse.json(
        { error: "No valid items in order" },
        { status: 400 }
      );
    }

    // 1. מוצאים את אזור השירות
    const { data: area, error: areaError } = await supabase
      .from("service_areas")
      .select("id, vendor_id, slug, is_active")
      .eq("slug", areaSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (areaError) {
      console.error("Error loading area:", areaError);
      return NextResponse.json(
        { error: "Failed to load service area" },
        { status: 500 }
      );
    }

    if (!area) {
      return NextResponse.json(
        { error: "Service area not found or inactive" },
        { status: 400 }
      );
    }

    // 2. טוענים מוצרים לפי vendor + ids
    const productIds = Array.from(
      new Set(normalizedItems.map((it) => it.productId))
    );

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, is_active")
      .eq("vendor_id", area.vendor_id)
      .in("id", productIds)
      .eq("is_active", true);

    if (productsError) {
      console.error("Error loading products:", productsError);
      return NextResponse.json(
        { error: "Failed to load products" },
        { status: 500 }
      );
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: "No matching products found" },
        { status: 400 }
      );
    }

    const foundIds = new Set(products.map((p) => p.id));
    const missing = normalizedItems.filter((it) => !foundIds.has(it.productId));

    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Some products not found", missing },
        { status: 400 }
      );
    }

    // 3. מחשבים total + בונים payload ל-order_items
    let totalAmount = 0;
    const itemsWithProductData = normalizedItems.map((it) => {
      const product = products.find((p) => p.id === it.productId)!;
      const lineTotal = product.price * it.quantity;
      totalAmount += lineTotal;

      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: it.quantity,
      };
    });

    // 4. כאן בעתיד תתחבר ל-API של ביט
    // למשל:
    // const { paymentUrl, paymentReference } = await createBitPayment({ ... })
    //
    // כרגע – נשאיר NULL, אבל מחזירים שדות בתשובה, כדי שה-frontend יהיה מוכן.
    const paymentUrl: string | null = null;
    const paymentReference: string | null = null;

    // 5. יוצרים הזמנה
    const { data: createdOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        vendor_id: area.vendor_id,
        service_area_id: area.id,
        customer_phone: customerPhone,
        customer_note: customerNote ?? "",
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        total_amount: totalAmount,
        currency: "ILS",
        status: "PENDING",
        payment_status: "UNPAID",
        payment_url: paymentUrl,
        payment_reference: paymentReference,
      })
      .select(
        "id, created_at, status, payment_status, total_amount, payment_url, payment_reference"
      )
      .single();

    if (orderError || !createdOrder) {
      console.error("Error creating order:", orderError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    // 6. order_items
    const orderItemsPayload = itemsWithProductData.map((it) => ({
      order_id: createdOrder.id,
      product_id: it.productId,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
    }));

    const { error: itemsInsertError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsInsertError) {
      console.error("Error inserting order items:", itemsInsertError);
      // אפשר לשפר בעתיד ל-transaction
    }

    // 7. מחזירים תשובה ללקוח כולל paymentUrl / paymentReference
    return NextResponse.json(
      {
        orderId: createdOrder.id,
        totalAmount: createdOrder.total_amount,
        currency: "ILS",
        status: createdOrder.status,
        paymentStatus: createdOrder.payment_status,
        createdAt: createdOrder.created_at,
        paymentUrl: createdOrder.payment_url,
        paymentReference: createdOrder.payment_reference,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/orders error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
