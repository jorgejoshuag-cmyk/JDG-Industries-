# Verification record: 2026-09-29

## Completed locally

- `npm test`: 23 passing Node unit/mock tests. Covers material/delivery/fuel calculations, half-load threshold, multiple loads, input validation, duplicate/unknown products, client price tampering, out-of-area/unsupported checkout, missing authorization/configuration, impossible dates, malformed service-zone settings, fake payment return, unsigned webhook and replay-safe paid-state handling.
- Chromium in-memory DOM harness: 12 checks passed at each of 1440, 390 and 320 pixels. Verified 9 product cards, disabled payment control, page/drawer horizontal fit, filtering, adding a cart item, opening/closing with Escape, 22-ton subtotal $958, 11-ton subtotal $544, two 11-ton loads $1,088, removal/empty state and no JavaScript exceptions.
- Original source prices and image references reviewed through connected GitHub; the original asset tree must be preserved.

## Limits, not passes

The agent-browser executable was unavailable. Chromium HTTP navigation was blocked by administrator policy. The DOM harness injected local HTML/CSS/JS into an in-memory page; history writes were stubbed and external images were unavailable. It is not a hosted end-to-end browser test. No claim is made for actual photo rendering, HTTP/API deployment, real browser persistence, Vercel function raw-body behavior or Apple Pay device compatibility.

Stripe SDK installation, real signed Stripe events, real tax calculations, merchant configuration and real sandbox/live card or wallet payments have NOT been tested. No charges were made. Checkout remains disabled without the readiness gates documented in GO-LIVE.md. These local tests do not certify production readiness or PCI compliance.
