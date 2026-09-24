# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"Medical Department — Verwaltung" is an internal documentation/management web
app for the medical department (Rettungsdienst) of a private RedM
(Red Dead Redemption 2 roleplay) server. All patients and characters are
fictional. Live at `https://md-endzone.de/`. It is a **static site, no build
step, no package manager, no bundler** — `index.html` is opened directly or
served as-is. All data is real-time via Firebase (Authentication +
Firestore); UI text, variable/function names, and code comments are in
German.

The repo was converted from an earlier ranch-management app; all of its
code, assets and naming have been removed. Do not reintroduce ranch-era
names or the western/parchment styling.

## Commands

There is no build, lint, or test tooling in this repo (no `package.json`).

- **Run locally**: open `index.html` directly in a browser, or serve the
  repo root with any static file server.
- **Deploy**: pushing to `main` auto-publishes to GitHub Pages via
  `.github/workflows/pages.yml` (no build step — the repo root is uploaded
  as-is). Custom domain is set via `CNAME` (`md-endzone.de`).
- **"Tests"**: none exist; verify changes by opening the app in a browser
  and exercising the affected view manually.

## Version bump procedure (must be done together, every release)

The cache-busting/update-banner mechanism depends on these places being
bumped to the same integer in lockstep, or the update banner and/or cache
busting will misbehave:

1. `version.json` → `"version": N`
2. `VERSION_AKTUELL` constant in [config.js](js/core/config.js)
3. Every `?v=N` query string on every `<link rel="stylesheet">` and
   `<script src="...">` tag in [index.html](index.html)
4. The same `?v=N` tags (favicon, stylesheets, scripts) in
   [akte.html](akte.html) — the public share page has its own copy.

`js/ui/version-check.js` polls `version.json` every 5 minutes (started in
`starteApp`) and shows the `#update-banner` when it finds a newer version
than `VERSION_AKTUELL`.

## Architecture

### Script loading: two separate systems sharing one page

All app logic (other than auth) lives in **non-module, `defer`red classic
scripts** that share one global scope (no `import`/`export`, no bundler).
They append variables/functions directly into global scope, so **the
`<script>` order at the bottom of `index.html` is significant and must not
be reordered**: `firebase-config.js` → `js/core/*` → `js/ui/*` →
`js/views/*` → `js/ui/version-check.js` → `js/main.js` last (it starts the
app). Numbered comment banners inside each file (e.g. `/* 18. Patientenakten */`)
are left over from when all this code lived in one single `js/app.js`; the
numbering is still meaningful for finding related sections across files.

`js/auth.js` is intentionally a separate, self-contained **ES module**
(`type="module"` in `index.html`, loaded last). It uses the modern Firebase
**Modular SDK** (`getAuth`, `doc(db, ...)`, etc.), while every other file
uses the older **Compat SDK** (`firebase.auth()`, `db.collection(...).doc(...)`)
via `js/firebase-config.js`. Both SDKs talk to the same Firebase project
without conflict. Because ES modules can't implicitly touch `window`,
`auth.js` explicitly bridges to the rest of the app via:

- Custom `window` events: `md:auth-approved`, `md:auth-profile-updated`,
  `md:auth-signed-out` (consumed in [main.js](js/main.js) to start/stop the
  app and re-render on role/admin changes).
- `window.BenutzerVerwaltung` — the entire admin/user-management API
  (approve/reject/lock/unlock/set rank/set admin/rename/delete/create user,
  password reset, activity log) exposed for [views/admin.js](js/views/admin.js) to call.

`main.js` `starteApp` starts one Firestore listener per data set
(`startePatientenListener`, `starteAktenListener`, `starteLeitfaedenListener`,
`starteTermineListener`, `starteMitarbeiterListener`, `starteDienstListener`, plus `starteBenutzerverwaltung` for admins) and
`stoppeApp` unsubscribes them and **resets the matching state variables** —
when adding a new listener or view state, add it to both.

### Directory roles

- `js/core/` — shared foundation loaded first: `config.js` (constants,
  ranks, collection names, default data, `VIEW_META`), `state.js` (all
  mutable app state + Firestore listener unsubscribe handles, e.g.
  `patienten`, `akten`, `termine`, `aktuellerNutzer`), `dom.js` (single `el`
  object caching every DOM reference by id, plus the custom `<select>`
  reskinning widget), `utils.js` (formatting/escaping helpers, `istAdmin()`),
  `akte-dokument.js` + `akte-pdf.js` (rendering and jsPDF export of a
  treatment file — see "Akten & Zugriffslinks").
