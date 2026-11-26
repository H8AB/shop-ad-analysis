# Analysis rules

## Sequence

1. Confirm the business objective: profitable growth, launch, defense, liquidation, or another user goal. Use company targets if provided.
2. Reconcile data scope and totals before interpreting performance. A ratio is calculated from summed numerators and denominators. A zero denominator yields no ratio.
3. Compare equal-length windows where possible. Flag seasonality, promotions, price changes, inventory, return lag, and attribution lag as possible confounders.
4. Diagnose from store/category to SKU, campaign, then keyword. Use the ROAS identity `ROAS = CVR × AOV / CPC` to describe which components changed. Log decomposition gives an exact additive breakdown when all values are positive, but does not establish cause.
5. Estimate ad-attributed contribution only with cost-rate coverage for every included SKU: `attributed_sales × (1 − SKU variable_cost_rate) − ad_spend`. This is a decision proxy, not incremental or audited profit.
6. Recommend bounded experiments. Include evidence, action, expected direction, and the metric/time window for review. Do not automatically pause advertising based on short windows or arbitrary universal thresholds.
7. Present the decision before dense tables. Use a visual only when it clarifies a comparison or diagnostic path, and calculate it from the same totals as the narrative. Show the period, unit, denominator or formula, and a textual interpretation. For SKU contribution, a break-even ROAS proxy is `1 / (1 - variable_cost_rate)` only when the rate is below 1; it excludes fixed costs and does not establish incremental lift.

## Interpretation guardrails

- ROAS and ACOS use attributed sales; TACOS uses total store sales. TACOS does not measure causality.
- Different platforms, sites, currencies, tax treatments, or attribution definitions require separate reporting or documented harmonization before comparison.
- Low-volume segments are exploratory. `min_clicks_for_directional` controls when the bundled rules make directional comparisons; it is not a statistical significance test.
- Distinguish a measured fact from a hypothesis. Use platform/category benchmarks only when their source, date, and comparable definition are available.
- When a required dimension is missing, show “无法判断” and the missing field instead of inventing a diagnosis.
