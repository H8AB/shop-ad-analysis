#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {parseCsv,analyze,renderHtml}=require('./engine.js');
let activeLocale='en';
function main(){
  const arg=process.argv.slice(2),get=k=>{const i=arg.indexOf('--'+k);return i<0?null:arg[i+1];};
  if(arg.includes('--help') || !get('manifest') || !get('ads') || !get('out')) {
    console.log('Usage: node scripts/analyze.js --manifest manifest.json --ads ads.csv [--store store.csv] [--economics economics.csv] --out report.html [--json result.json] [--locale en|zh-CN]');
    process.exit(arg.includes('--help')?0:2);
  }
  const manifest=JSON.parse(fs.readFileSync(get('manifest'),'utf8'));
  manifest.locale=get('locale')||manifest.locale||'en';
  activeLocale=manifest.locale;
  const readCsv=k=>get(k)?parseCsv(fs.readFileSync(get(k),'utf8'),manifest.locale):[];
  const report=analyze({manifest,ads:readCsv('ads'),store:readCsv('store'),economics:readCsv('economics')});
  fs.mkdirSync(path.dirname(path.resolve(get('out'))),{recursive:true});
  fs.writeFileSync(get('out'),renderHtml(report));
  if(get('json')) fs.writeFileSync(get('json'),JSON.stringify(report,null,2));
  console.log(manifest.locale==='zh-CN'?`报告已生成: ${get('out')}；广告 ${report.source_counts.ads} 行；数据提示 ${report.quality.length} 条`:`Report generated: ${get('out')}; ${report.source_counts.ads} ad rows; ${report.quality.length} data notes`);
}
try{main();}catch(e){console.error((activeLocale==='zh-CN'?'分析失败：':'Analysis failed: ')+e.message);process.exit(1);}
