# Launch status and required verification

Prepared 2026-09-29. This is a staged implementation, not a live payment-enabled site.

## Access blockers

GitHub source is accessible. The Vercel connection lists team `team_5lx3bVobot6rDpZzGTf0XNEY` (JDG Industries), but returns no projects. The intended `jdg` project and `jdg-seven.vercel.app` deployment could not be resolved through this connection. Extend authorization to the actual hosting project/team; do not create a duplicate production project or move the domain as a workaround.

Stripe was available to connect but not installed/authorized at inspection. The connection prompt was displayed in ChatGPT. Business verification, payout banking and any account agreements must be completed by the owner directly with Stripe. Do not paste keys into chat. Connecting the ChatGPT Stripe app alone does not install server credentials in Vercel.

## Source and deployment

Keep `main` unchanged until a preview can be deployed and reviewed. Preserve the original `assets/` photographs and flag. The downloadable source overlay excludes those existing image binaries. Runtime: Node 22, static HTML plus Vercel Node functions. Install and validate the pinned Stripe SDK from package.json, produce/review its lockfile and run the tests. Verify the current SDK and API version against Stripe documentation during integration testing.

Deploy this feature branch as a preview on the existing hosting project. Confirm custom-domain mapping, all asset URLs, security headers, mobile layout, mail/SMS handoff and no regression in existing contact paths. Review any active external forms or analytics before replacing production. Do not enable checkout just because a preview builds.

## Owner-approved commerce rules

Confirm retail prices, availability, delivery-zone ZIPs, load limits and the current delivery/fuel charges. Choose which products are eligible for online payment and a pricing expiration date. Special-distance, restricted-access, rush, tax-exempt and large/project orders should remain quote-first until their rules are implemented.

Confirm payment versus estimated/ticketed weight, any deposit or balance/refund adjustment, cancellation/refund policy, access/waiting charges, delivery confirmation process and privacy/customer-data handling. The implementation currently creates a one-time payment, not a deposit, authorization-only hold or subscription. Do not enable it until the customer-facing checkout notice and policies accurately describe the approved process. No later weight difference is charged automatically.

Have the business/tax adviser confirm active Florida tax registration and correct Stripe tax codes for aggregate, delivery and fuel. Never assume one flat tax rate, register the business automatically, or choose an exempt code just to make checkout succeed. Verify Stripe Tax settings and a test calculation, including taxability reasons. Code blocks payment when tax setup reports `not_collecting`.

## Server configuration (sensitive values stay outside GitHub)

- `STRIPE_SECRET_KEY`: preferably a restricted Stripe key with only the tested permissions required by account/tax checks, customers, Checkout Sessions and PaymentIntent metadata. Store as a sensitive Vercel environment value. Separate sandbox and live credentials.
- `STRIPE_WEBHOOK_SECRET`: signature secret for the exact deployed endpoint and environment.
- `JDG_SITE_ORIGIN`: approved HTTPS origin with no path/query, matching the customer-facing site.
- `JDG_DELIVERY_ZONES`: JSON object of individually approved five-digit ZIP codes mapped to `Miami-Dade` or `Broward`. No defaults are supplied.
- `JDG_APPROVED_SKUS`: comma-separated catalog IDs approved for online payment.
- `JDG_MATERIAL_TAX_CODE`, `JDG_DELIVERY_TAX_CODE`, `JDG_FUEL_TAX_CODE`: exact verified Stripe tax-code IDs, no guessed defaults.
- `JDG_PRICING_VALID_UNTIL`: approved YYYY-MM-DD price expiration.
- `JDG_CHECKOUT_NOTICE`: approved customer-facing order/payment terms, up to 450 characters.
- `JDG_ORDER_TERMS_APPROVED`, `JDG_CHECKOUT_QA_APPROVED`, `JDG_CHECKOUT_ENABLED`: all must equal `true` only after the relevant verification is complete. Leave unset while staging.

Configure production rate limiting/abuse protection for payment-session creation; verify it does not block Stripe webhook delivery. Configure only requested payment methods in the merchant Dashboard and verify Visa and eligible Apple Pay availability. Hosted Checkout handles card entry; this site's own page never collects card numbers. Register/verify the relevant domains if the selected Stripe checkout surface requires it.

## Required real sandbox tests

Create the webhook endpoint `/api/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`. Verify Vercel exposes the untouched raw body; signature verification must fail closed if the runtime parses it first. Local mocks do not prove runtime behavior.

Test card success, decline and authentication; Apple Pay on an eligible actual device; cancellation/retry; duplicate clicks/requests; invalid signatures and replayed/out-of-order events; delayed payment success/failure; address and SKU rejection; tax calculation; date/access conditions; real image rendering; receipts, notifications and post-payment operations. Test refund/weight-adjustment procedures with the approved commercial rules.

The webhook records `paid_pending_dispatch` in Stripe PaymentIntent metadata. It does not book trucks, send operational emails, create QuickBooks invoices or maintain a separate CRM/order database. Before live operation, establish staff notifications, receipts, reconciliation and the dispatch handoff; verify a real sample order can be found and handled. Add a durable order/outbox store if those workflows are automated. Real-time inventory/reservations and QuickBooks synchronization are not part of this version.

Only after successful sandbox verification and owner-approved terms: set separate production credentials, perform an authorized production verification, promote the reviewed deployment and check the actual public domain. Record exact deployment and payment test results. No real charge is authorized merely by building this code.
