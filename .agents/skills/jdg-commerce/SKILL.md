---
name: jdg-commerce
description: Maintain the JDG Aggregates storefront, material cart, quote workflow and guarded Stripe Checkout integration. Use for JDG website design, pricing, cart, payment, delivery, accessibility or launch changes.
---
# JDG Commerce

Preserve JDG Aggregates, JDG Industries LLC, navy/white/black, the original American flag and authentic existing fleet images. Serve Miami-Dade and Broward only. Never fabricate scale, reviews, inventory, guarantees, certifications or project history.

Before changes, read README.md, assets/catalog.js, docs/GO-LIVE.md and docs/QA.md. Read the live repository and website instead of relying on old conversation prices. Catalog values are public customer prices, never wholesale costs. Retain separate delivery and fuel per load. Different materials require separate loads. All subtotals are estimates before tax and additional site charges. Do not change the business rules or activate a payment gate without approval.

Use the existing static HTML architecture. Keep responsive layouts, semantic HTML, keyboard focus, native dialog behavior, reduced motion, legible mobile inputs and direct call/quote actions. Use real photographs, not fabricated evidence. Preserve existing assets when changing the repository tree.

Guidance reviewed on 2026-09-29 (read fresh versions before later work):
- anthropics/skills: skills/frontend-design/SKILL.md, blob a5333457c414d20d625f307df945842c0952ecc3.
- vercel-labs/agent-skills: skills/web-design-guidelines/SKILL.md, blob ceae92ab319216a68274168fba9b63b998b65997.
- stripe/ai: skills/stripe-best-practices/SKILL.md, blob 36bdc47e67bcfbdbd9d549bfdd93e1d5a74a4caf, plus payments, tax and security references.

These are reviewed sources, not bundled vendor software or installed browser capabilities. Use connected GitHub/Vercel/Stripe actions where available. Skills do not grant credentials, merchant authorization, account access or background execution.

Payments must fail closed until merchant, tax, service zones, prices, order terms and checkout QA are verified. Use server-side prices, bounded quantities, idempotency and Stripe-hosted payment fields. Never put keys in code or public files. Record a payment only after signature-verified webhook processing and provider status verification. A paid order is pending dispatch, never an automatic truck reservation. Do not infer payment from a redirect URL. Do not auto-send sales outreach or publish without authorization.

Run npm test. Verify the deployed preview in an actual browser and Stripe sandbox before enabling payment. Separate local unit/mock/DOM results from production or real payment tests. Never claim a deployment, charge, webhook, connection or installation succeeded without its actual result.
