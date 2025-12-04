// app/api/orders/[orderId]/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const ALLOWED_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_THE_WAY",
  "DELIVERED",
  "CANCELLED",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

const ALLOWED_PAYMENT_STATUSES = [
  "UNPAID",
  "PAID",
  "FAILED",
] as const;

type AllowedPaymentStatus = (typeof ALLOWED_PAYMENT_STATUSES)[number];


// 🔹 GET – החזרת סטטוס ההזמנה ללקוח
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, total_amount, created_at")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Error loading order:", error);
      return NextResponse.json(
        { error: "Failed to load order" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        orderId: data.id,
        status: data.status,
        paymentStatus: data.payment_status,
        totalAmount: data.total_amount,
        createdAt: data.created_at,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("GET /api/orders/[orderId] error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 🔹 PATCH – עדכון סטטוס (כבר היה לך, רק מזכיר)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status, paymentStatus } = body as {
      status?: string;
      paymentStatus?: string;
    };

    const updateData: {
      status?: AllowedStatus;
      payment_status?: AllowedPaymentStatus;
    } = {};

    if (status) {
      if (!ALLOWED_STATUSES.includes(status as AllowedStatus)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
      updateData.status = status as AllowedStatus;
    }

    if (paymentStatus) {
      if (
        !ALLOWED_PAYMENT_STATUSES.includes(
          paymentStatus as AllowedPaymentStatus
        )
      ) {
        return NextResponse.json(
          { error: "Invalid payment status" },
          { status: 400 }
        );
      }
      updateData.payment_status = paymentStatus as AllowedPaymentStatus;
    }

    if (!updateData.status && !updateData.payment_status) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const vendorId = process.env.DEFAULT_VENDOR_ID;
    if (!vendorId) {
      return NextResponse.json(
        { error: "DEFAULT_VENDOR_ID is not set" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .eq("vendor_id", vendorId)
      .select("id, status, payment_status, updated_at")
      .maybeSingle();

    if (error) {
      console.error("Error updating order:", error);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Order not found for this vendor" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        orderId: data.id,
        status: data.status,
        paymentStatus: data.payment_status,
        updatedAt: data.updated_at,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("PATCH /api/orders/[orderId] error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

