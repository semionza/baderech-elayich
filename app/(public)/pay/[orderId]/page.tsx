import { redirect } from "next/navigation";
import util from "util";

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/payments/tranzila/create-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok || !data.payment_url) {
    // אפשר להחליף לדף יפה
    throw new Error(data.error || "Failed to create payment request");
  }

  redirect(data.payment_url);
}
