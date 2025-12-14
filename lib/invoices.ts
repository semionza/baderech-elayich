// lib/invoices.ts

// טיפוס בסיסי של הזמנה לצורך חשבונית
export type OrderForInvoice = {
  id: string;
  total_amount: number;
  customer_phone: string | null;
  created_at: string | null;
};

// פונקציה ליצירת חשבונית להזמנה
export async function createInvoiceForOrder(order: OrderForInvoice) {
  // בשלב ראשון – MOCK בלבד
  if (process.env.NODE_ENV !== "production") {
    console.log("[INVOICE MOCK] Creating invoice for order:", {
      orderId: order.id,
      totalAmount: order.total_amount,
      customerPhone: order.customer_phone,
      createdAt: order.created_at,
    });

    // מחזירים אובייקט דמה עם url
    return {
      invoiceId: `MOCK-${order.id}`,
      url: `https://example.com/invoices/mock/${order.id}`,
    };
  }

  // כאן בעתיד: אינטגרציה אמיתית מול ספק חשבוניות (iCount / ירוק / חשבונית אונליין וכו')
  // לדוגמה:
  // const res = await fetch("https://api.invoice-provider.com/invoices", { ... });
  // const data = await res.json();
  // return { invoiceId: data.id, url: data.link };

  throw new Error(
    "Real invoice provider is not implemented yet in production."
  );
}
