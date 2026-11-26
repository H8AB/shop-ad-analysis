/* Portable, dependency-free analysis core. Works in Node and in a browser. */
(function (root) {
  'use strict';

  const requiredAds = ['date', 'campaign', 'sku', 'impressions', 'clicks', 'spend', 'attributed_orders', 'attributed_sales'];
  const numericAds = ['impressions', 'clicks', 'spend', 'attributed_orders', 'attributed_sales'];
  const safe = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const round = (x, n=2) => Number.isFinite(x) ? Number(x.toFixed(n)) : null;
  const ratio = (a,b) => b > 0 ? a/b : null;
  const sum = (rows,k) => rows.reduce((n,r) => n + (r[k] || 0), 0);
  const fmt = (x,n=2) => x == null ? '—' : Number(x).toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n});
  const pct = x => x == null ? '—' : fmt(x*100,1)+'%';
  const change = (a,b) => b > 0 ? (a-b)/b : null;
  const isZh = locale => (typeof locale === 'string' ? locale : locale?.locale) === 'zh-CN';
  const L = (locale,en,zh) => isZh(locale) ? zh : en;
  const driverLabel = (locale,key) => ({cpc:L(locale,'Cost per click','点击成本'),cvr:L(locale,'Click conversion rate','点击转化率'),aov:L(locale,'Attributed average order value','广告客单价')})[key] || key;
  const validDate = s => {if(!/^\d{4}-\d{2}-\d{2}$/.test(s||'')) return false; const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;};

  function parseCsv(text,locale='en') {
    text = String(text).replace(/^\uFEFF/, '');
    const lines=[]; let row=[], field='', quoted=false;
    for (let i=0;i<text.length;i++) {
      const c=text[i];
      if (quoted) { if (c==='"' && text[i+1]==='"') {field+='"';i++;} else if(c==='"') quoted=false; else field+=c; }
      else if(c==='"') quoted=true;
      else if(c===',') {row.push(field);field='';}
      else if(c==='\n' || c==='\r') { if(c==='\r' && text[i+1]==='\n') i++; row.push(field); if(row.some(v=>v!=='')) lines.push(row); row=[];field=''; }
      else field+=c;
    }
    if(quoted) throw new Error(L(locale,'Unclosed CSV quote','CSV 引号未闭合'));
    row.push(field); if(row.some(v=>v!=='')) lines.push(row);
    if(!lines.length) return [];
    const headers=lines.shift().map(x=>x.trim());
    if(new Set(headers).size!==headers.length) throw new Error(L(locale,'CSV contains duplicate column names','CSV 存在重复列名'));
    return lines.map((cells,i)=>{const obj={}; headers.forEach((h,j)=>obj[h]=cells[j] ?? ''); if(cells.length>headers.length) throw new Error(L(locale,`CSV row ${i+2} has too many columns`,`CSV 第 ${i+2} 行列数过多`));return obj;});
  }

  function assertManifest(m) {
    if(!m || typeof m!=='object') throw new Error('Missing manifest.json');
    m.locale=m.locale || 'en';
    if(!['en','zh-CN'].includes(m.locale)) throw new Error('locale must be en or zh-CN');
    for(const k of ['platform','site','category','currency','timezone']) if(!m[k]) throw new Error(L(m,`manifest is missing ${k}`,`manifest 缺少 ${k}`));
    if(!m.periods?.current?.start || !m.periods?.current?.end) throw new Error(L(m,'manifest is missing the current date range','manifest 缺少 current 日期范围'));
    for(const [name,p] of Object.entries(m.periods)) {
      if(!validDate(p.start) || !validDate(p.end) || p.start>p.end) throw new Error(L(m,`${name} date range is invalid`,`${name} 日期范围无效`));
    }
    if(m.periods.previous && !(m.periods.previous.end < m.periods.current.start || m.periods.current.end < m.periods.previous.start)) throw new Error(L(m,'Previous and current periods overlap','对比周期与当前周期重叠'));
    if(!m.attribution?.label) throw new Error(L(m,'manifest is missing attribution.label','manifest 缺少广告归因口径 attribution.label'));
    return m;
  }
  function mapped(row, map) {const out={}; for(const [canonical,source] of Object.entries(map||{})) out[canonical]=row[source]; return {...row,...out};}
  function num(v,field,line,required=false,locale='en') {
    if(v==null || String(v).trim()==='') {if(required) throw new Error(L(locale,`Row ${line} is missing ${field}`,`第 ${line} 行缺少 ${field}`));return null;}
    const n=Number(String(v).replace(/,/g,''));
    if(!Number.isFinite(n) || n<0) throw new Error(L(locale,`Row ${line}: ${field} must be non-negative`,`第 ${line} 行 ${field} 必须是非负数`));
    return n;
  }
  function periodFor(date,m) {for(const [name,p] of Object.entries(m.periods)) if(date>=p.start && date<=p.end) return name; return null;}
  function normalizeAds(raw,m,quality) {
    const out=[]; const seen=new Set();
    raw.forEach((source,i)=>{
      const r=mapped(source,m.column_map?.ads), line=i+2;
      for(const k of requiredAds) if(r[k]==null || String(r[k]).trim()==='') throw new Error(L(m,`ads row ${line} is missing ${k}`,`ads 第 ${line} 行缺少 ${k}`));
      if(!validDate(r.date)) throw new Error(L(m,`ads row ${line} has an invalid date`,`ads 第 ${line} 行日期无效`));
      const period=periodFor(r.date,m); if(!period) {quality.push(L(m,`Ads row ${line} is outside the analysis periods and was skipped`,`广告数据第 ${line} 行不在分析周期内，已跳过`));return;}
      const item={period,date:r.date,campaign:String(r.campaign),ad_group:String(r.ad_group||''),sku:String(r.sku),keyword:String(r.keyword||''),source_line:line};
      for(const k of numericAds) item[k]=num(r[k],k,line,true,m);
      if(item.clicks>item.impressions) quality.push(L(m,`Ads row ${line} has more clicks than impressions; check the export grain`,`广告数据第 ${line} 行点击量大于展示量，请核对导出粒度`));
      const key=JSON.stringify({...item,source_line:0}); if(seen.has(key)) throw new Error(L(m,`Ads row ${line} exactly duplicates another row; check the export before retrying`,`ads 第 ${line} 行与其他行完全相同，可能重复导出；请核对后重试`));seen.add(key);
      out.push(item);
    });
    return out;
  }
  function normalizeStore(raw,m,quality) {
    const out=[]; const keys=new Set();
    raw.forEach((source,i)=>{
      const r=mapped(source,m.column_map?.store),line=i+2;
      if(!r.date || !r.sku) throw new Error(L(m,`store row ${line} is missing date or sku`,`store 第 ${line} 行缺少 date 或 sku`));
      if(!validDate(r.date)) throw new Error(L(m,`store row ${line} has an invalid date`,`store 第 ${line} 行日期无效`));
      const period=periodFor(r.date,m);if(!period){quality.push(L(m,`Store row ${line} is outside the analysis periods and was skipped`,`店铺数据第 ${line} 行不在分析周期内，已跳过`));return;}
      const key=r.date+'|'+r.sku;if(keys.has(key)) throw new Error(L(m,`store row ${line} duplicates a date + SKU key`,`store 第 ${line} 行 date+sku 重复，避免店铺销售额重复计算`));keys.add(key);
      out.push({period,date:r.date,sku:String(r.sku),store_sales:num(r.store_sales,'store_sales',line,true,m),store_orders:num(r.store_orders,'store_orders',line,false,m),inventory_units:num(r.inventory_units,'inventory_units',line,false,m)});
    });return out;
  }
  function normalizeEconomics(raw,m) {
    const map=new Map();raw.forEach((source,i)=>{
      const r=mapped(source,m.column_map?.economics),line=i+2;
      if(!r.sku) throw new Error(L(m,`economics row ${line} is missing sku`,`economics 第 ${line} 行缺少 sku`));
      if(map.has(String(r.sku))) throw new Error(L(m,`economics row ${line} duplicates a SKU`,`economics 第 ${line} 行 SKU 重复`));
      const rate=num(r.variable_cost_rate,'variable_cost_rate',line,true,m);
      if(rate>5) throw new Error(L(m,`economics row ${line} cost rate exceeds 5; check decimal versus percentage input`,`economics 第 ${line} 行成本率超过 5，请核对小数与百分数口径`));
      map.set(String(r.sku),rate);
    });return map;
  }
  function aggregate(rows,store,econ) {
    const a={impressions:sum(rows,'impressions'),clicks:sum(rows,'clicks'),spend:sum(rows,'spend'),orders:sum(rows,'attributed_orders'),ad_sales:sum(rows,'attributed_sales'),store_sales:store.length?sum(store,'store_sales'):null};
    a.ctr=ratio(a.clicks,a.impressions);a.cpc=ratio(a.spend,a.clicks);a.cvr=ratio(a.orders,a.clicks);a.aov=ratio(a.ad_sales,a.orders);a.roas=ratio(a.ad_sales,a.spend);a.acos=ratio(a.spend,a.ad_sales);a.tacos=a.store_sales==null?null:ratio(a.spend,a.store_sales);
    const missing=[...new Set(rows.filter(r=>!econ.has(r.sku)).map(r=>r.sku))];
    a.contribution=rows.length && missing.length===0 ? a.ad_sales-rows.reduce((n,r)=>n+r.attributed_sales*econ.get(r.sku),0)-a.spend : null;
    a.economics_missing=missing;
    return a;
  }
  function segments(rows,store,econ,key) {
    const ids=[...new Set(rows.map(r=>r[key]).filter(Boolean))];
    return ids.map(id=>({name:id,current:aggregate(rows.filter(r=>r.period==='current'&&r[key]===id),store.filter(r=>r.period==='current' && key==='sku' && r.sku===id),econ),previous:aggregate(rows.filter(r=>r.period==='previous'&&r[key]===id),store.filter(r=>r.period==='previous' && key==='sku' && r.sku===id),econ)})).sort((a,b)=>b.current.spend-a.current.spend);
  }
  function days(p) {return Math.round((Date.parse(p.end+'T00:00:00Z')-Date.parse(p.start+'T00:00:00Z'))/86400000)+1;}
  function drivers(now,prev) {
    if(!now.roas || !prev.roas || !now.cpc || !prev.cpc || !now.cvr || !prev.cvr || !now.aov || !prev.aov) return [];
    return [{key:'cpc',value:-Math.log(now.cpc/prev.cpc)},{key:'cvr',value:Math.log(now.cvr/prev.cvr)},{key:'aov',value:Math.log(now.aov/prev.aov)}].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).map(x=>({...x,value:round(x.value,3)}));
  }
  function makeActions(report,m) {
    const a=[],c=report.current,p=report.previous,min=m.min_clicks_for_directional ?? 30;
    if(c.contribution!=null && c.contribution<0) a.push({priority:'high',title:L(m,'Address loss-making traffic first','先处理亏损流量'),evidence:L(m,`Estimated attributed contribution: ${fmt(c.contribution)} ${m.currency}; cost rates cover all advertised SKUs.`,`广告归因贡献估算 ${fmt(c.contribution)} ${m.currency}；成本率覆盖全部广告 SKU。`),action:L(m,'Review bids, search terms, and margins by SKU and keyword; change a small slice first.','按 SKU 与关键词复核出价、搜索词和利润空间，先做小范围调整。'),verify:L(m,'Track contribution, orders, and store sales; avoid a broad pause based on one period.','观察归因贡献、订单量与自然销售变化；避免一次性大幅停投。')});
    for(const s of report.sku.filter(s=>s.current.contribution!=null && s.current.contribution<0).slice(0,3)) a.push({priority:'high',title:L(m,`Review ${s.name} attributed loss`,`复核 ${s.name} 的归因亏损`),evidence:L(m,`Spend ${fmt(s.current.spend)} ${m.currency}; estimated attributed contribution ${fmt(s.current.contribution)} ${m.currency}.`,`本期花费 ${fmt(s.current.spend)} ${m.currency}，归因贡献估算 ${fmt(s.current.contribution)} ${m.currency}。`),action:L(m,'Check search terms, bids, listing, and cost structure; reduce inefficient traffic in a limited test.','检查该 SKU 的搜索词、竞价、商品页和成本结构；先小范围降低低效流量。'),verify:L(m,'Track this SKU’s attributed contribution, orders, and store sales on the same basis.','同口径跟踪该 SKU 的归因贡献、订单量及店铺销售。')});
    if(p.clicks>=min && c.clicks>=min && c.roas!=null && p.roas!=null && c.roas<p.roas*0.9) {
      const d=report.drivers[0],target=Number(m.business_context?.target_roas);
      const driverText=d?L(m,`largest log-change component: ${driverLabel(m,d.key)}`,`最大对数变化项为${driverLabel(m,d.key)}`):L(m,'more data is needed to identify a component','需补足有效分母后再判断驱动因素');
      const targetText=Number.isFinite(target)&&target>0?L(m,`; company target ${fmt(target)}`,`；企业目标为 ${fmt(target)}`):'';
      const action=d?.key==='cpc'?L(m,'Review bids, placements, and search terms with rising competition.','检查竞价、投放位置和竞争加剧的搜索词。'):d?.key==='cvr'?L(m,'Check listing quality, price, offers, stock, and query relevance.','检查商品页、价格、优惠、库存和搜索词匹配。'):L(m,'Review product mix, order value, and promotions.','检查商品组合、客单价与促销变化。');
      a.push({priority:'high',title:L(m,'Diagnose the ROAS decline','拆解广告回报下降'),evidence:L(m,`ROAS fell from ${fmt(p.roas)} to ${fmt(c.roas)}; ${driverText}${targetText}.`,`ROAS 从 ${fmt(p.roas)} 降至 ${fmt(c.roas)}；${driverText}${targetText}。`),action,verify:L(m,'Keep major conditions stable and review the next period using the same attribution window.','保持其他主要条件稳定，按相同归因窗口复盘下一周期。')});
    }
    for(const s of report.sku.filter(s=>s.current.spend>0 && s.current.orders===0).slice(0,3)) if(s.current.clicks>=min) a.push({priority:'medium',title:L(m,`Review ${s.name} clicks without orders`,`复核 ${s.name} 的无订单点击`),evidence:L(m,`${fmt(s.current.clicks,0)} clicks and ${fmt(s.current.spend)} ${m.currency} spent this period; zero attributed orders.`,`本期 ${fmt(s.current.clicks,0)} 次点击、花费 ${fmt(s.current.spend)} ${m.currency}，广告归因订单为 0。`),action:L(m,'Check query relevance, listing, and availability; use a longer window before bid or negative-keyword decisions.','检查搜索词相关性、商品页和供货状态；依据更长观察窗决定是否降价或否词。'),verify:L(m,'Record clicks, orders, and spend before and after; allow for attribution lag.','记录调整前后点击、订单与花费；考虑归因回补。')});
    if(c.contribution!=null && c.contribution>0 && c.roas!=null && (!p.roas || c.roas>=p.roas) && !a.length) a.push({priority:'medium',title:L(m,'Test a modest budget increase','小幅测试增量预算'),evidence:L(m,`Estimated attributed contribution ${fmt(c.contribution)} ${m.currency}; current ROAS ${fmt(c.roas)}.`,`广告归因贡献估算 ${fmt(c.contribution)} ${m.currency}，本期 ROAS ${fmt(c.roas)}。`),action:L(m,'Confirm inventory and fulfillment capacity, then test a small budget increase on high-contribution SKUs.','先确认库存和履约能力，再小幅提高高贡献 SKU 的预算。'),verify:L(m,'Review incremental profit and store sales, not attributed sales alone.','以增量利润及店铺总销售额复盘，不只看广告归因销售额。')});
    if(!a.length) a.push({priority:'medium',title:L(m,'Complete the evidence before changing budget','先补齐证据再调整预算'),evidence:L(m,'Current data does not support a clear high-confidence budget change.','当前数据未触发明确的高置信度调整条件。'),action:L(m,'Add a comparison period, cost rates, and store sales; then inspect by SKU.','优先补齐对比周期、成本率与店铺销售额，再按 SKU 排查。'),verify:L(m,'Review the next period with the same fields and attribution basis.','下一周期使用相同字段与归因口径复盘。')});
    return a;
  }
  function analyze(input) {
    const m=assertManifest(input.manifest),quality=[];
    const ads=normalizeAds(input.ads||[],m,quality),store=normalizeStore(input.store||[],m,quality),econ=normalizeEconomics(input.economics||[],m);
    if(!ads.some(r=>r.period==='current')) throw new Error(L(m,'No ad data in the current period','当前周期没有可分析的广告数据'));
    const storeKeys=new Set(store.map(r=>r.date+'|'+r.sku));
    const missingStore=store.length?[...new Set(ads.filter(r=>!storeKeys.has(r.date+'|'+r.sku)).map(r=>r.date+'|'+r.sku))]:[];
    if(missingStore.length) quality.push(L(m,`Store data is missing ${missingStore.length} ad date + SKU combinations; TACOS is suppressed to avoid a partial denominator`,`店铺数据缺少 ${missingStore.length} 个广告日期+SKU 组合；不计算 TACOS，避免部分销售额误导`));
    const storeForMetrics=missingStore.length?[]:store;
    const current=aggregate(ads.filter(r=>r.period==='current'),storeForMetrics.filter(r=>r.period==='current'),econ);
    const previous=aggregate(ads.filter(r=>r.period==='previous'),storeForMetrics.filter(r=>r.period==='previous'),econ);
    if(!m.periods.previous) quality.push(L(m,'No comparison period was provided; only current-period diagnosis is available','未提供对比周期，只提供当前周期诊断'));
    else if(days(m.periods.current)!==days(m.periods.previous)) quality.push(L(m,'Period lengths differ; percentage changes are not daily-average changes','当前周期与对比周期天数不同，变化率不可直接解释为日均变化'));
    if(!store.length) quality.push(L(m,'Store sales were not provided; TACOS and overall store sales movement cannot be assessed','未提供店铺销售额，无法计算 TACOS 或评估店铺整体销售变化'));
    if(current.economics_missing.length) quality.push(L(m,`Missing SKU cost rates: ${current.economics_missing.join(', ')}; overall attributed contribution is suppressed`,`缺少 SKU 成本率：${current.economics_missing.join('、')}；不计算整体广告归因贡献`));
    if(current.store_sales!=null && current.ad_sales>current.store_sales) quality.push(L(m,'Attributed ad sales exceed same-period store sales; check attribution window, order dates, and scope','广告归因销售额高于同期店铺销售额；请核对归因窗口、订单日期与数据范围'));
    const report={manifest:m,current,previous,drivers:drivers(current,previous),campaign:segments(ads,storeForMetrics,econ,'campaign'),sku:segments(ads,storeForMetrics,econ,'sku'),keyword:segments(ads,storeForMetrics,econ,'keyword'),quality,source_counts:{ads:ads.length,store:store.length,economics:econ.size}};
    report.actions=makeActions(report,m);return report;
  }
  function renderHtml(r) {
    const m=r.manifest,c=r.current,p=r.previous,hasPrev=!!m.periods.previous;
    const tr=(en,zh)=>L(m,en,zh);
    const lang=isZh(m)?'zh-CN':'en';
    const delta=k=>{
      if(!hasPrev||p[k]==null||c[k]==null) return tr('No comparable data','无可比数据');
      if(k==='acos'||k==='tacos') {const points=(c[k]-p[k])*100;const value=(points>=0?'+':'')+fmt(points,1);return tr(`vs previous ${value} pp`,`较前期 ${value} 个百分点`);}
      const relative=change(c[k],p[k]);if(relative==null) return tr('No comparable data','无可比数据');
      const value=(relative>=0?'+':'')+pct(relative);return tr(`vs previous ${value}`,`较前期 ${value}`);
    };
    const cell=(label,value,detail)=>`<div class="kpi"><small>${safe(label)}</small><strong>${safe(value)}</strong><span>${safe(detail)}</span></div>`;
    const row=s=>`<tr><td>${safe(s.name)}</td><td>${fmt(s.current.spend)}</td><td>${fmt(s.current.clicks,0)}</td><td>${fmt(s.current.orders,0)}</td><td>${fmt(s.current.ad_sales)}</td><td>${fmt(s.current.roas)}</td><td>${fmt(s.current.contribution)}</td></tr>`;
    const table=(title,rows)=>`<section><h2>${safe(title)} <small>${safe(tr(`Showing ${Math.min(20,rows.length)} of ${rows.length}`,`展示前 ${Math.min(20,rows.length)} 项，共 ${rows.length} 项`))}</small></h2><div class="scroll"><table><thead><tr><th>${tr('Name','名称')}</th><th>${tr('Spend','花费')}</th><th>${tr('Clicks','点击')}</th><th>${tr('Attributed orders','归因订单')}</th><th>${tr('Attributed sales','归因销售额')}</th><th>ROAS</th><th>${tr('Est. attributed contribution','归因贡献估算')}</th></tr></thead><tbody>${rows.length?rows.slice(0,20).map(row).join(''):`<tr><td colspan="7">${tr('No data','无数据')}</td></tr>`}</tbody></table></div></section>`;
    const actions=r.actions.map((a,i)=>`<article class="action"><div><b>${i+1}. ${safe(a.title)}</b><em>${safe(a.priority==='high'?tr('High priority','高优先级'):tr('Medium priority','中优先级'))}</em></div><p><strong>${tr('Evidence','证据')}:</strong> ${safe(a.evidence)}</p><p><strong>${tr('Action','建议')}:</strong> ${safe(a.action)}</p><p><strong>${tr('Verify','验证')}:</strong> ${safe(a.verify)}</p></article>`).join('');
    const quality=r.quality.length?r.quality.map(x=>`<li>${safe(x)}</li>`).join(''):`<li>${tr('No material calculation gaps detected.','未发现会影响本报告计算的明显缺口。')}</li>`;
    const drivers=r.drivers.length?tr(`ROAS log-change decomposition: ${r.drivers.map(d=>`${driverLabel(m,d.key)} ${d.value>=0?'+':''}${fmt(d.value,3)}`).join('; ')}. Components sum to the log change in ROAS; this is descriptive, not causal.`,`ROAS 的对数变化分解：${r.drivers.map(d=>`${driverLabel(m,d.key)} ${d.value>=0?'+':''}${fmt(d.value,3)}`).join('；')}。三项相加对应 ROAS 的对数变化；这描述指标构成，不证明因果。`):tr('Insufficient data to decompose the ROAS change.','当前数据不足以分解 ROAS 变化。');
    const objective=isZh(m)?m.objective_zh||m.objective:m.objective;
    const attribution=isZh(m)?m.attribution.label_zh||m.attribution.label:m.attribution.label;
    const notes=isZh(m)?m.business_context?.notes_zh||m.business_context?.notes:m.business_context?.notes;
    const platformName=isZh(m)?m.platform_zh||m.platform:m.platform;
    const css=`:root{font-family:system-ui,-apple-system,"Segoe UI","PingFang SC",sans-serif;color:#17212e;background:#f5f7fa}*{box-sizing:border-box}body{margin:0}header{background:#11243a;color:white;padding:38px max(20px,calc((100vw - 1100px)/2))}header h1{margin:6px 0 12px;font-size:30px}header p{margin:4px 0;color:#bfd0e3}main{max-width:1100px;margin:auto;padding:24px 20px 60px}section{background:white;border:1px solid #dce3ec;border-radius:14px;padding:24px;margin:18px 0;box-shadow:0 2px 10px #162a4610}h2{font-size:20px;margin:0 0 18px}h2 small{font-size:12px;color:#60758a;font-weight:400}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.kpi{background:#f4f8fc;border-radius:10px;padding:16px;min-height:105px}.kpi small,.kpi span{display:block;color:#586c80}.kpi strong{display:block;font-size:25px;margin:8px 0}.kpi span{font-size:12px}.action{border-left:4px solid #2779a7;padding:10px 14px;margin:12px 0;background:#f6fafc}.action div{display:flex;justify-content:space-between;gap:10px}.action em{font-style:normal;color:#735200;font-size:12px}.action p{margin:7px 0;line-height:1.6}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px;border-bottom:1px solid #e5eaf0;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{background:#f4f8fc}li{margin:7px 0;line-height:1.5}.note{color:#536578;font-size:14px;line-height:1.6}footer{color:#6b7b8c;font-size:12px;margin-top:24px}@media print{body{background:white}section{break-inside:avoid;box-shadow:none}header{background:white;color:#17212e;padding:12px 20px}header p{color:#536578}}`;
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(platformName)} ${safe(m.site)} ${tr('Ad Performance Report','广告分析报告')}</title><style>${css}</style></head><body><header><p>SHOP AD ANALYSIS · ${safe(platformName)} / ${safe(m.site)}</p><h1>${safe(m.category)} ${tr('Ad Performance Report','店铺广告分析')}</h1><p>${safe(m.periods.current.start)} ${tr('to','至')} ${safe(m.periods.current.end)} · ${safe(m.currency)} · ${safe(m.timezone)}</p><p>${tr('Business goal','业务目标')}: ${safe(objective||tr('Not provided','未提供'))} · ${tr('Attribution','归因口径')}: ${safe(attribution)}</p></header><main><section><h2>${tr('Executive summary','管理摘要')}</h2><div class="grid">${cell(tr('Ad spend','广告花费'),fmt(c.spend)+' '+m.currency,delta('spend'))}${cell(tr('Attributed ad sales','广告归因销售额'),fmt(c.ad_sales)+' '+m.currency,delta('ad_sales'))}${cell('ROAS',fmt(c.roas),delta('roas'))}${cell('ACOS',pct(c.acos),delta('acos'))}${cell('TACOS',pct(c.tacos),c.tacos==null?tr('Store sales missing or incomplete','缺少或不完整的店铺销售额'):delta('tacos'))}${cell(tr('Est. attributed contribution','归因贡献估算'),c.contribution==null?'—':fmt(c.contribution)+' '+m.currency,c.contribution==null?tr('Some SKU cost rates are missing','缺少部分 SKU 成本率'):delta('contribution'))}</div><p class="note">${safe(drivers)}</p></section><section><h2>${tr('Recommended actions','建议行动')}</h2>${actions}</section>${table(tr('Campaigns','广告活动'),r.campaign)}${table(tr('Products / SKUs','商品 SKU'),r.sku)}${table(tr('Keywords','关键词'),r.keyword)}<section><h2>${tr('Data quality and scope','数据质量与范围')}</h2><p class="note">${tr('Rows read','读取行数')}: ${r.source_counts.ads} ${tr('ads','广告')}, ${r.source_counts.store} ${tr('store','店铺')}; ${r.source_counts.economics} ${tr('SKU cost rates','个 SKU 成本率')}. ${tr('Comparison period','对比周期')}: ${hasPrev?safe(m.periods.previous.start)+' '+tr('to','至')+' '+safe(m.periods.previous.end):tr('Not provided','未提供')}.</p><p class="note">${tr('Company context','企业背景')}: ${safe(notes||tr('Not provided','未提供'))}; ${tr('Target ROAS','目标 ROAS')}: ${m.business_context?.target_roas==null?tr('Not provided','未提供'):fmt(Number(m.business_context.target_roas))}.</p><ul>${quality}</ul></section><section><h2>${tr('Definitions and limits','口径说明')}</h2><p class="note">${tr('CTR = clicks / impressions; CPC = spend / clicks; CVR = attributed orders / clicks; ROAS = attributed sales / spend; ACOS = spend / attributed sales; TACOS = ad spend / same-period store sales. Ratios are calculated after summing their numerators and denominators. A zero denominator displays “—”.','CTR=点击/展示；CPC=花费/点击；CVR=归因订单/点击；ROAS=归因销售额/花费；ACOS=花费/归因销售额；TACOS=广告花费/同期店铺销售额。所有比率先汇总分子与分母，再计算。分母为零显示“—”。')}</p><p class="note">${tr('Estimated attributed contribution = attributed sales × (1 − SKU variable cost rate) − ad spend. It is shown only when all advertised SKUs have a cost rate. It is neither audited net profit nor proof of incremental ad impact. Review inventory, competition, price, and attribution lag before acting.','归因贡献估算=广告归因销售额×(1−SKU 可变成本率)−广告花费，仅在全部广告 SKU 均有成本率时计算。它不是财务净利润，也不代表广告增量收益。建议须结合库存、竞争、价格和归因回补复核。')}</p></section><footer>${tr('Generated by Shop Ad Analysis · Based only on supplied files; no external benchmark was used.','由 Shop Ad Analysis 生成 · 报告数据仅来自提供的文件，未查询外部基准。')}</footer></main></body></html>`;
  }
  const api={parseCsv,analyze,renderHtml};root.ShopAdAnalysis=api;if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
