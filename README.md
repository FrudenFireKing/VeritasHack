# VERITAS — the freshness atelier

**Stale-Answer Detector for AI.** A React/Vite application: it splits a language-model answer
into checkable facts, cross-checks them against sources and produces a 0–100 freshness index
with a verdict for every claim (fresh / stale / contradicted / unconfirmed).


> The application UI is in English — the same as the original site.
> All explanations in this README are in English as well.

---

## 1. Project layout

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

## 2. Quick start (3 commands)

You need **Node.js 18+** (check with `node -v`).

```bash
npm install     # 1. install dependencies (once)
npm run dev     # 2. start the frontend → http://localhost:5173
```

Open `http://localhost:5173` in your browser. The app works right away —
in **demo mode** (synthetic archive, no keys, no web search).
The badge in the lab will honestly show `MODE: DEMO ARCHIVE`.

Stop the dev server with `Ctrl+C`.

### Live mode with real search (Tavily)

```bash
cp .env.example .env        # 1. create a local env file
# 2. open .env and paste your key: TAVILY_API_KEY=tvly-...
npm run server              # 3. start the server → http://localhost:8787
```

Then in a **second terminal**:

```bash
npm run dev                 # frontend on :5173; /api is proxied to :8787
```

The badge switches to `MODE: LIVE WEB`, and reports gain `LIVE EVIDENCE` — sources with real
publication dates. The key is read **by the server only** and never reaches the browser.

Where to get a key: sign up at `tavily.com` → the API Key section → copy it (`tvly-...`).
The free tier is enough for the pilot.

---

## 3. Production build, "as on the domain"

```bash
npm run build     # build the static bundle into dist/
npm start         # start the server on http://localhost:8787: it serves dist/ + /api
```

One process serves both the frontend and the API. This is how the app runs on any
VPS / Vercel / hosting panel that can run Node.

---

## 4. How to change things (file cheat-sheet)

| What you want to change | Where it lives |
|---|---|
| Hero headline, buttons, stats | `src/components/Hero.jsx` |
| Carousel quotes | the `QUOTES` array in `src/components/Quotes.jsx` |
| The "three rituals" copy | the `RITUALS` array in `src/components/Process.jsx` |
| Sample buttons (Social Networks, ...) | `src/lib/samples.js` |
| Demo verdicts, "fresher data", sources | the `RULES` array in `src/lib/demoArchive.js` |
| Index scale (Fit to Bottle, etc.) | `verdictLabel()` in `src/lib/demoEngine.js` and in `server/server.mjs` |
| Theme colors (background, sage, gold...) | `:root` in `src/styles/index.css` + `tailwind.config.js` |
| Title/description for search engines | `<title>` and `<meta>` in `index.html` |
| Dev server port | `vite.config.js` (server.port) |
| API server port | `PORT` in `.env` or in `server/server.mjs` |

The rule is simple: change a file → the dev server reloads the page automatically (hot reload);
for production — run `npm run build` again.

**Add a new topic to the demo archive** (for example, crypto):

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
```

---

## 5. The veritas-hack.space-z.ai domain — how to update it

Key fact: a `*.space-z.ai` domain is bound to **the environment (chat) in which the project
was launched**. There is no separate "one-click" deploy from the ZIP for that domain.
Options, from simplest to fully self-managed:

**Option A — edits through the original chat (no DNS, no servers).**
Open the chat where the site was created and ask for changes: "replace the hero text with
the following..." — or attach the ZIP from this archive and ask to "deploy this code instead
of the current one". The domain rebuilds itself, keeping its address.

**Option B — your own hosting (full control).**
The code is fully self-contained. Two typical paths:

- *Vercel (fastest):* push the repository to GitHub → `vercel.com/new` → Import →
  Framework: Vite → Deploy. You get your own `*.vercel.app` domain, and any purchased
  domain can be attached to it (Settings → Domains). The live-mode API server needs
  separate hosting on Vercel (Railway/Fly.io) — or simply keep demo mode.
- *Your own VPS over SSH:*
  ```bash
  git clone https://github.com/YOUR_LOGIN/veritas-hack.git
  cd veritas-hack && npm ci && npm run build
  cp .env.example .env   # paste the key if you want live mode
  PORT=8787 npm start     # or with pm2: pm2 start "npm start" --name veritas
  ```
  Then nginx proxies 80/443 → 8787, and the domain points at your server.

**Bottom line:** "the domain I launched" is updated either by editing the code in the
original chat (A) or by moving to your own hosting (B). The code in this ZIP fits both paths.

---

## 6. Pushing to GitHub — WITHOUT leaking data

The project is already configured so that secrets cannot leak:

- `.gitignore` excludes: `.env` (keys), `dist/` (build), `node_modules/`, databases
  (`*.db`, `*.sqlite`, `db/`, `dump/`, `backups/`), logs.
- Only `.env.example` enters the repository — a template **without** real values.
- Demo mode contains no secrets by design.

### Step by step

```bash
# 0. Make sure .env exists and holds your key (created locally, never in git)
ls .env             # must exist
cat .gitignore      # the ".env" line must be present

