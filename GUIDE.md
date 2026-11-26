# Usage guide

[中文使用指南](docs/GUIDE.zh-CN.md)

## 1. Review the sample

Open the [English HTML report](examples/demo/report.html) and read the [case study](examples/demo/CASE.md). A [Chinese report](examples/demo/report.zh-CN.html) and [Chinese case study](examples/demo/CASE.zh-CN.md) are also included. All figures are synthetic.

## 2. Prepare input files

Required: `manifest.json` and `ads.csv`. Recommended: `store.csv` and `economics.csv`. The full field contract is in `skills/shop-ad-analysis/references/input-contract.md`.

Minimal manifest:

```json
{
  "locale": "en",
  "platform": "Your platform",
  "site": "US",
  "category": "Your category",
  "currency": "USD",
  "timezone": "America/Los_Angeles",
  "objective": "Increase attributed contribution",
  "attribution": {"label": "Enter the actual attribution event and window"},
  "periods": {"current": {"start": "2026-11-12", "end": "2026-11-18"}}
}
```

`ads.csv` requires `date,campaign,sku,impressions,clicks,spend,attributed_orders,attributed_sales`. Use the manifest currency and a period for every row. Do not mix grand totals and detail rows.

Map different export headers without modifying the original file:

```json
"column_map": {
  "ads": {
    "attributed_sales": "7 Day Sales",
    "attributed_orders": "7 Day Orders"
  }
}
```

Only map fields with the same platform, site, currency, date scope, and attribution definition. Run incompatible platforms separately.

## 3. Choose a language

English is used when `locale` is omitted or set to `en`. Use `"locale": "zh-CN"`, the CLI flag `--locale zh-CN`, or the browser language selector for Simplified Chinese. The optional `platform_zh`, `objective_zh`, `attribution.label_zh`, and `business_context.notes_zh` fields provide Chinese wording for user-supplied context. Otherwise that context stays in its original language.

## 4. Use the browser tool

Open `web/ad-analysis.html` directly, or use the [online version](https://h8ab.github.io/shop-ad-analysis/web/ad-analysis.html). Choose files, generate a preview, and download a standalone HTML report. File processing occurs in the browser; no account or server is needed for local use.

## 5. Use an agent

- **Codex:** Install `skills/shop-ad-analysis/` in a skill directory recognized by your Codex version, or unpack `dist/shop-ad-analysis-agent.zip`. Attach your input files and request an HTML ad analysis.
- **WorkBuddy:** Import `dist/shop-ad-analysis-workbuddy.zip` using Skills → Add skill → Upload skill. The package includes WorkBuddy display metadata.
- **Claude web:** Upload `dist/shop-ad-analysis-agent.zip` under Customize → Skills, enable it, then attach the input files and request an HTML report.
- **Other AI web apps:** Import the standard package if Agent Skills are supported. Otherwise use the browser tool to generate the report and share the output with the AI app for discussion. Script execution varies by host.

## 6. Use the CLI

```bash
node skills/shop-ad-analysis/scripts/analyze.js \
  --manifest examples/demo/manifest.json \
  --ads examples/demo/ads.csv \
  --store examples/demo/store.csv \
  --economics examples/demo/economics.csv \
  --out examples/demo/report.html \
  --json examples/demo/result.json
```

Add `--locale zh-CN --out report.zh-CN.html` for Chinese output. Missing `store.csv` suppresses TACOS; incomplete SKU cost rates suppress overall estimated attributed contribution. Invalid values or duplicate rows stop the run rather than inflate totals.

## 7. Interpret decisions

Read Data quality and scope before the executive summary and action list. Recommendations are hypotheses to test, not causal claims. Review attribution lag, price changes, promotions, stock, and unit-cost definitions before large bid or budget changes.
