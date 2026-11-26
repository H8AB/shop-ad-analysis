# 使用指南（中文）

[English guide](../GUIDE.md)

## 1. 先看案例

可[直接在浏览器打开中文案例报告](https://h8ab.github.io/shop-ad-analysis/examples/demo/report.zh-CN.html)。案例文件在 `examples/demo/`；[中文案例解读](../examples/demo/CASE.zh-CN.md) 解释指标与建议。所有数值均为合成数据。

## 2. 准备文件

必需：`manifest.json`、`ads.csv`。推荐补充：`store.csv`、`economics.csv`。字段契约见 `skills/shop-ad-analysis/references/input-contract.md`。

最小 manifest 示例：

```json
{
  "locale": "zh-CN",
  "platform": "你的平台",
  "site": "US",
  "category": "你的品类",
  "currency": "USD",
  "timezone": "America/Los_Angeles",
  "objective": "提高广告归因贡献",
  "attribution": {"label": "请填写实际归因定义与窗口"},
  "periods": {"current": {"start": "2026-11-12", "end": "2026-11-18"}}
}
```

英文是项目默认语言。需要中文报告时，设置 `"locale": "zh-CN"`，或在命令行加 `--locale zh-CN`；网页工具右上角也可切换语言。企业目标、归因说明等自填内容不会自动翻译，可选用 `objective_zh`、`attribution.label_zh`、`business_context.notes_zh` 提供中文版本。

`ads.csv` 至少包含：`date,campaign,sku,impressions,clicks,spend,attributed_orders,attributed_sales`。金额统一为 manifest 的币种；小数使用英文句点。不要把汇总行与明细行放在同一个 CSV 中。

原始列名不同，可在 manifest 中配置映射，例如：

```json
"column_map": {
  "ads": {
    "attributed_sales": "7 Day Sales",
    "attributed_orders": "7 Day Orders"
  }
}
```

映射字段必须确实来自同一平台、站点、币种、日期范围和归因定义。不同平台分别运行；此工具不会自动把平台指标解释为相同口径。

## 3. 在浏览器使用

直接打开 `web/ad-analysis.html`，选择文件后点“生成报告”。页面展示预览，可下载完整 HTML。浏览器工具在本地运行，不需要服务器或账号。选择真实数据时，请先阅读所在 AI 应用对附件和文件的处理规则。

## 4. 在 Codex、WorkBuddy、Claude 使用

- **Codex**：将 `skills/shop-ad-analysis/` 复制到当前 Codex 环境识别的技能目录，或解压 `dist/shop-ad-analysis-agent.zip`。在对话中请求“分析这些店铺广告数据并输出 HTML”，附上上述输入文件。具体技能目录以当前 Codex 版本为准。
- **WorkBuddy**：在“专家·技能·连接器 → 技能 → 添加技能 → 上传技能”导入 `dist/shop-ad-analysis-workbuddy.zip`，再上传业务文件并请求分析。该安装包含 WorkBuddy 市场元数据。
- **Claude 网页端**：在 Customize → Skills 上传 `dist/shop-ad-analysis-agent.zip` 并启用，然后附上业务文件请求 HTML 分析。上传后用案例文件验证技能是否被调用。
- **其他 AI 网页端**：若支持 Agent Skills，导入通用包；若不支持技能或代码执行，使用 `web/ad-analysis.html` 生成报告，再把报告交给 AI 讨论。不要假设所有网页应用都能运行技能中的脚本。

## 5. 命令行使用

```bash
node skills/shop-ad-analysis/scripts/analyze.js \
  --manifest examples/demo/manifest.json \
  --ads examples/demo/ads.csv \
  --store examples/demo/store.csv \
  --economics examples/demo/economics.csv \
  --out examples/demo/report.zh-CN.html \
  --locale zh-CN
```

`store.csv` 缺失时不计算 TACOS；SKU 成本率不完整时不计算整体归因贡献。运行遇到字段或粒度错误会停止，避免生成误导性报告。

## 6. 解读报告与行动

先看决策简报，再结合广告漏斗、ROAS 分量和 SKU 卡片阅读数据质量说明。漏斗各级分别缩放，ROAS 图是指标恒等式的描述，均不能证明原因。SKU 盈亏平衡 ROAS 参考值使用 `1 / (1－可变成本率)`，未计固定费用和广告增量效果。每项建议列出建议负责人、验证动作和停止／复议条件；不应仅凭短期归因数据直接大幅停投或加预算。尤其检查归因回补、价格促销、库存和成本率口径。
