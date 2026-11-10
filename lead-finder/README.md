# JDG Lead Finder

Internal lead generation and pipeline tool for JDG Aggregates. It collects businesses and active
projects that are likely to need aggregate or concrete in Miami-Dade and Broward, ranks them with an
explainable 0–100 score, and gives staff a pipeline, follow-up tasks and ready-to-edit outreach drafts.

This folder is a separate app from the public website in the repository root. It is listed in the
root `.vercelignore` so the public site does not publish it.

## What is in it

| Area | What it does |
| --- | --- |
| Today | New hot leads, your tasks due, leads with no contact in 14 days |
| Leads | Ranked, filterable list; saved filters; bulk assign / stage / tag; CSV export |
| Lead page | Contacts, projects with rough material estimates, map, score breakdown, activity, tasks, outreach drafts |
| Pipeline | Drag-and-drop board: New → Researched → Contacted → Conversation → Quote Sent → Won / Lost |
| Import | CSV or Excel upload with column matching and preview |
| Duplicates | Review screen for look-alike companies the system was not sure enough to merge |
| Reports | Conversion by stage, leads and wins by source, win rate by trade and county, activity per user |
| Admin | Sources, scoring weights, templates, material assumptions, settings, users, logs |

## Run it on your computer

You need Node.js 20 or newer and a PostgreSQL database.

```bash
cd lead-finder
npm install
cp .env.example .env        # then fill in DATABASE_URL, AUTH_SECRET, CRON_SECRET, SEED_ADMIN_PASSWORD
npm run db:migrate          # creates the tables
npm run db:seed             # settings, templates, an admin login, and fictional sample leads
npm run dev                 # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` (default `admin@example.com`) and the `SEED_ADMIN_PASSWORD` you set.
If you leave the password blank, the seed prints a random one once.

The sample companies, people, phone numbers and emails are all made up. Delete them (or start from
an empty database and skip nothing — the seed only adds samples when there are no leads) before real use.

Other commands: `npm test` (unit tests), `npm run lint` (type check), `npm run build`.

## Put it online (Vercel)

