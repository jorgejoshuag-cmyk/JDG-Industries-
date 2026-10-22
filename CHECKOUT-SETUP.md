# JDG checkout release prerequisites

This pricing review branch keeps online payment closed for unreviewed jobsites. The existing hosted Stripe Checkout integration remains behind configuration and merchant-readiness checks. Website credentials, approved tax setup, signed webhook delivery and a trusted JDG quote-approval path must all be verified before activation. ChatGPT's Stripe connection is not a website credential.

This draft does not change Production, the separate parent-brand redesign, previously issued proposals or existing quotes. It does not create credentials, configure webhooks, change account access or weaken preview protection.

## Approved delivery pricing for new business

- Standard delivery in Miami-Dade and Broward is **$195 delivery plus $45 fuel per actual delivery**, a $240 combined delivery/fuel charge. The same standard fees apply to half and full truck deliveries.
- Charge for the actual delivery plan confirmed by JDG, rather than treating every SKU as a separate confirmed delivery. Requested cart loads and product lines are estimates until that plan is reviewed.
- Outlying northern Broward or southern Miami-Dade addresses may require an additional **quoted** fuel surcharge. No surcharge amount, ZIP boundary or automatic distance rule has been approved.
- Review the exact jobsite, delivery count, access and any surcharge before payment. A customer's selected county, ZIP, acknowledgment or `approved` flag is not JDG approval.
- Preserve existing material prices and previously issued proposals. Apply the new delivery/fuel policy to new quotes and proposals going forward.

## Quote approval must precede checkout

All unreviewed addresses remain quote-first, including addresses inside Miami-Dade or Broward. A successful Stripe payment followed by manual address review would charge the customer before the final delivery price is known and does not satisfy this requirement.

Before reopening online payment, implement and review an authoritative server-side approval path. It must bind the actual street jobsite, customer order, material quantities, actual delivery groups/count, approved delivery/fuel charges, any quoted surcharge and applicable tax treatment. The browser must not be able to create or alter this approval. A changed address, material quantity, delivery plan or quoted amount must require renewed JDG review. The checkout address must stay consistent with the reviewed jobsite; checking only the ZIP after payment is insufficient.

The quote-first flow must retain every selected material and quantity so JDG can review the complete cart. Do not collect a payment merely because `CHECKOUT_ENABLED` or merchant configuration becomes ready. No final-weight settlement, cancellation, refund or surcharge policy is invented by this draft; obtain JDG's decisions before automating those operations.

## Required deployment settings

Use the existing `index-v2` Vercel project that owns `www.jdgindustries.com`; the apex redirects there. The separate `jdg` project is not the production website. Inspect environment variable names without decrypting or exposing values. Do not assume configuration is complete from an existing account ID or enable flag.

Sensitive values require an approved owner handoff directly into the appropriate Vercel environment. Never put credentials in this public repository, email or chat.

- `STRIPE_SECRET_KEY`: a restricted live key for Production, with only the permissions required by the reviewed integration: Checkout Sessions read/write, PaymentIntents read/write, Charges read for expanded review evidence, Account read, Tax Settings read, Tax Registrations read and Payment Method Configurations read. Verify the minimum permissions in an isolated Stripe sandbox first. Configure a separate sandbox key and sandbox account ID for Preview. Live keys are rejected outside Production; test keys are rejected in Production.
- `STRIPE_ACCOUNT_ID`: the expected JDG live account ID, verified during the owner handoff. Use the isolated sandbox account ID for Preview.
- `STRIPE_WEBHOOK_SECRET`: the signing secret for the correct approved endpoint and environment.
- `STRIPE_MATERIAL_TAX_CODE`, `STRIPE_DELIVERY_TAX_CODE`, `STRIPE_FUEL_TAX_CODE`: applicable Stripe tax codes confirmed by JDG and its tax advisor. Do not guess a classification, including treatment of an additional quoted fuel surcharge.
- `CHECKOUT_ENABLED`: leave `false` until the quote-approval path, configuration, merchant checks and full verification below are approved. This flag alone must never bypass jobsite review.

