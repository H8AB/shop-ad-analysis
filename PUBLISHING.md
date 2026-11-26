# GitHub release guide

The repository is public at [H8AB/shop-ad-analysis](https://github.com/H8AB/shop-ad-analysis). English is the primary language; optional Chinese documentation and reports are linked from the English entry points.

## Release contents

- `README.md` and `GUIDE.md`: English project introduction and usage instructions.
- `docs/README.zh-CN.md` and `docs/GUIDE.zh-CN.md`: optional Chinese documentation.
- `examples/demo/`: synthetic inputs, English and Chinese HTML reports, structured result, and case studies.
- `dist/shop-ad-analysis-agent.zip`: standard Agent Skills package.
- `dist/shop-ad-analysis-workbuddy.zip`: package with WorkBuddy display metadata.
- `LICENSE` and `.github/workflows/verify.yml`: MIT license and CI verification.

## Before a release

```bash
npm test
npm run demo
npm run build
```

Verify the browser demo in English and Chinese, confirm ZIPs have only `shop-ad-analysis/` at the top level, and check that no real business data or credentials are included. Install-test each package in its target host before claiming host-level compatibility.

Publish a versioned GitHub Release with the two ZIPs. Link the [online demo](https://h8ab.github.io/shop-ad-analysis/), [usage guide](GUIDE.md), and [case study](examples/demo/CASE.md). Version 1.1 changes language defaults and presentation; it does not add marketplace API connectors.
