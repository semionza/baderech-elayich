// app/(dashboard)/waiter/page.tsx

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import WaiterView from "./WaiterView";
import { redirect } from "next/navigation";

type WaiterOrderRow = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer_phone: string;
  customer_note: string | null;
  lat: number | null;
  lng: number | null;
  service_areas: { name: string; slug: string }[];
  order_items: { name: string; quantity: number }[];
};

export default async function WaiterPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("vendor_id, service_area_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError || !staff || (staff.role !== "WAITER" && staff.role !== "BOTH")) {
    console.error("User not waiter for any area");
    redirect("/auth/login");
  }

  const { data, error } = await supabase
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
      lat,
      lng,
      service_areas ( name, slug ),
      order_items ( name, quantity )
    `
    )
    .eq("vendor_id", staff.vendor_id)
    .eq("service_area_id", staff.service_area_id)
    .in("status", ["PENDING", "ACCEPTED", "ON_THE_WAY"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading waiter orders:", error);
  }

  const orders = (data ?? []) as WaiterOrderRow[];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* header וכו' */}
      <section className="p-3">
        <WaiterView orders={orders} />
      </section>
    </main>
  );
}

// import { supabase } from "@/lib/supabaseClient";
// import WaiterView from "./WaiterView";

// type WaiterOrderRow = {
//   id: string;
//   created_at: string;
//   status: string;
//   payment_status: string;
//   total_amount: number;
//   customer_phone: string;
//   customer_note: string | null;
//   lat: number | null;
//   lng: number | null;
//   service_areas: {
//     name: string;
//     slug: string;
//   }[];
//   order_items: {
//     name: string;
//     quantity: number;
//   }[];
// };

// export default async function WaiterPage() {
//   const vendorId = process.env.DEFAULT_VENDOR_ID;
//   if (!vendorId) {
//     return (
//       <main className="min-h-screen bg-black text-red-400 flex items-center justify-center">
//         DEFAULT_VENDOR_ID missing
//       </main>
//     );
//   }

//   // נמשוך הזמנות בתשלום מזומן (UNPAID) וסטטוס שעדיין חי
//   const { data, error } = await supabase
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
//       lat,
//       lng,
//       service_areas ( name, slug ),
//       order_items ( name, quantity )
//     `
//     )
//     .eq("vendor_id", vendorId)
//     .in("status", ["PENDING", "ACCEPTED", "ON_THE_WAY"])
//     .order("created_at", { ascending: true });

//   if (error) {
//     console.error("Error loading waiter orders:", error);
//   }

//   const orders = (data ?? []) as WaiterOrderRow[];

//   return (
//     <main className="min-h-screen bg-black text-white">
//       <header className="p-4 border-b border-neutral-800 bg-neutral-950">
//         <h1 className="text-2xl font-bold">מסך מלצר</h1>
//         <p className="text-sm text-neutral-400">
//           הזמנות פתוחות לתשלום ומסירה.
//         </p>
//       </header>

//       <section className="p-3">
//         <WaiterView orders={orders} />
//       </section>
//     </main>
//   );
// }
