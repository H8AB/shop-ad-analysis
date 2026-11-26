# Shop Ad Analysis

An open-source [Agent Skill](https://agentskills.io/specification) that turns ecommerce ad exports, store sales, and SKU unit economics into an evidence-based HTML decision report. The default interface and report language is **English**; Simplified Chinese is optional. [中文说明](docs/README.zh-CN.md)

## Try it

1. Open the [online demo](https://h8ab.github.io/shop-ad-analysis/) or the [sample HTML report](https://h8ab.github.io/shop-ad-analysis/examples/demo/report.html).
2. To analyze files locally, open [the offline browser tool](web/ad-analysis.html). Choose English or 简体中文, run the built-in sample, or select your own `manifest.json` and `ads.csv`. Add `store.csv` and `economics.csv` for broader conclusions.
3. For Codex or Claude, install the [Agent Skills package](dist/shop-ad-analysis-agent.zip). For WorkBuddy, use the [WorkBuddy package](dist/shop-ad-analysis-workbuddy.zip). See the [usage guide](GUIDE.md).

## What the report answers

- How did spend, ROAS, ACOS, TACOS, and estimated attributed contribution change?
- Was the ROAS change associated with CPC, click conversion rate, or attributed order value?
- Which SKUs, campaigns, or keywords deserve review first, and how should each action be tested?
- Which conclusions are limited by missing or inconsistent data?

The report uses only supplied files. It does not call a marketplace API or invent category benchmarks. Estimated attributed contribution is neither audited net profit nor proof of incremental ad impact.

## Language

English is the default. Set `"locale": "zh-CN"` in `manifest.json`, pass `--locale zh-CN` to the CLI, or select **简体中文** in the browser tool. The sample includes both an [English report](examples/demo/report.html) and a [Chinese report](examples/demo/report.zh-CN.html). User-supplied business notes are not machine translated; optional `*_zh` manifest fields can provide Chinese wording.

## Repository contents

```text
skills/shop-ad-analysis/       Installable skill, analysis engine, rules, and browser asset
web/ad-analysis.html           Standalone offline browser tool
examples/demo/                Synthetic inputs, results, reports, and case study
docs/                         Optional Chinese documentation
tools/                        Reproducible sample, web, and package builders
tests/                        Calculation and data-quality checks
dist/                         Agent Skills and WorkBuddy ZIP packages
GUIDE.md                      Usage and field-mapping guide
```

## Build and verify

Node.js 18+ is required for the CLI and build scripts. No third-party runtime packages are used.

```bash
npm test
npm run demo
npm run build
```

`npm run demo` regenerates both report languages; `npm run build` regenerates the standalone browser tool and installation ZIPs. See the [release guide](PUBLISHING.md) for GitHub publishing details.

## Privacy and scope

The sample data is synthetic. Never commit real ad exports, private cost data, credentials, or business targets to a public repository. The browser tool processes selected files locally and has no upload endpoint. An AI host's handling of attached files is governed by that host's settings and terms.

Version 1.2 adds a decision brief, advertising funnel, ROAS driver chart, SKU contribution and break-even proxy cards, and suggested review gates. It accepts normalized CSV/JSON exports rather than direct marketplace API connections. Confirm attribution, currency, site, dates, and report grain before comparing platforms. The [input contract](skills/shop-ad-analysis/references/input-contract.md) defines the required fields. Code is MIT licensed.
