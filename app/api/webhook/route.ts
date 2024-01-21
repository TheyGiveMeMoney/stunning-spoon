import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }
  const session = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.completed") {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );

    if (!session?.metadata?.userId) {
      return new NextResponse("User id is required", { status: 400 });
    }
    const createdSubscription = await prismadb.userSubscription.create({
      data: {
        userId: session?.metadata?.userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000
        ),
      },
    });

    console.log("Created User Subscription:", createdSubscription);
  }

  if (event.type === "invoice.payment_succeeded") {
    console.log("Event received:", event);

    // Retrieve the subscription associated with the session
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    console.log("Retrieved Subscription:", subscription);

    let userSubscription = null;
    let retryCount = 0;
    const maxRetries = 10; // Adjust the number of retries as needed
    const retryInterval = 5000; // 5 seconds (adjust as needed)

    // Retry until userSubscription is found or max retries exceeded
    while (!userSubscription && retryCount < maxRetries) {
      userSubscription = await prismadb.userSubscription.findUnique({
        where: {
          stripeSubscriptionId: subscription.id,
        },
      });

      if (!userSubscription) {
        console.log(
          `No User Subscription found with the provided stripeSubscriptionId (Retry ${retryCount + 1}/${maxRetries})`
        );
        retryCount++;
        await sleep(retryInterval);
      }
    }

    if (userSubscription) {
      // Update the user subscription in the database
      await prismadb.userSubscription.update({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
        },
      });

      console.log("Updated User Subscription:", {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000
        ),
      });
    } else {
      console.log("Max retries exceeded. User Subscription not found.");
    }
  }

  return new NextResponse(null, { status: 200 });
}
