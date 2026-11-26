#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {parseCsv,analyze,renderHtml}=require('./engine.js');
function main(){
  const arg=process.argv.slice(2),get=k=>{const i=arg.indexOf('--'+k);return i<0?null:arg[i+1];};
  if(arg.includes('--help') || !get('manifest') || !get('ads') || !get('out')) {
    console.log('用法: node scripts/analyze.js --manifest manifest.json --ads ads.csv [--store store.csv] [--economics economics.csv] --out report.html [--json result.json]');
    process.exit(arg.includes('--help')?0:2);
  }
  const readCsv=k=>get(k)?parseCsv(fs.readFileSync(get(k),'utf8')):[];
  const report=analyze({manifest:JSON.parse(fs.readFileSync(get('manifest'),'utf8')),ads:readCsv('ads'),store:readCsv('store'),economics:readCsv('economics')});
  fs.mkdirSync(path.dirname(path.resolve(get('out'))),{recursive:true});
  fs.writeFileSync(get('out'),renderHtml(report));
  if(get('json')) fs.writeFileSync(get('json'),JSON.stringify(report,null,2));
  console.log(`报告已生成: ${get('out')}；广告 ${report.source_counts.ads} 行；数据提示 ${report.quality.length} 条`);
}
try{main();}catch(e){console.error('分析失败：'+e.message);process.exit(1);}
