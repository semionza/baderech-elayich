import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function FailPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const { orderId } = await searchParams;
  if (orderId) {
    const admin = supabaseAdmin();
    await admin.from("orders").update({ payment_status: "FAILED" }).eq("id", orderId);
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-xl font-semibold">התשלום לא הושלם ❌</h1>
      <p className="mt-2 text-neutral-300">אפשר לנסות שוב או לבחור מזומן.</p>
    </main>
  );
}
