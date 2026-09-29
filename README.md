# JDG Aggregates

Public website for JDG Aggregates, a JDG Industries LLC brand serving Miami-Dade and Broward.

## Site and publishing

- `index.html`: page, material prices, estimate calculator, quote links and search metadata.
- `enhancements.css`: responsive design and accessible cart styling.
- `cart.js`: local load cart, editable quantities and combined email/text quote requests.
- `robots.txt` / `sitemap.xml`: public crawler entry points.
- `assets/`: optimized fleet photos and American flag.
- Static HTML. No package installation or build step is required.
- Intended Vercel project: `jdg` in the JDG Industries team.
- Intended production branch: `main`.
- Existing production address: https://jdg-seven.vercel.app

The `main` branch deploys through the existing GitHub/Vercel connection. Production is https://www.jdgindustries.com/. Verify the new commit has a successful Vercel status and that production serves it after each release.

## Content notes

The brand remains JDG Aggregates. The website palette is white, black and navy; full color is reserved for the American flag.

September 2026 customer material prices exclude delivery, fuel, tax, and additional jobsite charges. Confirm prices before changing them. The quote form opens the visitor's email or messaging app; the visitor must send the request there. The cart stores only material IDs and quantities in the visitor’s browser. Each line represents a separate load of up to 22 tons; delivery and fuel are calculated per load. No backend, payment processing, or automatic order booking is included. Visa and Apple Pay checkout require a verified merchant integration and confirmed fulfillment/tax terms. Never add payment claims until the complete checkout has been tested.

Only public website assets belong here. Do not commit credentials, supplier cost sheets, private reports, customer requests, or environment files.

## Image sources

Fleet photographs supplied by JDG. American flag: Wikimedia Commons, public domain, https://commons.wikimedia.org/wiki/File:Flag_of_the_United_States.svg. No alteration to the flag's colors or proportions.
