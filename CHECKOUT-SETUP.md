# Activate JDG checkout

Code and purchase UI are implemented behind a configuration and merchant-readiness gate. Before activation, verify the approved restricted server key, webhook signing-secret configuration, merchant readiness and tax setup. ChatGPT's Stripe connection is not a website credential. Account-specific verification status belongs in private operational records.

## Required production settings

Set sensitive values through an approved user handoff in the `index-v2` Vercel project's Production environment. This project owns `www.jdgindustries.com`; the apex redirects there. The separate `jdg` project only owns `jdg-seven.vercel.app`. Inspect configuration names without exposing secret values. Do not put credentials in this public repository, email or chat.

- `STRIPE_SECRET_KEY`: a restricted **live** key with Checkout Sessions write/read, PaymentIntents read/write, Charges read (for expanded review evidence), Account read, Tax Settings read, Tax Registrations read and Payment Method Configurations read. Test minimum permissions in sandbox first. Configure a separate sandbox key and sandbox account ID in the Vercel Preview environment. Live keys are rejected outside Production; test keys are rejected in Production. Preview redirects use the trusted Vercel deployment hostname.
- `STRIPE_ACCOUNT_ID`: the expected live Stripe account ID, verified through the approved user handoff. Use the isolated sandbox account ID for Preview.
- `STRIPE_WEBHOOK_SECRET`: the signing secret from the live webhook configured below.
- `STRIPE_MATERIAL_TAX_CODE`, `STRIPE_DELIVERY_TAX_CODE`, `STRIPE_FUEL_TAX_CODE`: confirmed applicable Stripe tax codes. Do not guess. Confirm classification with JDG and its tax advisor.
- `CHECKOUT_ENABLED`: keep `false` until the full test and configuration checks below pass, then set `true` and redeploy.

This integration creates a Checkout Session on the server and redirects to Stripe's hosted page. It does not require a publishable key, an Apple developer account or registration of the JDG domain for Apple Pay. Stripe's [Apple Pay guide](https://docs.stripe.com/apple-pay?platform=web) confirms the hosted Checkout configuration; its [domain registration guide](https://docs.stripe.com/payments/payment-methods/pmd-registration) applies to Elements and Checkout's embeddable payment form. Apple Pay is presented by Stripe on eligible devices/browsers with an eligible wallet. Do not promise it will display on every browser.

## Tax setup

Verify active Stripe Tax settings and an active Florida registration. Confirm JDG's existing Florida sales-tax registration before recording it in Stripe; adding it to Stripe does not register JDG with the state. Preserve the existing head-office address. Confirm material, delivery and fuel tax classification with JDG and its tax advisor. Run a sandbox tax calculation for a Miami-Dade and Broward shipping address, then check live setup. Do not turn on live checkout until tax calculation is verified.

`verifyMerchant()` requires active Stripe Tax settings and an active Florida registration, checks account identity and payment capabilities, and prevents checkout when those checks fail. Each session enables automatic tax only after these checks.

## Webhook

Check for an existing `https://www.jdgindustries.com/api/stripe-webhook` endpoint in the same live Stripe account before creating another. Verify it is enabled for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Complete the approved signing-secret handoff in Vercel, redeploy after approval, and verify a signed event reaches the endpoint. Reuse a correct existing live endpoint rather than creating a duplicate. Also configure and test an isolated sandbox endpoint. The handler must receive the raw request body.

## Required verification before activation

1. In a sandbox, run the real website-to-Stripe flow with the sandbox key and webhook. Verify half/full/multiple loads, delivery and fuel, tax and supported wallets, successful card/3DS, declined payment, cancelled checkout and repeated clicks.
2. Confirm no browser-supplied amount changes the server total; keys never reach HTML, JS or logs.
3. Confirm unpaid or invalidly signed events produce no payment-verification write. Paid events must preserve the dispatch hold and surface address/card/risk issues for manual review. Verify retries and out-of-order events.
4. Configure Radar in the Dashboard; its rules are not changed by this integration. Block high-risk charges and establish the review policy with JDG. A 3DS request is not guaranteed authentication or guaranteed liability shift. Wallets have different authentication evidence.
5. Confirm the restricted key's permissions, live account, active tax registration, method configuration and webhook. Verify `/api/checkout-status` reports ready only after setup.
6. Verify Apple Pay on a supported Apple device using confirmed sandbox/test credentials. An eligible saved Wallet card may be required, but Stripe test credentials prevent a real charge. Follow Stripe's [wallet testing guide](https://docs.stripe.com/testing/wallets). Never take a real payment as a test.

Run `npm test` for offline coverage of authoritative totals, invalid orders, retry identifiers, pending submission locks, merchant-readiness gates and signed webhook handling. Passing these fixture-based tests does not replace the actual sandbox checkout, tax calculation, signed webhook delivery and Apple-device checks above.

## Dispatch workflow

In Stripe, find orders with `integration=jdg_aggregate_checkout_hmqrvxna` and `dispatch_status=hold_for_jdg_approval`. Check actual successful payment, webhook evidence (`jdg_payment_verified=true`), payer authority, bank authentication/wallet details, risk/card checks, shipping ZIP and county, actual material availability and recipient before buying material or dispatching. Payment metadata is an operational hold, not access control for the dispatch staff. Never treat a website success page or customer screenshot as payment proof.

The current server checks a South Florida ZIP prefix and the stated county, then flags mismatched actual shipping address/state after payment. It does not independently geocode jobsites. Confirm serviceability before dispatch; expand to an authoritative address lookup before any automatic fulfillment. Additional charges are not automatically debited.

The browser saves only material IDs and quantities. Buyer contact, shipping and payment details are collected by Stripe. A preferred date is a request, not a reservation. Keep signed delivery tickets and photos through JDG's existing operations process.
