# JDG Aggregates

Public website for JDG Aggregates, a JDG Industries LLC brand serving Miami-Dade and Broward.

## Site and publishing

- `index.html`: page, material prices, estimate calculator, quote links and search metadata.
- `enhancements.css`: responsive design and accessible cart styling.
- `cart.js`: local load cart, editable quantities and combined email/text quote requests.
- `order-verification.js`: buyer, payer and delivery-recipient fields included in single-load and cart quote requests.
- `robots.txt` / `sitemap.xml`: public crawler entry points.
- `assets/`: optimized fleet photos and American flag.
- Static HTML with Vercel Node.js payment endpoints. `npm install` installs the Stripe server SDK; no frontend build is required.
- Production Vercel project: `index-v2` in the JDG Industries team (verified in the Dashboard). The separate `jdg` project deploys the same repository but does not own the public custom domain.
- Intended production branch: `main`.
- Existing production address: https://www.jdgindustries.com/

The `main` branch deploys through the existing GitHub/Vercel connection. Production is https://www.jdgindustries.com/. Verify the new commit has a successful Vercel status and that production serves it after each release.

## Content notes

The brand remains JDG Aggregates. The website palette is white, black and navy; full color is reserved for the American flag.

September 2026 customer material prices are preserved and exclude delivery, fuel, tax, and additional jobsite charges. The approved new standard is $195 delivery plus $45 fuel per actual delivery in Miami-Dade and Broward, equally for half and full trucks. Outlying northern Broward or southern Miami-Dade jobsites may require an additional quoted fuel surcharge; no automatic boundary or amount has been approved. Previously issued proposals are unchanged.

The quote form opens the visitor's email or messaging app; the visitor must send the request there. The cart stores material IDs, quantities and a numeric requested delivery count. That planning count is separate from material rows; JDG must confirm the actual grouping, capacity, jobsite and final quote before payment. Every material and quantity is retained in the quote request. Customer flags or a selected county/ZIP cannot approve payment.

This pricing review branch deliberately blocks all new Stripe sessions until an authenticated JDG quote-approval workflow is implemented and reviewed, as well as the credentials, signed webhook and confirmed tax setup. The existing merchant, payment-verification and dispatch safeguards remain. See `CHECKOUT-SETUP.md` for prerequisites. No automatic booking or dispatch is implemented. This draft is separate from the unapproved parent-brand redesign and is not a production release.

Only public website assets belong here. Do not commit credentials, supplier cost sheets, private reports, customer requests, or environment files.

## Image sources

Fleet photographs supplied by JDG. American flag: Wikimedia Commons, public domain, https://commons.wikimedia.org/wiki/File:Flag_of_the_United_States.svg. No alteration to the flag's colors or proportions.

## Order verification release, 2026-09-29

The quote form now collects buyer contact details, paying party, full jobsite location, county and recipient. It requires acknowledgment of the confirmation process. Third-party payer and recipient fields become required only when applicable. Both email and text requests include these details. This is collection and disclosure, not identity verification or an automatic fulfillment block: dispatch remains a manual JDG operation.

Before buying material or dispatching, JDG must independently confirm the payer and company authority, approved delivery address, recipient, itemized total and actual payment status in its payment provider. A customer's payment screenshot, email, form acknowledgment or card authorization alone is insufficient. Address/payer/recipient changes require reapproval. Record the delivery ticket, recipient, time, location and appropriate delivery photos. Customer identity documents and card details must not be requested through this email/text form.

Stripe connection checks found live card and Apple Pay availability. No live Stripe Tax registrations were recorded at the time of review. This release does not activate Stripe Checkout, automatic tax, 3D Secure or Radar rules. The connector does not expose Radar rule editing, and the Vercel connector did not expose the site's project settings. Finish and verify those controls before making payment-protection or online-checkout claims. A successful payment or 3DS authentication does not guarantee protection against every dispute.

## Purchase flow release, 2026-09-29

- Header estimate link, product-level 11/22-ton selectors, Buy now, Add to cart, cart checkout and arbitrary half-ton single loads.
- Stripe-hosted Checkout server endpoint with authoritative prices, per-load delivery/fuel, idempotency, 3DS request and hold-for-review metadata.
- Signed webhook records verified payment and review evidence in Stripe PaymentIntent metadata. It NEVER purchases material, books delivery or releases dispatch. Stripe is the durable payment/order record for this integration; there is no separate order database or driver app.
- Customer status page retrieves payment status from Stripe and has no fulfillment side effects.
- Checkout remains unavailable until all production requirements in `CHECKOUT-SETUP.md` are completed and verified. Customers can preserve their cart and request an estimate.
- `npm test` covers pricing, hostile inputs, request origin, launch lock, signature validation, paid/unpaid events, address mismatch and dispatch hold.

Earlier notes describe the previous quote-only release. Payment processing is implemented in source but **not activated** as of this release. No live key, webhook registration or tax configuration has been installed by this commit.