The existing hosted design would create a Checkout Session and redirect to Stripe after approval. This review branch deliberately creates no sessions: `/api/checkout-status` remains not ready and `/api/checkout` blocks payment even with complete merchant configuration. The pure session-pricing builder accepts a separate server-owned delivery plan for offline verification; structural validation of that plan is not an authenticated quote-approval system. The future approved workflow must supply and verify the authoritative jobsite and final quote. The website does not need a publishable key for the hosted flow. Apple Pay depends on eligible account settings, device, browser and wallet; do not promise that it displays for every customer.

## Tax setup

Verify active Stripe Tax settings and an active Florida registration. Confirm JDG's existing Florida sales-tax registration before recording it in Stripe; adding a Stripe registration does not register JDG with the state. Preserve the existing head-office address. Have JDG and its tax advisor approve material, delivery, fuel and additional surcharge treatment. Test calculations for reviewed Miami-Dade and Broward jobsites in the sandbox before approving live setup.

`verifyMerchant()` requires active Stripe Tax settings and an active Florida registration, verifies account identity and key mode, and checks the default card/Apple Pay configuration. `automatic_tax` in the session builder does not establish tax readiness on its own. Stripe explains that a missing registration can produce zero tax in its [Tax setup guide](https://docs.stripe.com/tax/set-up).

## Webhook

An authorized operator must check for an existing `https://www.jdgindustries.com/api/stripe-webhook` endpoint in the correct live account before creating a duplicate. Confirm the endpoint is enabled for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Only after approval, complete the signing-secret handoff in Vercel, redeploy the reviewed code and verify delivery of a signed event. Test a separate isolated sandbox endpoint as well. The handler must verify the signature against the raw request body and reject the wrong live/test environment. See Stripe's [webhook guide](https://docs.stripe.com/webhooks).

The current Vercel preview authentication must remain enabled. A protected preview is not automatically a publicly reachable webhook destination. Use a separately approved sandbox test setup; do not create an authentication bypass, expose a secret or change protection to make a test pass.

## Required verification before activation

1. Review the tested pricing-only diff and confirm that the parent-brand redesign and issued proposals are unchanged. Verify equal half/full fees, $240 per actual confirmed delivery, multiple confirmed deliveries and a cart with more than one SKU in one reviewed delivery plan.
2. Prove an unreviewed jobsite cannot create a Stripe session even when merchant configuration is otherwise ready. Reject browser-supplied approval flags, fees, delivery counts and material prices as authority. Preserve cart details when returning to a quote request.
3. After the approved configuration handoff, run actual sandbox website-to-Stripe checkout with reviewed jobsites and signed webhook delivery. Verify tax, supported payment methods, successful card/3DS, declined payment, cancellation, retries and repeated clicks.
4. Confirm invalid signatures, unpaid sessions and failed asynchronous events produce no payment-verification write. Paid events must retain the dispatch hold. Verify duplicate and out-of-order events using current Stripe payment state.
5. Review risk settings and payer-verification operations with JDG before release. Existing code does not configure Radar or approve risk rules. A requested 3DS challenge is not guaranteed authentication or liability shift.
6. Confirm restricted-key permissions, expected account, environment separation, active tax registration, approved tax codes, method configuration and webhook. `/api/checkout-status` must not advertise payment readiness while jobsite/quote approval remains unavailable.
7. Verify Apple Pay on an eligible Apple device using confirmed sandbox/test credentials. Offline tests do not establish real wallet availability. Do not make a live charge as a test.

Run `npm test` for offline regressions. Passing fixture-based tests does not replace the actual sandbox checkout, tax, signed webhook delivery and wallet checks. See Stripe's [restricted-key guidance](https://docs.stripe.com/keys-best-practices) for secure key handling.

## Dispatch workflow

Stripe payment status, successful webhook processing and the website result page must never release dispatch. Find the integration's order and verify actual successful payment, webhook evidence, payer authority, risk/card evidence, the approved jobsite and delivery plan, material availability and recipient through JDG's operational process before purchasing material or dispatching a truck.

The integration sets `dispatch_status=hold_for_jdg_approval` and does not release that hold. Payment metadata is an operational signal, not an authorization system for dispatch staff. Never treat a customer screenshot or a manually edited metadata flag as payment or delivery approval.

The browser persists material IDs and quantities, not buyer contact or card details. A requested delivery date is not a reservation. Preserve JDG's existing delivery tickets, photos and operational records. Additional charges are not automatically debited.
