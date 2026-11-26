# GitHub 发布准备

## 已包含

- `README.md`：项目用途、快速试用、目录和数据边界。
- `GUIDE.md`：字段契约、浏览器与三类智能体使用方法。
- `examples/demo/`：可复现的合成输入、HTML 报告、结果 JSON 和案例解读。
- `LICENSE`：MIT；`.github/workflows/verify.yml`：推送和 PR 时验证测试与生成文件。
- `dist/shop-ad-analysis-agent.zip`：开放格式安装包；`dist/shop-ad-analysis-workbuddy.zip`：含 WorkBuddy 元数据的安装包。

## 发布前核查

```bash
npm test
npm run demo
npm run build
```

逐一检查：案例报告能打开；`web/ad-analysis.html` 的内置案例可运行；ZIP 顶层仅有 `shop-ad-analysis/`；不存在真实业务数据、令牌或私人文件。建议再在目标版本的 Codex、WorkBuddy 和 Claude 实际安装试跑一次，确认各宿主的脚本执行权限与文件路径。

## 发布操作

在 GitHub 账号下新建 `shop-ad-analysis` 仓库，将本目录内容推送到仓库根目录。仓库描述可用：

> 开源店铺广告分析 Agent Skill：结合平台、站点、品类与 SKU 成本，生成可验证的 HTML 决策报告，支持 Codex、WorkBuddy、Claude 与离线网页。

首个 Release 建议标记 `v1.0.0`，附上两份 `dist/*.zip`，在说明中链接 `GUIDE.md` 和 `examples/demo/CASE.md`。发布时不要把真实店铺导出或企业成本配置放入仓库。正式声明“已验证可用”前，应分别完成目标宿主的安装测试。