- `js/ui/` — cross-cutting UI behavior not tied to one data view:
  `nav.js` (sidebar view switching, tabs), `modals.js`, `presence.js`
  ("who's online" heartbeat), `version-check.js`.
- `js/views/*.js` — one file per sidebar view: `startseite` (= the Leitstelle),
  `patientenakten` (by far the largest), `akte-link`, `termine`,
  `mitarbeiterliste`, `beispiele`, `einstellungen`, `admin`. Each owns its own Firestore
  `onSnapshot` listener, render function, and form/modal handlers.
- `js/akte-ansicht.js` — entry script for the public `akte.html` only; it is
  **not** loaded by `index.html`.
- `js/main.js` — wires `md:auth-*` events to app start/stop; must load last.
- `index.html` — contains markup for **every** view and **every** modal in
  one document (views are `<section class="view">`, toggled via
  `view--active`; modals are `.modal-overlay`, toggled via
  `data-open-modal`/`data-close-modal` attributes handled in `js/ui/modals.js`).
  Views: `startseite` (labelled "Leitstelle" in the UI), `patientenakten`, `patient-detail` (no sidebar
  button — opened via `oeffnePatientSeite`), `termine`, `mitarbeiterliste`, `beispiele`,
  `einstellungen`, `admin`, `admin-log`. All are declared in `VIEW_META`.
- `css/` — `base/` (tokens, reset, background, responsive) → `layout/` → `components/` → `views/`; the load order in
  `index.html` is the cascade order and matters (it is not strictly
  alphabetical — follow the existing `<link>` order when adding a file).
  Colour tokens live in `css/base/tokens.css` (`--slate-*` dark surfaces,
  `--panel-*` card layers, `--text-*`, `--accent-*` red, `--status-*`).
- `akte.html` — public, login-free read-only page for shared treatment files.
- `assets/logo/favicon.svg` — the only image asset (browser tab icon). The design is
  pure CSS surfaces/gradients (Inter font), no textures or photos.

### Domain model

- **Ranks** (`BENUTZER_RAENGE` in `config.js`, ascending): Azubi,
  Sanitätshelfer, Rettungssanitäter, Notfallsanitäter, Organisatorischer
  Leiter Rettungsdienst, Medizinstudent, Notarzt, Leitender Notarzt,
  Ärztlicher Leiter Rettungsdienst. New accounts start as `Azubi`. Old rank
  names are mapped for display only via `RANG_ALIAS`/`normalisiereRang`
  (the DB keeps the old value until an admin reassigns). Each rank has a
  colour in `RANG_AKZENTE`; the top three also get an avatar ring
  (`RANG_AKZENTRING`). **Rank is organisational only** — admin rights are a
  separate per-user `isAdmin` flag.
- **`patienten`** — patient profile (name + Stammdaten: Geburtsdatum,
  Allergien, Vorerkrankungen, …). Any approved user may create/read/edit;
  only admins may delete.
- **`akten`** — one treatment file per doc, linked to its patient via
  `patientId`. Any approved user may create/read/edit/delete.
- **`termine`** — appointments (MRT, CT / CCT, Psychologisches Gespräch,
  Sonstiges with free-text label — `TERMIN_ARTEN`), linked to a patient via
  `patientId` or to a free-typed name.
- **`dienst`** — Leitstelle duty status (the start page): one doc per person,
  doc id = the stable `id` of that row in the Mitarbeiterliste, `{ status:
  "im-dienst" | "ausser-dienst", aktualisiertAm, von }`. The Leitstelle lists
  *every* Mitarbeiterliste row that has a name, each with a dropdown; no doc means
  Außer Dienst (the default). Any approved user may set any status. Rows saved
  before ids existed get them via `migriereMaIds` (runs for admins); until then
  their dropdown is disabled. `MD_FUNK` (config.js) is the fixed main radio
  channel shown at the top.