1. Create a PostgreSQL database (Neon, Supabase or Vercel Postgres) and copy its connection string.
2. In Vercel, create a **new project** from this repository and set **Root Directory** to `lead-finder`.
3. Add environment variables: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET` (and the optional ones below).
4. Deploy. The `vercel-build` script applies database migrations and builds the app.
5. Run the seed once from your computer against the production database:
   `DATABASE_URL="…" SEED_ADMIN_EMAIL="you@…" SEED_ADMIN_PASSWORD="…" npm run db:seed`
6. Sign in, then set your business address and yard location under **Admin → Settings**.

`vercel.json` schedules the source run daily at 10:00 UTC. Vercel sends `CRON_SECRET` automatically.

Not yet verified: this has been built and tested locally, not deployed to Vercel. In particular, the
root `.vercelignore` entry for `lead-finder` is there to keep this code off the public site; if the
new project's deployment comes up empty, that entry is the first thing to check, and the simplest
fix is to move this folder into its own repository.

## Settings you must fill in

| Where | What | Why |
| --- | --- | --- |
| Admin → Settings | Business postal address | Added to every email draft (CAN-SPAM) |
| Admin → Settings | Yard latitude / longitude | Distance scoring. The seed puts in a placeholder near Medley |
| Admin → Material estimates | Depth and tons-per-$10k numbers | The defaults are starting guesses, not measured figures |
| Admin → Templates | Wording and materials | The seeded templates name materials you may not carry |
| `src/lib/constants.ts` | Trade and project-type lists | Edit if your customer types differ |

### Lead sources (each needs a one-time look-up)

No external endpoint is pre-filled. Dataset addresses and column names change, so each must be found
and confirmed by a person, then entered at **Admin → Sources** (or in `src/lib/sources/config.ts`).
Until then the source is skipped and the app works on imports and manual entry.

- [ ] **Building permits** — JSON endpoint and column names from the county / city open-data portals
- [ ] **Contractor licenses** — state licensee data; if only downloadable files exist, use Import
- [ ] **Public bids** — a JSON feed from the procurement portals you are registered with
- [ ] **New business registrations** — state corporation data; if only files exist, use Import
- [ ] **Google Places** — set `GOOGLE_PLACES_API_KEY`, review Google's terms on storing Places data, edit the searches

Only official APIs, open-data portals and files you upload are supported. There are no scrapers.

### Optional environment variables

- `GOOGLE_PLACES_API_KEY` — turns on the business directory source (paid Google API).
- `OPENAI_API_KEY`, `OPENAI_MODEL` — adds a "Personalize draft" button. It sends the draft text and the
  lead's company name, trade and project descriptions to OpenAI. The app works fully without it.

## Compliance rules built in

- **Business contacts only.** Records that look like private homeowners (owner-builder permits,
  personal names) are flagged, hidden from lists by default, and blocked from drafts and exports.
- **Do-not-contact.** Marking a lead, or logging the outcome "Opted out", blocks drafts and exports
  and records the email and phone on a permanent opt-out list, so a later import of the same contact
  is blocked too. Only an admin can undo a mistaken flag, and that is written to the audit log.
- **Email.** Every email draft gets the business address and an opt-out line appended.
- **Text.** Text drafts show a consent reminder (TCPA and Florida telemarketing law) and get STOP wording.
- **No bulk sending.** Nothing is sent from this tool. Staff open one draft at a time in their own
  email or messaging app.
- **Provenance.** Every lead and project stores its source and the date it was retrieved.

This is tooling, not legal advice. Have the outreach rules reviewed by someone qualified before relying on them.

## How it is built

Next.js (App Router) and TypeScript, PostgreSQL with Prisma, Tailwind CSS, Auth.js credentials login
with `ADMIN` and `SALES` roles, Zod validation, Vitest.

```
prisma/schema.prisma        data model            prisma/seed.ts   settings + sample data
src/lib/                    pure logic (normalize, dedupe, scoring, materials, csv-mapping, dnc, templates)
src/lib/ingest.ts           the one write path every source goes through
src/lib/sources/            LeadSourceAdapter interface, JSON open-data adapter, Google Places adapter, config
src/app/actions/            server actions (each one checks the signed-in user first)
src/app/(app)/              pages                 src/app/api/     auth, daily cron, CSV export
src/components/             client components     tests/           unit tests
```

Security: every page, action and API route re-checks the user on the server; passwords are hashed
with bcrypt; sign-in is rate limited per email and per IP; the cron endpoint needs `CRON_SECRET`;
source URLs must be public HTTPS addresses; CSV exports neutralise spreadsheet formulas.

### Design notes

- **Saving reloads the page.** After a successful save the page does a normal reload and shows the
  confirmation as a notice, and links to a lead are plain page loads. During testing, Next.js in-place
  refreshes and transitions involving the lead page did not complete reliably in production builds
  (the cause was not fully isolated), so the dependable path was chosen. A lead page loads in roughly
  a tenth of a second locally.
- **Lead page title** is set from the browser (`DocumentTitle`) rather than `generateMetadata`, for the same reason.
- **Map tiles** come from OpenStreetMap's public tile server, which is fine for light internal use.
  Coordinates are entered by hand or supplied by a source; there is no geocoding.

## Tested

- `npm test`: 45 unit tests covering name/phone normalization, duplicate matching, scoring, material
  estimates, CSV column mapping, do-not-contact enforcement and template rendering.
- A browser run against a production build covering sign-in, every page, filters, bulk actions, quick
  add, merge-on-add, projects and estimates, drafts, opt-out blocking, export, pipeline moves, file
  import, duplicate merge, admin forms, role restrictions and phone layout.
- Not tested: live external sources (none are configured), the Google Places and OpenAI calls (no
  keys), Excel upload in a browser (CSV was), and a Vercel deployment.

## Known issues

- `npm audit` reports advisories in build-time tooling (Prisma 6's CLI config loader, PostCSS). They
  are not in the code that serves requests. Clearing them means moving to Prisma 7, which changes how
  the client is set up.
- The Pipeline board shows the top 30 leads per stage; use the Leads list for the rest.
- Menu badges (tasks due, duplicates) update on the next page load.
