# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Single-file financial control web app for **JM Transportes** (a Brazilian
transport/logistics business), packaged as an installable PWA. The entire
application lives in `index.html.html` (~532 lines — note the double `.html`
extension; that is the actual filename). React, ReactDOM, Recharts,
lucide-react, Tailwind, and Babel-standalone are all loaded from CDNs at
runtime. There is **no build step, no package manager, no tests, no linter**.

UI strings, categories, and comments are in Brazilian Portuguese. Preserve
pt-BR text and BRL currency formatting when editing.

## Running and "building"

- **Open locally:** serve the directory and open `index.html.html`, e.g.
  `python3 -m http.server 8000` then visit
  `http://localhost:8000/index.html.html`. Opening the file via `file://` works
  too but the PWA install banner won't trigger.
- **No build, no install, no tests.** Don't introduce a bundler, `package.json`,
  or framework migration unless explicitly asked — the "single-file, CDN-only,
  Babel-in-browser" property is intentional. JSX is compiled at runtime by
  `babel-standalone`; there is no precompile step.
- **CI:** `.github/workflows/jekyll-docker.yml` runs a Jekyll Docker build on
  push/PR to `main`. There is no actual Jekyll content (`_config.yml`, layouts,
  etc.), so the build is effectively a no-op site build of the static HTML.

## Architecture

All application code is inside a single `<script type="text/babel">` block
starting around line 89. Babel-standalone transpiles JSX in the browser on
load — expect a brief flash before the React tree mounts.

**Top-level layout (`index.html.html`):**
- Lines 1–51: `<head>` — meta tags, inline-data-URL PWA `manifest`, app icon
  SVGs, CDN script tags, base CSS.
- Lines 52–87: install banner DOM + non-React JS that captures
  `beforeinstallprompt` and persists dismissal under `localStorage`
  `jm:install-dismissed`.
- Lines 89–530: the React app inside `<script type="text/babel">`.
- Line 529: `ReactDOM.createRoot(...).render(<App/>)`.

**State pattern:** No Redux/Context. The root `App` component (line ~497)
holds tab state and four data arrays via the `useStored(key, initial)` custom
hook (line ~121), which wraps `useState` with `localStorage` read on init and
`useEffect` write on change. Each top-level section (`Dashboard`,
`Lancamentos`, `Boletos`, `Notas`, `Dividas`) receives `data` and `setData`
props and mutates by replacing the array.

**Shared UI primitives** (defined inline, lines ~127–165): `Card`, `Button`,
`Inp`, `Sel`, `Badge`, `Modal`, `Empty`, `KpiMini`. Reuse these instead of
adding new styled wrappers.

**Charts:** Recharts (`BarChart`, `PieChart`) — destructured from the global
`Recharts` object at the top of the script. lucide-react icons are
destructured from the global `LucideReact`. **Do not `import` from these
modules** — there is no module resolver; they only exist as window globals.

**Styling:** Tailwind utility classes via the JIT CDN script
(`cdn.tailwindcss.com`) plus inline `style={{...}}` for color tokens. The `C`
palette object (line ~103) is the source of truth for brand colors; reuse
`C.navy`, `C.primary`, `C.green`, `C.red`, `C.amber`, `C.purple`, etc. The
`PIE_COLORS` array defines the chart palette.

## Domain model

Four collections, persisted to `localStorage` under these exact keys
(long-form; do not rename without a migration — note these differ from the
short-form keys used in the sibling `FINANJM` repo):

| State / prop  | localStorage key  | Item shape (key fields)                                                                                          |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `lancamentos` | `jm:lancamentos`  | `{id, data, descricao, categoria, tipo: "Receita"\|"Despesa", valor}`                                            |
| `boletos`     | `jm:boletos`      | `{id, fornecedor, valor, vencimento, categoria, status: "A Pagar"\|"Pago"}`                                      |
| `notas`       | `jm:notas`        | `{id, cliente, numNota, valor, vencimento, status: "A Receber"\|"Recebido"}`                                     |
| `dividas`     | `jm:dividas`      | `{id, credor, tipo, valorOriginal, saldo, parcelaTotal, parcelaPaga, valorParcela, proxVenc, status: "Ativo"\|"Quitado"}` |

Conventions:

- `id` = `uid()` (timestamp + random). Never reuse or reorder by id.
- Dates are ISO `YYYY-MM-DD` strings; month grouping uses `iso.slice(0,7)`
  against `todayISO().slice(0,7)`. Don't store `Date` objects.
- Money is `Number`; display goes through `fmtBRL` (full BRL) or `fmtBRLc`
  (compact, e.g. `R$ 12.5k`).
- Category lists `CATS_REC` / `CATS_DESP` (line ~167) are the source of truth
  for the receita/despesa selects.
- Status strings are user-facing pt-BR labels compared directly
  (`status === "Pago"`). Don't translate them or change casing.
- The `dividas` "Marcar parcela paga" handler decrements `saldo` by
  `valorParcela` (clamped at 0) and flips status to `"Quitado"` once
  `parcelaPaga >= parcelaTotal`. Keep this invariant if you touch that flow.

Tabs (`tab` state): `dashboard`, `lancamentos`, `boletos`, `notas`, `dividas`.
Keep these literal strings in sync between the `App` switch and the bottom
nav `tabs` array.

## PWA notes

The manifest, app icons, and `apple-touch-icon` are inlined as `data:` URLs in
`<head>`. There is **no separate `manifest.json` or service worker**, so the
app works offline only via the browser's HTTP cache; don't claim full offline
support without adding a service worker first. The install banner only shows
on browsers that fire `beforeinstallprompt` (Android/desktop Chrome) and
respects the `jm:install-dismissed` flag.

## Filename quirk

The main file is **`index.html.html`**, not `index.html`. Most static-host
defaults serve `index.html`, so deployments may need either an explicit URL
path, a redirect rule, or a rename. If renaming, update any references in
deployment configuration (currently none exist in the repo).
