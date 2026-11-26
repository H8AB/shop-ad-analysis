# Sample case: higher ad spend without store sales growth

[中文案例解读](CASE.zh-CN.md)

This fully synthetic case represents a US-site storage category store on a fictional “Sample Platform.” It is not a real marketplace benchmark. Two seven-day periods are compared using ad exports, store sales, SKU variable cost rates, and a company ROAS target.

## Observations

- Ad spend rose from USD 200 to USD 266 while attributed ad sales slipped from USD 760 to USD 750. ROAS fell from 3.80 to 2.82.
- Store sales stayed at USD 1,120 in both periods. TACOS rose from 17.9% to 23.8%. This says spend took a larger share of same-period store sales; it does not prove the ads had no incremental effect.
- CPC rose from about USD 1.11 to USD 1.33, while click conversion rate fell from 12.2% to 10.5%. In the ROAS identity's log decomposition, CPC is the largest negative component, followed by conversion rate.
- SKU-A spent USD 176 and generated USD 270 of attributed sales. At its 55% variable cost rate, estimated attributed contribution was **−USD 54.50**. SKU-B remained positive. The store-wide estimate fell from USD 122 to USD 47.50.

## Decision and test

Review SKU-A's search terms, bids, listing, and cost assumptions first; make a limited change. Check which campaign or placement drove the higher CPC. Confirm replenishment before scaling SKU-B. In the next comparable period, review SKU contribution, orders, and store sales using the same attribution basis.

This is a diagnostic plan, not a causal proof. See the [English report](report.html), [Chinese report](report.zh-CN.html), and [structured result](result.json).
