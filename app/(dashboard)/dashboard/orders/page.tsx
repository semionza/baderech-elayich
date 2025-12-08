import OrdersTable from "./OrdersTable";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

type DbOrderRow = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer_phone: string;
  customer_note: string | null;
  service_areas: { name: string; slug: string }[];
  order_items: { name: string; quantity: number }[];
};

export default async function OrdersDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = status ?? null;

  const supabase = await createSupabaseServerClient();

  // 1. מי המשתמש?
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. מה ההרשאה שלו? (איזה אזור / vendor)
  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("vendor_id, service_area_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError || !staff) {
    console.error("No staff membership for user", staffError);
    // אפשר להחזיר דף "אין הרשאה"
    redirect("/auth/login");
  }

  // 3. מושכים הזמנות רק ל-service_area הזה
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
    .eq("vendor_id", staff.vendor_id)
    .eq("service_area_id", staff.service_area_id)
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
    <main className="min-h-screen bg-black text-white">
      {/* header כמו שהיה לך קודם */}
      <section className="p-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 shadow-sm p-3">
          <OrdersTable orders={orders} statusFilter={statusFilter} />
        </div>
      </section>
    </main>
  );
}

// // app/(dashboard)/dashboard/orders/page.tsx
// import { supabase } from "@/lib/supabaseClient";
// import OrdersTable from "./OrdersTable";

// type DbOrderRow = {
//   id: string;
//   created_at: string;
//   status: string;
//   payment_status: string;
//   total_amount: number;
//   customer_phone: string;
//   customer_note: string | null;
//   service_areas: {
//     name: string;
//     slug: string;
//   }[];
//   order_items: {
//     name: string;
//     quantity: number;
//   }[];
// };

// export default async function OrdersDashboardPage({
//   searchParams,
// }: {
//   searchParams: Promise<{ status?: string }>;
// }) {
//   const { status } = await searchParams; // 👈 כאן הקסם
//   const statusFilter = status ?? null;

//   const vendorId = process.env.DEFAULT_VENDOR_ID;
//   if (!vendorId) {
//     return <p className="p-4 text-red-600">DEFAULT_VENDOR_ID missing</p>;
//   }

//   let query = supabase
//     .from("orders")
//     .select(
//       `
//       id,
//       created_at,
//       status,
//       payment_status,
//       total_amount,
//       customer_phone,
//       customer_note,
//       service_areas ( name, slug ),
//       order_items ( name, quantity )
//     `
//     )
//     .eq("vendor_id", vendorId)
//     .order("created_at", { ascending: false })
//     .limit(100);

//   if (statusFilter) {
//     query = query.eq("status", statusFilter);
//   }

//   const { data, error } = await query;

//   if (error) {
//     console.error("Error loading orders:", error);
//   }

//   const orders = (data ?? []) as DbOrderRow[];

//   return (
//     <main className="min-h-screen bg-slate-100">
//       <header className="p-4 border-b bg-white flex items-center justify-between">
//         <div>
//           <h1 className="text-2xl font-bold">הזמנות</h1>
//           <p className="text-sm text-slate-500">
//             {statusFilter
//               ? `מציג רק סטטוס: ${statusFilter}`
//               : "מציג את כל ההזמנות"}
//           </p>
//         </div>
//       </header>

//       <section className="p-4">
//         <OrdersTable orders={orders} statusFilter={statusFilter} />
//       </section>
//     </main>
//   );
// }
