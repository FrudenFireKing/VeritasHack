VERITAS — the freshness atelier
Stale-Answer Detector for AI. A React/Vite application: it splits a language-model answer
into checkable facts, cross-checks them against sources and produces a 0–100 freshness index
with a verdict for every claim (fresh / stale / contradicted / unconfirmed).
The code was recreated from the live deployment at `https://veritas-hack.space-z.ai`
(AI Inator hackathon, Tavily track "Stale-Answer Detector", November 2026).
> The application UI is in English — the same as the original site.
> All explanations in this README are in English as well.
---
1. Project layout
```
veritas-hack/
├── index.html                  — HTML shell, fonts, meta tags
├── package.json                — dependencies and scripts (npm run ...)
├── vite.config.js              — Vite config (port 5173, /api proxy → :8787)
├── tailwind.config.js          — theme: atelier palette, fonts, animations
├── postcss.config.js
├── .env.example                — environment template (NO secrets inside)
├── .gitignore                  — what never enters git (secrets, build, databases)
├── src/
│   ├── main.jsx                — React entry point
│   ├── App.jsx                 — assembles the page from sections
│   ├── styles/index.css        — theme CSS variables, .eyebrow / .ornament classes
│   ├── components/
│   │   ├── Header.jsx          — header with navigation
│   │   ├── Hero.jsx            — "Truth has a shelf life", buttons, stats
│   │   ├── Seal.jsx            — rotating wax seal with a "V"
│   │   ├── Quotes.jsx          — "From the inspiration archive" quote carousel
│   │   ├── Lab.jsx             — the lab: tabs, input field, SAMPLES, audit steps
│   │   ├── Report.jsx          — report: index gauge, verdict, claim cards
│   │   ├── Process.jsx         — "Three rituals of the atelier"
│   │   ├── Archive.jsx         — "Recent batches" (persisted in localStorage)
│   │   └── Footer.jsx
│   └── lib/
│       ├── extract.js          — claim extraction (shared with the server)
│       ├── demoArchive.js      — synthetic archive for demo mode
│       ├── demoEngine.js       — demo audit, index, batch archive (localStorage)
│       ├── api.js              — /api/audit call + honest fallback to demo mode
│       └── samples.js          — sample texts for the lab
└── server/
    └── server.mjs              — Express: serves dist/ + live Tavily search
```
---
2. Quick start (3 commands)
You need Node.js 18+ (check with `node -v`).
```bash
npm install     # 1. install dependencies (once)
npm run dev     # 2. start the frontend → http://localhost:5173
```
Open `http://localhost:5173` in your browser. The app works right away —
in demo mode (synthetic archive, no keys, no web search).
The badge in the lab will honestly show `MODE: DEMO ARCHIVE`.
Stop the dev server with `Ctrl+C`.
Live mode with real search (Tavily)
```bash
cp .env.example .env        # 1. create a local env file
# 2. open .env and paste your key: TAVILY_API_KEY=tvly-...
npm run server              # 3. start the server → http://localhost:8787
```
Then in a second terminal:
```bash
npm run dev                 # frontend on :5173; /api is proxied to :8787
```
The badge switches to `MODE: LIVE WEB`, and reports gain `LIVE EVIDENCE` — sources with real
publication dates. The key is read by the server only and never reaches the browser.
Where to get a key: sign up at `tavily.com` → the API Key section → copy it (`tvly-...`).
The free tier is enough for the pilot.
Optional: LLM assessment of every claim
With a Tavily key alone, verdicts come from the publication-date heuristic. Add any
OpenAI-compatible LLM (OpenAI, Groq, OpenRouter, Gemini) and every claim is additionally
judged by the model against the found evidence snippets — the report gets an
`AI ASSESSED` badge:
```bash
# add to .env (example with the free Groq tier)
LLM_API_KEY=gsk-...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```
The LLM receives the claim plus the Tavily results (titles, publication years, snippets)
and returns a strict JSON verdict (`FRESH / STALE / CONTRADICTED / UNCONFIRMED`, confidence,
one-sentence rationale and, when possible, fresher corrected data). If the LLM is unreachable
or replies with garbage, the audit automatically falls back to the date heuristic —
a broken LLM key never breaks a report.
---
3. Production build, "as on the domain"
```bash
npm run build     # build the static bundle into dist/
npm start         # start the server on http://localhost:8787: it serves dist/ + /api
```
One process serves both the frontend and the API. This is how the app runs on any
VPS / Vercel / hosting panel that can run Node.
---
4. How to change things (file cheat-sheet)
What you want to change	Where it lives
Hero headline, buttons, stats	`src/components/Hero.jsx`
Carousel quotes	the `QUOTES` array in `src/components/Quotes.jsx`
The "three rituals" copy	the `RITUALS` array in `src/components/Process.jsx`
Sample buttons (Social Networks, ...)	`src/lib/samples.js`
Demo verdicts, "fresher data", sources	the `RULES` array in `src/lib/demoArchive.js`
Index scale (Fit to Bottle, etc.)	`verdictLabel()` in `src/lib/demoEngine.js` and in `server/server.mjs`
Theme colors (background, sage, gold...)	`:root` in `src/styles/index.css` + `tailwind.config.js`
Title/description for search engines	`<title>` and `<meta>` in `index.html`
Dev server port	`vite.config.js` (server.port)
API server port	`PORT` in `.env` or in `server/server.mjs`
The rule is simple: change a file → the dev server reloads the page automatically (hot reload);
for production — run `npm run build` again.
Add a new topic to the demo archive (for example, crypto):
```js
// src/lib/demoArchive.js → add to the RULES array:
{
  match: /\b(bitcoin|btc)\b/i,            // words to catch in the claim
  test: /\b100\s*thousand\b/i,            // (optional) extra match refinement
  verdict: 'STALE',                        // FRESH | STALE | CONTRADICTED | UNCONFIRMED
  confidence: 80,
  explanation: 'The $100k figure comes from older briefings.',
  fresher: 'As of 2025, the price exceeds $100k.',
  evidence: [ { title: 'BTC Price Report', year: '2025' } ],
}
---
---
7. Environment variables
Variable	Used in	Required	Meaning
`TAVILY_API_KEY`	`server/server.mjs`	no	enables live Tavily search; without it — demo mode
`LLM_API_KEY`	`server/server.mjs`	no	enables LLM assessment of every claim (any OpenAI-compatible API)
`LLM_BASE_URL`	`server/server.mjs`	no	LLM endpoint, default `https://api.openai.com/v1`
`LLM_MODEL`	`server/server.mjs`	no	model name, default `gpt-4o-mini`
`PORT`	`server/server.mjs`	no	API server port (default `8787`)
The only file holding real values is `.env` in the project root.
It is in `.gitignore` and is not included in the ZIP.
---
8. What was restored and what was reconstructed
The code was rewritten from the live site's behavior, therefore:
Matches exactly: palette and fonts (Cormorant Garamond + Manrope), section structure,
hero/rituals/archive/footer copy, report badges (STALE, CONFIDENCE, DEMO EVIDENCE),
the FRESHER DATA block, the EVIDENCE FROM THE WEB list, audit steps, title and meta tags.
Reconstructed: the final verdict scale (Fit to Bottle / Cellar With Care /
Pour It Out / Unfit to Bottle — only individual values were observed on the live site),
the carousel quote texts (public quotes), the demo archive contents and the
claim-extraction logic (without access to the original source code).
Live mode: Tavily search plus per-claim assessment — an LLM verdict when `LLM_API_KEY`
is set (with automatic fallback), otherwise the publication-date heuristic;
both are implemented in `server/server.mjs`.
---
VERITAS est. 2026 · Built overnight at the AI Inator hackathon · Tavily track: Stale-Answer Detector