- **`kataloge/mitarbeiterliste`** — the staff list: one doc with a `zeilen` array
  of free-text rows `{ id, name, rang, funk, telefon, bereiche }` (`id` = stable
  random key, used by the Leitstelle) plus
  `bearbeitetVon`/`bearbeitetAm`. No groups, all fields free text (the `rang`
  is not tied to `BENUTZER_RAENGE`, but known ranks get their colour). The view
  shows only filled rows; edit mode pads to `MITARBEITER_MIN_ZEILEN` (10) rows; admins edit inline
  ("Bearbeiten" → Speichern/Abbrechen/+ Zeile). It has its own header with the
  red/white ECG logo, so `nav.js` hides the generic `#page-header` for it.
  Covered by the existing `kataloge` rule (read: approved, write: admin), so no
  rules change was needed.
- **`kataloge/leitfaeden`** — a single doc holding the admin-managed
  "Beispiele" (Behandlungsleitfäden): array fields `kategorien` and
  `eintraege`. Default categories are auto-created on first start
  (`DEFAULT_LEITFADEN_KATEGORIEN`, fixed IDs). Readable by approved users,
  writable by admins only.

### Akten & Zugriffslinks

- `akteDaten(a)` in `patientenakten.js` flattens an Akte + patient into the
  plain display object that both the in-app dialog and the public page render
  through `akte-dokument.js`. Keep that field list in sync between
  `akteDaten`, `akte-dokument.js` and `akte-pdf.js`.
- A **Zugriffslink** (`akte-link.js`) writes a read-only **copy** of an Akte
  to `freigaben/{token}` (token = 48 hex chars from `crypto.getRandomValues`,
  ≥ 32 required by the rules), valid `ZUGRIFFSLINK_TAGE` (7) days. The token
  lives in the URL fragment (`akte.html#token`) so it is never sent to a
  server. The copy is deliberately **not** kept in sync with the Akte; users
  refresh it explicitly ("Kopie aktualisieren"). Deleting an Akte/Patient must
  also delete its links (`loescheFreigabenFuerAkte`).
- `freigaben` rules: `get` is public but only while `laeuftAb > request.time`;
  `list`/write need an approved user.
- `patientenakten.js` has optimistic-concurrency style **conflict detection**
  for two people editing the same Patient/Akte (`profilBasisStempel`,
  `akteBasisStempel`, compared against `bearbeitetAm`) and an editing
  presence indicator (`aktualisiereAnwesenheit`). Preserve `bearbeitetAm`/
  `bearbeitetVon` on every write to those docs.

### Firestore

Collections: `users`, `usernames` (reserved-name lookup), `adminLog`
(append-only), `presence`, `patienten`, `akten`, `termine`, `dienst`, `freigaben`,
`kataloge`.

`firestore.rules` in this repo is an **archive/reference copy only** —
Firebase does **not** read it automatically. The actual live rules are
maintained by hand in the Firebase Console (Firestore Database → Regeln)
and must be manually copy-pasted there after editing this file — remind the
user whenever you change it. Admin rights (`isAdmin`) and rank are
independent axes; `geschuetzt: true` marks an account whose admin
rights/approved status can never be revoked (see
`istUnantastbar()`/`verletztUnantastbarkeit()` in `firestore.rules`). A user
doc's `status` is `pending` / `approved` / `locked` (timed locks expire via
`gesperrtBis`, self-healing in the rules).

Ranch-era collections (`produkte`, `bestellungen`, `kontakte`, `hofbuch`, …)
no longer have rules and are unreachable; leftover data is simply unused.

### Other conventions

- Start page choice is stored per browser in `localStorage`
  (`einstellungen.js`, `ladeStartseite()`); everything else is in Firestore.
- Compat SDK is configured with `ignoreUndefinedProperties: true`
  (`firebase-config.js`), so `undefined` fields are silently dropped on write.
- `firebase-config.js` guards `firebase.auth` with `typeof … === "function"`
  because some pages (`akte.html`) load only the Firestore SDK.

### Custom `<select>` widget

Every `<select class="field-input">` on the page is auto-upgraded at load
time (see `erzeugeCustomSelect` in [dom.js](js/core/dom.js)) into a themed
dropdown (`.custom-select`) so no native browser dropdown ever appears. The
original `<select>` stays in the DOM as the actual source of truth (value,
options, `change` listeners) but is visually hidden — code that populates
options via `innerHTML` on the underlying `<select>` continues to work
unchanged; a `MutationObserver` keeps the visible list in sync.
