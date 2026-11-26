# Sample case: higher ad spend without store sales growth

[中文案例解读](CASE.zh-CN.md)

This fully synthetic case represents a US-site storage category store on a fictional “Sample Platform.” It is not a real marketplace benchmark. Two seven-day periods are compared using ad exports, store sales, SKU variable cost rates, and a company ROAS target.

## Observations

- Ad spend rose from USD 200 to USD 266 while attributed ad sales slipped from USD 760 to USD 750. ROAS fell from 3.80 to 2.82.
- Store sales stayed at USD 1,120 in both periods. TACOS rose from 17.9% to 23.8%. This says spend took a larger share of same-period store sales; it does not prove the ads had no incremental effect.
- CPC rose from about USD 1.11 to USD 1.33, while click conversion rate fell from 12.2% to 10.5%. In the ROAS identity's log decomposition, CPC is the largest negative component, followed by conversion rate.
- SKU-A spent USD 176 and generated USD 270 of attributed sales. At its 55% variable cost rate, estimated attributed contribution was **−USD 54.50**. SKU-B remained positive. The store-wide estimate fell from USD 122 to USD 47.50.
- SKU-A represented 66.2% of current ad spend. Its ROAS of 1.53 was below its 2.22 break-even *attributed contribution proxy* from `1 / (1 − 0.55)`. SKU-B's ROAS was 5.33 against a 2.50 proxy. These are cost-screening thresholds, not audited or incremental profit thresholds.

## Decision and test

The paid-media and SKU owners should review SKU-A's search terms, bids, listing, and cost assumptions first; make a limited change. Check which campaign or placement coincided with the higher CPC. The inventory owner should confirm replenishment before SKU-B scaling. In the next equal-length period, review SKU contribution, orders, and store sales using the same attribution basis. Revise the SKU-A test if contribution does not improve; pause scaling if stockouts rise or contribution turns negative.

This is a diagnostic plan, not a causal proof. See the [English report](report.html), [Chinese report](report.zh-CN.html), and [structured result](result.json).
