---
name: shop-ad-analysis
description: Analyze shop advertising exports using platform, market, category, and SKU costs. Use for ROAS/ACOS/TACOS diagnosis and actionable HTML reports.
---

# Shop ad analysis

Use this skill when a user asks to diagnose store advertising data or turn ad exports into business decisions. First explain what changed, what the data supports, and what to try next in plain language; then offer a standalone HTML report. Do not ask ordinary users to create JSON or run commands. Set `manifest.locale` to `zh-CN` or pass `--locale zh-CN` when Chinese is requested. The skill works with supplied exports and does not require account credentials or live APIs.

## Workflow

1. Read [input contract](references/input-contract.md). Establish platform, site, category, time windows, currency, timezone, attribution definition, and business objective. If any essential field is unknown, ask only for that field or state a limited assumption in the report.
2. Map source columns into the canonical schema. Keep the original exports unchanged. For a new platform, document its attribution and field mappings; do not silently treat similarly named metrics as equivalent.
3. Validate grain, date coverage, duplicates, currency, missing values, and the availability of store sales and SKU cost rates. Stop on values that would corrupt totals. Report other gaps in the HTML.
4. Run `node scripts/analyze.js --manifest manifest.json --ads ads.csv --store store.csv --economics economics.csv --out report.html`. The store and economics options are optional; missing files narrow the conclusions. If the user asks for Chinese, add `--locale zh-CN`. When Node is unavailable, follow the formulas in [analysis rules](references/analysis-rules.md) and generate equivalent HTML in the requested language, labeling any unverified calculation.
5. Interpret the result with [analysis rules](references/analysis-rules.md) and the platform/site/category context in [context guide](references/context-guide.md). Separate observation, possible explanation, and action. Pair key findings with charts computed from the validated input: funnel or conversion movement, ROAS components, SKU contribution, and cost thresholds when supported. Every material recommendation needs a metric, suggested owner, bounded test, review method, and stop or reconsider condition. User-provided targets take precedence over generic thresholds.
6. Check the generated HTML opens directly in a browser, remains legible on a narrow screen, shows the intended platform/site/category and time windows, and includes data quality notes. Keep the report self-contained, with accessible chart labels and no external chart service. Never present ad-attributed sales as proven incremental sales or contribution estimate as audited net profit.

## Data and privacy

Treat exports and business context as private. Do not upload them to a third party or include them in a public repository without the user's authorization. Synthetic examples in this package are safe for demonstration. Public examples and trial suggestions must never use a user's account details, chat history, private files, contacts, or local paths. Check charts and attachments before sharing. Do not add credentials to a manifest, report, or log.

## Runtime variants

The packaged `assets/ad-analysis.html` allows local, browser-side analysis when an AI web app cannot execute the script. It reads user-selected files in the browser and downloads the same HTML report. If a host cannot access local files or run code, request user-provided data and clearly disclose any output limits.
