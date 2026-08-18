"use strict";

// =====================================================================
// SUBSCRIPTION BACKEND — talks to Razorpay on behalf of the frontend.
//
// Two callable functions, called from the browser via the Firebase SDK
// (firebase.functions().httpsCallable(...)):
//
//   createSubscriptionOrder   — creates a ₹12,000 Razorpay order for the
//                                signed-in admin, and marks their
//                                subscription "payment_pending".
//   verifySubscriptionPayment — verifies the Razorpay payment signature
//                                after Checkout succeeds, and ONLY THEN
//                                marks the subscription "premium_active".
//
// The Razorpay Key Secret lives only here (as an environment variable),
// never in any file that ships to the browser.
// =====================================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Razorpay = require("razorpay");

admin.initializeApp();
// Mumbai region — closest to India-based users and to Razorpay itself.
setGlobalOptions({ region: "asia-south1" });

const PREMIUM_AMOUNT_PAISE = 1200000; // ₹12,000 — Razorpay amounts are always in paise
const PREMIUM_MONTHS = 12;

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpsError(
      "failed-precondition",
      "Razorpay is not configured on the server yet (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)."
    );
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// Looks up the caller's own restaurantId from their Firebase Auth uid.
// Every write in this file is scoped to that restaurant only — no caller
// can ever touch another account's subscription data.
async function getOwnRestaurantId(uid) {
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  if (!userSnap.exists || userSnap.data().role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only the account admin can manage the subscription."
    );
  }
  return userSnap.data().restaurantId;
}

function validateCustomer(customer) {
  if (
    !customer ||
    !customer.name ||
    !customer.email ||
    !customer.phone ||
    !customer.org ||
    !customer.address
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Name, email, phone, organization and address are all required."
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new HttpsError("invalid-argument", "Invalid email address.");
  }
  if (!/^[6-9]\d{9}$/.test(customer.phone)) {
    throw new HttpsError("invalid-argument", "Invalid Indian phone number.");
  }
}

// ---------------------------------------------------------------------
// createSubscriptionOrder
// ---------------------------------------------------------------------
exports.createSubscriptionOrder = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const customer = request.data && request.data.customer;
  validateCustomer(customer);

  const restaurantId = await getOwnRestaurantId(auth.uid);
  const razorpay = getRazorpayInstance();

  const order = await razorpay.orders.create({
    amount: PREMIUM_AMOUNT_PAISE,
    currency: "INR",
    receipt: "sub_" + restaurantId + "_" + Date.now(),
    notes: { restaurantId: restaurantId, plan: "premium" },
  });

  await admin
    .firestore()
    .collection("restaurants")
    .doc(restaurantId)
    .set(
      {
        subscription: {
          status: "payment_pending",
          plan: "premium",
          customer: customer,
          razorpay: { orderId: order.id },
        },
      },
      { merge: true }
    );

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
});

// ---------------------------------------------------------------------
// verifySubscriptionPayment
// ---------------------------------------------------------------------
exports.verifySubscriptionPayment = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    request.data || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new HttpsError("invalid-argument", "Missing payment details.");
  }

  const restaurantId = await getOwnRestaurantId(auth.uid);
  const restaurantRef = admin
    .firestore()
    .collection("restaurants")
    .doc(restaurantId);

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new HttpsError(
      "failed-precondition",
      "Razorpay is not configured on the server yet (missing RAZORPAY_KEY_SECRET)."
    );
  }

  // This is the exact signature check Razorpay's own docs specify:
  // HMAC-SHA256 of "order_id|payment_id", signed with your Key Secret.
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await restaurantRef.set(
      { subscription: { status: "payment_failed" } },
      { merge: true }
    );
    throw new HttpsError("permission-denied", "Payment verification failed.");
  }

  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + PREMIUM_MONTHS);

  await restaurantRef.set(
    {
      subscription: {
        status: "premium_active",
        plan: "premium",
        premiumStart: now.toISOString(),
        premiumExpiry: expiry.toISOString(),
        razorpay: {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signatureVerified: true,
        },
      },
    },
    { merge: true }
  );

  return { success: true, premiumExpiry: expiry.toISOString() };
});
