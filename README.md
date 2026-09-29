# JDG Aggregates storefront

Staged website redesign and material cart for JDG Industries LLC, serving Miami-Dade and Broward. Navy, white and black, genuine existing fleet images and the original American flag. Public retail prices preserved from the reviewed September 2026 site.

## Features

Responsive static storefront, filterable nine-material catalog, editable tons/load and load count, browser-local material cart, itemized material/delivery/fuel estimates, project quote form and email/text order-request handoff. Quote buttons prepare a message in the visitor's app; the visitor must send it. No submission or booking is implied.

Server-side Stripe Checkout implementation and a signature-verified webhook handler are included but **disabled by default**. Online payments require merchant authorization, approved pricing/service-zone/tax/order rules, real sandbox verification and deployment access. Paid orders remain pending dispatch. There is no automatic reservation, inventory system, QuickBooks sync, independent CRM/order database or automated operational messaging in this version.

## Files

- index.html, assets/store.css, assets/store.js: storefront and cart.
- assets/catalog.js: public retail catalog and shared integer-cent estimator.
- api/checkout.js, api/webhook.js, lib/payment.js: guarded payment integration.
- tests/store.test.js: local tests; run `npm test` with Node 22.
- .agents/skills/jdg-commerce/SKILL.md: JDG-specific website maintenance guidance.
- docs/GO-LIVE.md: remaining access, configuration, commercial and real-payment checks.
- docs/QA.md: completed tests and explicit limitations.

## Publishing

Intended existing Vercel project: `jdg`; existing deployment address: `jdg-seven.vercel.app`; public site: https://www.jdgindustries.com. Confirm the actual hosting project/domain mapping before publishing. GitHub commits alone do not establish a production deployment. Keep `main` and the live site unchanged until preview review and access are complete.

Use the existing assets directory when applying the source overlay. Fleet photos were provided by JDG; the American flag source is public-domain Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Flag_of_the_United_States.svg. Do not replace photographs with invented evidence or change the flag's colors/proportions.

No credentials, customer records, supplier costs or private documents belong in this public repository.
