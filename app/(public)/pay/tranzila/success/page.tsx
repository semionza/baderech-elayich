import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  if (orderId) {
    const admin = supabaseAdmin();
    await admin.from("orders").update({ payment_status: "PAID" }).eq("id", orderId);
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-xl font-semibold">התשלום התקבל ✅</h1>
      <p className="mt-2 text-neutral-300">אפשר לחזור לגינה. ההזמנה תעודכן במערכת.</p>
    </main>
  );
}
