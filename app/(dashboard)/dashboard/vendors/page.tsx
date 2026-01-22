import VendorsManager from "./VendorsManager";

export default function VendorsPage() {
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">ניהול ונדורים</h1>
      <p className="text-xs text-neutral-400 mt-1">
        יצירה וניהול ספקים/חנויות בפלטפורמה
      </p>

      <div className="mt-4">
        <VendorsManager />
      </div>
    </main>
  );
}
