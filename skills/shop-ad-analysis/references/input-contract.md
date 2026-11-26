# Input contract

## Files

- `manifest.json`: platform, site, category, currency, timezone, business objective, attribution label, periods (`current` required, `previous` optional), optional `business_context` (`target_roas`, `notes`), `column_map`, and `min_clicks_for_directional`.
- `ads.csv`: one row per export grain. Required canonical columns: `date,campaign,sku,impressions,clicks,spend,attributed_orders,attributed_sales`. Optional: `ad_group,keyword`. Do not mix cumulative and daily rows.
- `store.csv` (optional): one row per `date+sku`; `date,sku,store_sales`, optional `store_orders,inventory_units`. `store_sales` must cover the same site, currency, and order-date scope as the report.
- `economics.csv` (optional): one row per `sku`; `sku,variable_cost_rate`. Rate is decimal (`0.65` means 65%). Include product cost, platform and fulfillment fees, discounts, and expected return loss according to company policy; disclose exclusions. No cost rate is inferred from category averages.

`column_map` maps canonical names to raw export headers, separately for `ads`, `store`, and `economics`. Example: `"column_map":{"ads":{"attributed_sales":"7 Day Sales"}}`. Every mapped source column must exist.

## Invariants

All monetary values must use the manifest currency. Convert elsewhere before running and record the conversion basis. Date strings use `YYYY-MM-DD`; periods are inclusive and may not overlap. Each report uses one platform, one site, one currency, one attribution definition, and one category scope. Split incompatible datasets into separate reports. The SKU key must match across all files. Source files must use the same aggregation scope and must not contain grand-total rows.

Advertising orders and sales are platform-attributed measures. Store orders and sales follow the user's store export. Attribution windows can cause legitimate timing differences; compare them with a caveat, not as reconciled ledgers.
