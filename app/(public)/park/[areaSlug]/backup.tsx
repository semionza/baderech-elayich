import { notFound } from "next/navigation";

type ParkPageProps = {
  params: {
    areaSlug: string;
  };
};

const MOCK_AREAS = ["gina1", "demo"]; // לעכשיו, בסוף נביא מה-DB

export default function ParkPage({ params }: ParkPageProps) {
  const { areaSlug } = params;

  // בדיקה בסיסית - אם ה-slug לא קיים ברשימה, אפשר 404:
  if (!MOCK_AREAS.includes(areaSlug)) {
    notFound();
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="p-4 border-b bg-white">
        <h1 className="text-2xl font-bold">
          הזמנות לגינה: <span className="text-emerald-600">{areaSlug}</span>
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          כאן בהמשך יוצג התפריט, סל קניות, ותהליך הזמנה.
        </p>
      </header>

      <section className="flex-1 p-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">תפריט (Mock)</h2>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>קפה</span>
              <span>12 ₪</span>
            </li>
            <li className="flex justify-between">
              <span>בירה</span>
              <span>22 ₪</span>
            </li>
            <li className="flex justify-between">
              <span>יין</span>
              <span>26 ₪</span>
            </li>
          </ul>

          <p className="mt-4 text-sm text-slate-500">
            בשלב הבא נוסיף כאן חיבור ל-Supabase, עגלה, ובדיקת מיקום.
          </p>
        </div>
      </section>
    </main>
  );
}
