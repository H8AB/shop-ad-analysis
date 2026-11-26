'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../examples/demo');
fs.mkdirSync(root,{recursive:true});
const manifest={platform:'示例平台',site:'US',category:'Home & Kitchen / Storage',currency:'USD',timezone:'America/Los_Angeles',objective:'控制亏损 SKU，同时寻找可持续增长空间',business_context:{target_roas:3,notes:'现金流优先；SKU-A 库存充足，SKU-B 补货需确认。演示备注，非真实企业信息。'},attribution:{label:'演示数据：点击后 7 天归因，按广告平台报表日期汇总'},periods:{previous:{start:'2026-11-05',end:'2026-11-11'},current:{start:'2026-11-12',end:'2026-11-18'}},min_clicks_for_directional:30};
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
function csv(file,headers,rows){const q=v=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};fs.writeFileSync(path.join(root,file),headers.join(',')+'\n'+rows.map(r=>headers.map(h=>q(r[h])).join(',')).join('\n')+'\n');}
const ads=[],store=[];
const specs=[
  {name:'SKU-A',campaign:'Storage-Core',keyword:'storage bins',prev:{impressions:[1400,1450,1500,1550,1500,1550,1550],clicks:[14,14,14,14,14,15,15],spend:[17,17,17,17,17,17,18],orders:[2,2,2,2,2,1,1],sales:[60,60,60,60,60,30,30],store:[80,80,80,80,80,75,75]},now:{impressions:[1600,1650,1700,1750,1800,1850,1900],clicks:[15,15,16,16,16,16,16],spend:[24,24,25,25,26,26,26],orders:[2,1,1,1,2,1,1],sales:[60,30,30,30,60,30,30],store:[75,70,70,70,75,70,70]}},
  {name:'SKU-B',campaign:'Storage-Growth',keyword:'closet organizer',prev:{impressions:[1000,1050,1100,1150,1200,1250,1300],clicks:[11,11,11,11,12,12,12],spend:[11,11,11,11,12,12,12],orders:[2,1,2,1,2,1,1],sales:[80,40,80,40,80,40,40],store:[85,80,85,80,85,80,75]},now:{impressions:[1150,1200,1250,1300,1350,1400,1450],clicks:[12,13,13,13,13,13,13],spend:[12,13,13,13,13,13,13],orders:[2,2,1,2,2,1,2],sales:[80,80,40,80,80,40,80],store:[90,90,85,90,90,85,90]}}
];
for(let p=0;p<2;p++)for(let d=0;d<7;d++)for(const spec of specs){const v=p?spec.now:spec.prev,date=`2026-11-${String((p?12:5)+d).padStart(2,'0')}`;ads.push({date,campaign:spec.campaign,ad_group:'Auto',sku:spec.name,keyword:spec.keyword,impressions:v.impressions[d],clicks:v.clicks[d],spend:v.spend[d],attributed_orders:v.orders[d],attributed_sales:v.sales[d]});store.push({date,sku:spec.name,store_sales:v.store[d],store_orders:'',inventory_units:''});}
csv('ads.csv',['date','campaign','ad_group','sku','keyword','impressions','clicks','spend','attributed_orders','attributed_sales'],ads);
csv('store.csv',['date','sku','store_sales','store_orders','inventory_units'],store);
csv('economics.csv',['sku','variable_cost_rate'],[{sku:'SKU-A',variable_cost_rate:0.55},{sku:'SKU-B',variable_cost_rate:0.6}]);
console.log('Created synthetic demo data');
