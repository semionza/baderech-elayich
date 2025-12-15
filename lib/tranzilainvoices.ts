// lib/invoices.ts
import { tranzilaCreateDocument, OrderForInvoice } from "./tranzila";

export async function createInvoiceForOrder(order: OrderForInvoice) {
  // בשלב הזה זה כבר הולך באמת ל-Tranzila ולא MOCK
  const doc = await tranzilaCreateDocument(order);

  // לפי ה-Docs של Tranzila:
  // - לפעמים מוחזר URL ישיר ל-PDF
  // - לפעמים מוחזר token שצריך להכניס ל-get_financial_document
  //
  // לדוגמה (לפי הדוק של "get_financial_document"):
  // GET https://my.tranzila.com/api/get_financial_document/{token} מחזיר PDF.

  const pdfUrl =
    doc.pdf_url ??
    (doc.token
      ? `https://my.tranzila.com/api/get_financial_document/${doc.token}`
      : null);

  return {
    invoiceId: doc.document_id ?? doc.id ?? "UNKNOWN",
    url: pdfUrl,
    raw: doc,
  };
}
