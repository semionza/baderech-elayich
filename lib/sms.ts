// lib/sms.ts
import twilio from "twilio";
import { normalizeIsraeliPhone } from "./phone";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; 
const fromNumber = process.env.TWILIO_FROM_NUMBER; 


export async function sendSms(to: string, message: string) {
  if (!to) {
    console.warn("[SMS] Missing phone number, skipping.");
    return;
  }

  let normalized = normalizeIsraeliPhone(to);

  if (!normalized) {
    console.warn("[SMS] Invalid phone number:", to);
    return;
  }

  // For dev mode – do NOT send real SMS
  if (process.env.NODE_ENV !== "production") {
    console.log("[SMS MOCK] Would send SMS:", { to, message });
    return;
  }

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are missing.");
  }

  const client = twilio(accountSid, authToken);

  try {
    const result = await client.messages.create({
      body: message,
      to: normalized,                        // customer phone number
      ...(messagingServiceSid
        ? { messagingServiceSid }            // recommended for production
        : { from: fromNumber })              // fallback to raw number
    });

    console.log("[SMS SENT]", result.sid);
  } catch (e) {
    console.error("[SMS ERROR]", e);
    throw e;
  }
}