// app/page.tsx
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">ברוך הבא ל"בדרך אליך"</h1>
      <p className="text-lg">
        זה דף הבית הזמני. נסה להיכנס ל־<code className="mx-1">/park/demo</code> או <code className="mx-1">/dashboard/orders</code>.
      </p>
    </main>
  );
}
