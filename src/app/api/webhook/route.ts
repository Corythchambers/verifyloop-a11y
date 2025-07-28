import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  let event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    if (!sig) {
      throw new Error("No Stripe signature found");
    }

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      console.log("Payment successful for session:", session.id);

      // Trigger scan processing via webhook (backup method)
      // This ensures scan happens even if client-side trigger fails
      try {
        await triggerScanFromWebhook(session);
      } catch (error) {
        console.error("Failed to trigger scan from webhook:", error);
      }

      console.log("Customer email:", session.customer_details?.email);
      console.log("Amount paid:", session.amount_total);
      console.log("Scan type:", session.metadata?.scanType);

      break;

    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log("PaymentIntent was successful:", paymentIntent.id);
      break;

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      console.log("PaymentIntent failed:", failedPayment.id);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

// Function to trigger scan from webhook
async function triggerScanFromWebhook(session: any) {
  console.log("Triggering scan from webhook for session:", session.id);

  // In a real implementation, you would:
  // 1. Retrieve the scan configuration from your database using session.id
  // 2. Or decode it from session.metadata if you stored it there

  // For now, we'll log that we would trigger the scan
  // This is a backup mechanism in case the client-side trigger fails

  console.log("Webhook would trigger scan for session:", session.id);
  console.log("Customer email:", session.customer_details?.email);

  // TODO: Implement database lookup to get scan configuration
  // TODO: Call /api/queue-scan with the retrieved configuration
}
