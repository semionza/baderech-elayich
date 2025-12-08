// "use client";

// import { useState } from "react";
// import { supabase } from "@/lib/supabaseClient";
// import { useRouter } from "next/navigation";

// export default function LoginPage() {
//   const router = useRouter();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [errorMsg, setErrorMsg] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   async function handleLogin(e: React.FormEvent) {
//     e.preventDefault();
//     setErrorMsg(null);
//     setLoading(true);

//     const { data, error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     setLoading(false);

//     if (error) {
//       setErrorMsg(error.message);
//       return;
//     }

//     // אחרי לוגין, שולחים ל-dashboard
//     router.push("/dashboard/orders");
//     router.refresh();
//   }

//   return (
//     <main className="min-h-screen bg-black text-white flex items-center justify-center">
//       <form
//         onSubmit={handleLogin}
//         className="w-full max-w-sm border border-neutral-800 bg-neutral-950 rounded-xl p-4 space-y-3"
//       >
//         <h1 className="text-xl font-bold mb-2">התחברות צוות</h1>

//         <div className="space-y-1 text-sm">
//           <label>אימייל</label>
//           <input
//             type="email"
//             className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//           />
//         </div>

//         <div className="space-y-1 text-sm">
//           <label>סיסמה</label>
//           <input
//             type="password"
//             className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//           />
//         </div>

//         {errorMsg && (
//           <p className="text-xs text-red-400">{errorMsg}</p>
//         )}

//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full mt-2 px-4 py-2 rounded bg-emerald-600 text-white text-sm disabled:bg-neutral-600"
//         >
//           {loading ? "מתחבר..." : "התחברות"}
//         </button>
//       </form>
//     </main>
//   );
// }

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type StaffRow = {
  role: "DASHBOARD" | "WAITER" | "BOTH";
  is_active: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setLoading(false);
      setErrorMsg("לא נמצא משתמש אחרי התחברות.");
      return;
    }

    // 🔹 אחרי לוגין – בודקים מה התפקידים שלו ב-staff_members
    const { data: staffRows, error: staffError } = await supabase
      .from("staff_members")
      .select("role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true);

    setLoading(false);

    if (staffError) {
      console.error("staff_members error:", staffError);
      setErrorMsg("שגיאה בבדיקת הרשאות המשתמש.");
      return;
    }

    if (!staffRows || staffRows.length === 0) {
      setErrorMsg("אין לך הרשאה למערכת (אין רישום staff).");
      return;
    }

    const roles = new Set(staffRows.map((r) => r.role));

    // 🔸 לוגיקה להפניה:
    // אם יש WAITER ואין DASHBOARD -> /waiter
    // אם יש DASHBOARD או BOTH -> /dashboard/orders
    let targetPath = "/dashboard/orders";

    if (roles.has("WAITER") && !roles.has("DASHBOARD") && !roles.has("BOTH")) {
      targetPath = "/waiter";
    } else {
      // אם יש BOTH או DASHBOARD – נשארים בדשבורד
      targetPath = "/dashboard/orders";
    }

    router.push(targetPath);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm border border-neutral-800 bg-neutral-950 rounded-xl p-4 space-y-3"
      >
        <h1 className="text-xl font-bold mb-2">התחברות צוות</h1>

        <div className="space-y-1 text-sm">
          <label>אימייל</label>
          <input
            type="email"
            className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1 text-sm">
          <label>סיסמה</label>
          <input
            type="password"
            className="w-full border border-neutral-700 bg-black rounded px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 whitespace-pre-line">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 px-4 py-2 rounded bg-emerald-600 text-white text-sm disabled:bg-neutral-600"
        >
          {loading ? "מתחבר..." : "התחברות"}
        </button>
      </form>
    </main>
  );
}