# 1. Initialize the repository
git init
git add .
git status          # ← CHECK: .env, dist/, node_modules/ must NOT be listed
git commit -m "VERITAS: freshness atelier — pilot build"

# 2. Create the repository on GitHub
#    github.com → New repository → name: veritas-hack →
#    Visibility: Public (required by the hackathon rules; keep it Private
#    while developing if you prefer) → do NOT add README/.gitignore on the
#    site (they already exist in the project)

# 3. Link and push
git branch -M main
git remote add origin https://github.com/YOUR_LOGIN/veritas-hack.git
git push -u origin main
```

When pushing over HTTPS, GitHub asks for a username and a **Personal Access Token**
(github.com → Settings → Developer settings → Personal access tokens) instead of a password.

### The "never commit" checklist

| Category | Examples | Where it hides |
|---|---|---|
| Keys and passwords | `TAVILY_API_KEY`, `tvly-...` | `.env` (in `.gitignore`), template in `.env.example` |
| Databases and dumps | `*.db`, `*.sqlite`, CSV/SQL dumps | `.gitignore`: `db/`, `dump/`, `backups/`, `*.db` |
| Personal data | names, phones, e-mails in code/README | do not include; the demo archive has none by default |

Before every `git push` it helps to look at `git status` and `git diff --cached` —
only what you consciously added should enter the commit.

### If a secret did get into git

1. **Revoke the key immediately** (Tavily: profile → reset the API Key) — this is the main thing.
2. Clean the history (simple way — re-create the repository without the secret;
   advanced — `git filter-repo` or BFG Repo-Cleaner) and run `git push --force`.
3. Treat the key as compromised even if the history is "clean" — GitHub caches commits.

### Private while developing, public for the submission

The pilot code, the demo archive and future work are the team's intellectual property —
a private repository is free on GitHub and invisible without an invitation
(Settings → Collaborators). Note: the hackathon rules require the submission repository
to be **public** with a detailed README, so open it before submitting — one click in
Settings → General → Danger Zone → Change visibility.

---

## 7. Environment variables

| Variable | Used in | Required | Meaning |
|---|---|---|---|
| `TAVILY_API_KEY` | `server/server.mjs` | no | enables live Tavily search; without it — demo mode |
| `PORT` | `server/server.mjs` | no | API server port (default `8787`) |

The only file holding real values is `.env` in the project root.
It is in `.gitignore` and is not included in the ZIP.

---

## 8. What was restored and what was reconstructed

The code was rewritten from the live site's behavior, therefore:

- **Matches exactly:** palette and fonts (Cormorant Garamond + Manrope), section structure,
  hero/rituals/archive/footer copy, report badges (STALE, CONFIDENCE, DEMO EVIDENCE),
  the FRESHER DATA block, the EVIDENCE FROM THE WEB list, audit steps, title and meta tags.
- **Reconstructed:** the final verdict scale (Fit to Bottle / Cellar With Care /
  Pour It Out / Unfit to Bottle — only individual values were observed on the live site),
  the carousel quote texts (public quotes), the demo archive contents and the
  claim-extraction logic (without access to the original source code).
- **Live mode:** publication-date heuristics without LLM judgment — an honest pilot;
  strengthen it by adding per-claim LLM evaluation in `server/server.mjs`.

---

*VERITAS est. 2026 · Built overnight at the AI Inator hackathon · Tavily track: Stale-Answer Detector*
