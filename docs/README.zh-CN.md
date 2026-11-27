# 店铺广告分析 · 中文说明

## 先这样用

把平台导出的广告报表发给我，告诉我店铺所在站点、想比较的时间，以及你最担心的问题。比如：“这周广告花费涨了，订单却没跟上，帮我看看原因。”有商品成本或全店销售数据时一并提供，结论会更完整。

我会先用几句话讲清主要变化、哪些判断有数据支持、下一步先试什么，再附图表报告。你可以继续问“只看这个商品”“把建议改成我能交给投放同事的清单”。

不需要准备 JSON 或账号密码。经营报表属于私有数据，公开示例只用合成数据。

[English README](../README.md)

一个基于 [Agent Skills](https://agentskills.io/specification) 格式的开源技能。它把广告导出、店铺销售和 SKU 可变成本率结合起来，生成可离线打开的 HTML 决策报告；附带浏览器本地分析页面。

## 立刻试用

1. 打开 [在线体验页](https://h8ab.github.io/shop-ad-analysis/)，可直接看[案例报告](https://h8ab.github.io/shop-ad-analysis/examples/demo/report.zh-CN.html)。
2. 也可下载后打开 [离线网页工具](../web/ad-analysis.html)，先点“先看示例报告”；分析自己的店铺时，填写平台、站点、品类和币种，选择导出的广告 CSV。全店销售和商品成本文件可以按需补充。
3. 使用智能体时，把 [技能目录](../skills/shop-ad-analysis/) 安装到宿主支持的技能位置，或使用 [Agent Skills ZIP](../dist/shop-ad-analysis-agent.zip)。WorkBuddy 上传适配包使用 [专用 ZIP](../dist/shop-ad-analysis-workbuddy.zip)。具体步骤见 [使用指南](GUIDE.zh-CN.md)。

## 能解决的问题

- 广告花费、ROAS、ACOS、TACOS 与广告归因贡献估算发生了什么变化？
- 变化主要落在点击成本、点击转化率还是广告客单价？
- 哪些 SKU、活动或关键词值得先排查？每条建议如何复盘？
- 数据缺了什么，哪些结论暂时不能下？

报告只根据输入文件计算，不会请求平台接口或使用未经验证的类目均值。广告归因贡献估算不是净利润，也不是广告的增量收益。

## 项目结构

```text
skills/shop-ad-analysis/  可安装的 Agent Skill、分析引擎、规则和离线网页资产
web/ad-analysis.html            可直接在浏览器打开的单文件工具
examples/demo/                 合成案例数据、结果 JSON 和 HTML 报告
tools/                         案例、网页和安装包构建脚本
tests/                         计算与数据质量测试
dist/                          Codex/Claude 通用包与 WorkBuddy 包
GUIDE.md                       使用与字段映射指南
```

## 开发与验证

需要 Node.js 18+；运行时无第三方依赖。

```bash
npm test
npm run demo
npm run build
```

`npm run demo` 会重新生成合成数据和报告；`npm run build` 会重建单文件网页与安装包。

准备发布时，请阅读 [GitHub 发布说明](../PUBLISHING.md)。

## 开源与数据边界

项目代码采用 MIT 许可证。案例数据完全合成，不代表任何真实店铺或平台数据。真实广告导出、成本、利润目标、令牌和凭证不得提交到公开仓库。离线网页处理选中的本地文件，不包含上传服务；智能体宿主如何处理附件仍以其服务条款和用户设置为准。

首版采用标准化 CSV/JSON，不含平台 API 直连。不同平台的归因定义、报表字段、站点币种和时间范围必须在运行前核对；详见 [输入契约](../skills/shop-ad-analysis/references/input-contract.md)。
