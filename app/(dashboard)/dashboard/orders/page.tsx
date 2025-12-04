// app/(dashboard)/dashboard/orders/page.tsx
import { supabase } from "@/lib/supabaseClient";
import OrdersTable from "./OrdersTable";

type DbOrderRow = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer_phone: string;
  customer_note: string | null;
  service_areas: {
    name: string;
    slug: string;
  }[];
  order_items: {
    name: string;
    quantity: number;
  }[];
};

export default async function OrdersDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams; // 👈 כאן הקסם
  const statusFilter = status ?? null;

  const vendorId = process.env.DEFAULT_VENDOR_ID;
  if (!vendorId) {
    return <p className="p-4 text-red-600">DEFAULT_VENDOR_ID missing</p>;
  }

  let query = supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      status,
      payment_status,
      total_amount,
      customer_phone,
      customer_note,
      service_areas ( name, slug ),
      order_items ( name, quantity )
    `
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading orders:", error);
  }

  const orders = (data ?? []) as DbOrderRow[];

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">הזמנות</h1>
          <p className="text-sm text-slate-500">
            {statusFilter
              ? `מציג רק סטטוס: ${statusFilter}`
              : "מציג את כל ההזמנות"}
          </p>
        </div>
      </header>

      <section className="p-4">
        <OrdersTable orders={orders} statusFilter={statusFilter} />
      </section>
    </main>
  );
}
