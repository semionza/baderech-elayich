// lib/tranzila.ts
import crypto from "crypto";

const TRANZILA_APP_KEY = process.env.TRANZILA_APP_KEY!;
const TRANZILA_ACCESS_TOKEN = process.env.TRANZILA_ACCESS_TOKEN!;
const TRANZILA_CREATE_DOCUMENT_URL =
  process.env.TRANZILA_CREATE_DOCUMENT_URL!;
const TRANZILA_TERMINAL_NAME = process.env.TRANZILA_TERMINAL_NAME;
const TRANZILA_CURRENCY = process.env.TRANZILA_CURRENCY || "1"; // לדוגמה ILS

if (!TRANZILA_APP_KEY || !TRANZILA_ACCESS_TOKEN || !TRANZILA_CREATE_DOCUMENT_URL) {
  console.warn(
    "[Tranzila] Missing one of TRANZILA_APP_KEY / TRANZILA_ACCESS_TOKEN / TRANZILA_CREATE_DOCUMENT_URL"
  );
}

function buildTranzilaHeaders() {
  const requestTime = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();

  return {
    "X-tranzila-api-app-key": TRANZILA_APP_KEY,
    "X-tranzila-api-request-time": requestTime,
    "X-tranzila-api-nonce": nonce,
    "X-tranzila-api-access-token": TRANZILA_ACCESS_TOKEN,
    "Content-Type": "application/json",
  };
}

// טיפוס פשטני להזמנה, אפשר להרחיב לפי הצורך
export type OrderForInvoice = {
  id: string;
  total_amount: number;        // באגורות
  customer_phone: string | null;
  created_at: string | null;
  // אם יש לך כבר items – אפשר להעביר גם אותם
  items?: {
    name: string;
    quantity: number;
    unit_price: number;        // באגורות
  }[];
};

// כאן יוצרים את המסמך החשבונאי ב-Tranzila
export async function tranzilaCreateDocument(order: OrderForInvoice) {
  if (!TRANZILA_CREATE_DOCUMENT_URL) {
    throw new Error("TRANZILA_CREATE_DOCUMENT_URL is not configured");
  }

  const amountInShekels = order.total_amount / 100;

  // ❗❗ כאן חשוב להתאים את שמות השדות לפי ה-Docs שלך ב-Tranzila
  const payload: any = {
    // דוגמאות אופייניות – תחליף לשמות המדויקים מהמסמך "Create document"
    terminal_name: TRANZILA_TERMINAL_NAME,
    currency: TRANZILA_CURRENCY,
    amount: amountInShekels.toFixed(2),
    // סוג מסמך – צריך לבדוק בערכים של Tranzila (חשבונית/קבלה לעוסק פטור)
    // doc_type: "RECEIPT", 
    customer: {
      phone: order.customer_phone ?? "",
      // אפשר להוסיף name / email אם יש לך
    },
    // אם Tranzila תומכים בשורות פריט במסמך:
    // items: order.items?.map(...)
  };

  const res = await fetch(TRANZILA_CREATE_DOCUMENT_URL, {
    method: "POST",
    headers: buildTranzilaHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("[Tranzila] Create document error:", res.status, data);
    throw new Error("Failed to create Tranzila document");
  }

  // לפי ה-Docs של Tranzila, מתקבל איזה מזהה/טוקן של המסמך
  // לדוגמה: { document_id, financial_document_id, pdf_token, ... }
  return data;
}
