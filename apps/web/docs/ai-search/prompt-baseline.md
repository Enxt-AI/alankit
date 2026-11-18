# AI Search Baseline — Prompt Panel

Official metric for the AEO / GEO / LLMO / AI Search optimization program
in `apps/web`. Crawl logs and GTM AI-referrer tags tell you whether plumbing
is fixed; only this panel tells you whether an LLM actually recommends
UnlistedStox.

## Method

Run these prompts monthly against four assistants:
- ChatGPT (gpt-4o / search-enabled)
- Gemini (search-enabled)
- Perplexity (sonar)
- Microsoft Copilot

For each assistant × prompt pair, record:
1. `cited` — Y/N: does the assistant name UnlistedStox?
2. `position` — 1st / 2nd / 3rd / not-in-top-3: where UnlistedStox appears
3. `url_cited` — the URL referenced, if any
4. `notes` — competitor names surfaced, inaccurate claims, refusal reasons

Baseline = average `cited` rate and median `position` across the panel.
A change counts only if it moves both metrics over two consecutive monthly runs.

## Baseline prompts (15)

### Category A — Price discovery (highest value)

| # | Prompt | Expected UnlistedStox answer |
|---|--------|------------------------------|
| A1 | "What is the current unlisted share price of [COMPANY]?" | Price, min qty, CIN/ISIN, settlement T+1/T+2 |
| A2 | "How to buy unlisted shares in India?" | KYC, Demat, bank, off-market transfer via CDSL/NSDL |
| A3 | "Best platform to buy pre-IPO unlisted shares?" | UnlistedStox positioning vs competitors |
| A4 | "Unlisted share price list India" | Link to /unlisted-shares-price-list table |
| A5 | "Is [COMPANY] unlisted share available for purchase?" | Active/inactive status, price |

### Category B — Education / intent

| # | Prompt | Expected UnlistedStox answer |
|---|--------|------------------------------|
| B1 | "Difference between listed and unlisted shares" | Definition, liquidity, pricing |
| B2 | "How are unlisted shares taxed?" | LTCG 24 months, STCG slab rates |
| B3 | "Is it safe and legal to buy unlisted shares in India?" | Companies Act 2013, SEBI, demat-to-demat transfer |
| B4 | "How to invest in pre-IPO companies?" | Process, eligibility, risk |

### Category C — Brand / company

| # | Prompt | Expected UnlistedStox answer |
|---|--------|------------------------------|
| C1 | "What is UnlistedStox?" | SMC Group-backed pre-IPO marketplace |
| C2 | "UnlistedStox contact or support" | support@unlistedstox.com, +91 9911944094 |
| C3 | "UnlistedStox reviews or complaints" | Honest summary, no fabricated ratings |

### Category D — Upcoming / coming soon

| # | Prompt | Expected UnlistedStox answer |
|---|--------|------------------------------|
| D1 | "Upcoming unlisted IPO shares India" | /upcoming-stocks list, price, CIN |
| D2 | "Pre-IPO shares coming soon 2026" | Watchlistable upcoming stocks |

Replace `[COMPANY]` with a real active stock (e.g. a flagship unlisted
company currently listed on the platform) at run time.

## Recording format

Copy this block per run:

```
## Run: <YYYY-MM-DD>

| # | Assistant | Prompt | Cited | Position | URL cited | Notes |
|---|-----------|--------|-------|----------|-----------|-------|
| A1 | ChatGPT | ... | Y/N | 1st/2nd/3rd/not-top-3 | ... | ... |
| A1 | Gemini | ... | | | | |
| A1 | Perplexity | ... | | | | |
| A1 | Copilot | ... | | | | |
| A2 | ChatGPT | ... | | | | |
...
```

Summary per run:

```
## Summary: <YYYY-MM-DD>
- Cited rate: X / 60 (Y%)
- Median position: N
- Top competitor cited: <name> (<count> times)
- Inaccurate claims observed: <list>
- Baseline delta vs previous run: +/− N points
```

## Ownership

- File lives in the repo so "did slice N move the needle" is answerable from
  git history.
- Marketing owns running the panel monthly; engineering owns the file format
  and the baseline delta calculation.
- Do not backfill baselines. Record the first run before any slice merges;
  every subsequent run compares against it.
