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
    if(c.contribution!=null && c.contribution<0) a.push({kind:'portfolio_loss',priority:'high',title:L(m,'Address loss-making traffic first','先处理亏损流量'),evidence:L(m,`Estimated attributed contribution: ${fmt(c.contribution)} ${m.currency}; cost rates cover all advertised SKUs.`,`广告归因贡献估算 ${fmt(c.contribution)} ${m.currency}；成本率覆盖全部广告 SKU。`),action:L(m,'Review bids, search terms, and margins by SKU and keyword; change a small slice first.','按 SKU 与关键词复核出价、搜索词和利润空间，先做小范围调整。'),verify:L(m,'Track contribution, orders, and store sales; avoid a broad pause based on one period.','观察归因贡献、订单量与自然销售变化；避免一次性大幅停投。')});
    for(const s of report.sku.filter(s=>s.current.contribution!=null && s.current.contribution<0).slice(0,3)) a.push({kind:'sku_loss',priority:'high',title:L(m,`Review ${s.name} attributed loss`,`复核 ${s.name} 的归因亏损`),evidence:L(m,`Spend ${fmt(s.current.spend)} ${m.currency}; estimated attributed contribution ${fmt(s.current.contribution)} ${m.currency}.`,`本期花费 ${fmt(s.current.spend)} ${m.currency}，归因贡献估算 ${fmt(s.current.contribution)} ${m.currency}。`),action:L(m,'Check search terms, bids, listing, and cost structure; reduce inefficient traffic in a limited test.','检查该 SKU 的搜索词、竞价、商品页和成本结构；先小范围降低低效流量。'),verify:L(m,'Track this SKU’s attributed contribution, orders, and store sales on the same basis.','同口径跟踪该 SKU 的归因贡献、订单量及店铺销售。')});
    if(p.clicks>=min && c.clicks>=min && c.roas!=null && p.roas!=null && c.roas<p.roas*0.9) {
      const d=report.drivers[0],target=Number(m.business_context?.target_roas);
      const driverText=d?L(m,`largest log-change component: ${driverLabel(m,d.key)}`,`最大对数变化项为${driverLabel(m,d.key)}`):L(m,'more data is needed to identify a component','需补足有效分母后再判断驱动因素');
      const targetText=Number.isFinite(target)&&target>0?L(m,`; company target ${fmt(target)}`,`；企业目标为 ${fmt(target)}`):'';
      const action=d?.key==='cpc'?L(m,'Review bids, placements, and search terms with rising competition.','检查竞价、投放位置和竞争加剧的搜索词。'):d?.key==='cvr'?L(m,'Check listing quality, price, offers, stock, and query relevance.','检查商品页、价格、优惠、库存和搜索词匹配。'):L(m,'Review product mix, order value, and promotions.','检查商品组合、客单价与促销变化。');
      a.push({kind:'roas_decline',priority:'high',title:L(m,'Diagnose the ROAS decline','拆解广告回报下降'),evidence:L(m,`ROAS fell from ${fmt(p.roas)} to ${fmt(c.roas)}; ${driverText}${targetText}.`,`ROAS 从 ${fmt(p.roas)} 降至 ${fmt(c.roas)}；${driverText}${targetText}。`),action,verify:L(m,'Keep major conditions stable and review the next period using the same attribution window.','保持其他主要条件稳定，按相同归因窗口复盘下一周期。')});
    }
    for(const s of report.sku.filter(s=>s.current.spend>0 && s.current.orders===0).slice(0,3)) if(s.current.clicks>=min) a.push({kind:'zero_orders',priority:'medium',title:L(m,`Review ${s.name} clicks without orders`,`复核 ${s.name} 的无订单点击`),evidence:L(m,`${fmt(s.current.clicks,0)} clicks and ${fmt(s.current.spend)} ${m.currency} spent this period; zero attributed orders.`,`本期 ${fmt(s.current.clicks,0)} 次点击、花费 ${fmt(s.current.spend)} ${m.currency}，广告归因订单为 0。`),action:L(m,'Check query relevance, listing, and availability; use a longer window before bid or negative-keyword decisions.','检查搜索词相关性、商品页和供货状态；依据更长观察窗决定是否降价或否词。'),verify:L(m,'Record clicks, orders, and spend before and after; allow for attribution lag.','记录调整前后点击、订单与花费；考虑归因回补。')});
    if(c.contribution!=null && c.contribution>0 && c.roas!=null && (!p.roas || c.roas>=p.roas) && !a.length) a.push({kind:'scale',priority:'medium',title:L(m,'Test a modest budget increase','小幅测试增量预算'),evidence:L(m,`Estimated attributed contribution ${fmt(c.contribution)} ${m.currency}; current ROAS ${fmt(c.roas)}.`,`广告归因贡献估算 ${fmt(c.contribution)} ${m.currency}，本期 ROAS ${fmt(c.roas)}。`),action:L(m,'Confirm inventory and fulfillment capacity, then test a small budget increase on high-contribution SKUs.','先确认库存和履约能力，再小幅提高高贡献 SKU 的预算。'),verify:L(m,'Review incremental profit and store sales, not attributed sales alone.','以增量利润及店铺总销售额复盘，不只看广告归因销售额。')});
    if(!a.length) a.push({kind:'data_gap',priority:'medium',title:L(m,'Complete the evidence before changing budget','先补齐证据再调整预算'),evidence:L(m,'Current data does not support a clear high-confidence budget change.','当前数据未触发明确的高置信度调整条件。'),action:L(m,'Add a comparison period, cost rates, and store sales; then inspect by SKU.','优先补齐对比周期、成本率与店铺销售额，再按 SKU 排查。'),verify:L(m,'Review the next period with the same fields and attribution basis.','下一周期使用相同字段与归因口径复盘。')});
    const metadata={
      portfolio_loss:[['Paid media + finance + SKU owner','投放、财务与商品负责人'],['Review the next comparable period. Revert a broad cut if orders fall without contribution improvement.','在下一可比周期复盘；若订单下降而贡献未改善，撤回扩大化削减。']],
      sku_loss:[['Paid media + SKU owner','投放与商品负责人'],['Stop or revise the SKU test if contribution fails to improve in the next comparable period.','若下一可比周期该 SKU 贡献未改善，停止或调整测试。']],
      roas_decline:[['Paid media + analytics','投放与数据分析'],['Reconsider if ROAS remains below the company target and contribution worsens; allow for attribution lag.','若 ROAS 持续低于企业目标且贡献恶化，重新评估；需考虑归因回补。']],
      zero_orders:[['Paid media + merchandising','投放与商品运营'],['Avoid a permanent keyword decision from this short window; extend observation when orders are sparse.','订单稀疏时延长观察，避免凭短期样本永久否词。']],
      scale:[['Paid media + inventory','投放与库存负责人'],['Pause scaling if stockouts rise or attributed contribution turns negative.','若缺货增加或归因贡献转负，暂停扩量。']],
      data_gap:[['Analytics + data owner','数据分析与数据负责人'],['Do not change budget on a contribution claim until cost and store-sales coverage is reconciled.','成本率与店铺销售覆盖未核对前，不依据贡献判断调整预算。']]
    };
    for(const item of a) {
      const [owner,stop]=metadata[item.kind]||metadata.data_gap;
      item.owner=L(m,...owner);item.stop=L(m,...stop);
    }
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
    for(const item of report.sku) {
      item.variable_cost_rate=econ.has(item.name)?econ.get(item.name):null;
      item.break_even_roas=item.variable_cost_rate!=null && item.variable_cost_rate<1 ? 1/(1-item.variable_cost_rate) : null;
    }
    report.actions=makeActions(report,m);return report;
  }
  function visualDiagnostics(r) {
    const m=r.manifest,c=r.current,p=r.previous,hasPrev=!!m.periods.previous,tr=(en,zh)=>L(m,en,zh);
    const target=Number(m.business_context?.target_roas),hasTarget=Number.isFinite(target)&&target>0;
    const headline=c.contribution==null?tr('Complete cost coverage before a profit decision','补齐成本率后再判断收益'):
      c.contribution<0?tr('Protect contribution before scaling spend','先止住归因贡献亏损，再考虑扩量'):
      hasPrev&&p.contribution!=null&&c.contribution<p.contribution?tr('Find the contribution leak before scaling','先定位贡献下滑，再考虑扩量'):
      tr('Test growth within the operating constraints','在经营约束内测试增长');
    const changeText=hasPrev&&p.contribution!=null&&c.contribution!=null?
      tr(`Estimated attributed contribution moved from ${fmt(p.contribution)} to ${fmt(c.contribution)} ${m.currency}.`,`归因贡献估算从 ${fmt(p.contribution)} 变为 ${fmt(c.contribution)} ${m.currency}。`):
      tr('A like-for-like contribution comparison is unavailable.','当前缺少可比的归因贡献数据。');
    const roasText=hasTarget&&c.roas!=null?
      tr(`Current ROAS ${fmt(c.roas)} vs company target ${fmt(target)}.`,`本期 ROAS ${fmt(c.roas)}，企业目标 ${fmt(target)}。`):
      tr('No comparable company ROAS target is available.','未提供可比的企业 ROAS 目标。');
    const action=r.actions[0];
    const decision=`<section class="decision-panel"><div><span class="panel-kicker">${tr('DECISION BRIEF','决策简报')}</span><h2>${headline}</h2><p>${safe(changeText)} ${safe(roasText)} ${tr('These are attributed metrics, not proof of incremental ad impact.','这些是归因指标，不证明广告的增量效果。')}</p></div><aside><small>${tr('First bounded test','优先进行的小范围测试')}</small><strong>${safe(action.title)}</strong><span>${safe(action.action)}</span></aside></section>`;

    const funnel=[
      {label:tr('Impressions','展示'),key:'impressions',detail:tr('Reach supplied by the ad export','广告导出覆盖的触达')},
      {label:tr('Clicks','点击'),key:'clicks',detail:`CTR ${pct(p.ctr)} → ${pct(c.ctr)}`},
      {label:tr('Attributed orders','归因订单'),key:'orders',detail:`CVR ${pct(p.cvr)} → ${pct(c.cvr)}`}
    ];
    const funnelRows=funnel.map(item=>{
      const prev=p[item.key]||0,now=c[item.key]||0,max=Math.max(prev,now,1),pw=prev/max*100,nw=now/max*100;
      return `<div class="funnel-row"><div class="funnel-label"><strong>${item.label}</strong><small>${safe(item.detail)}</small></div><div class="funnel-bars">${hasPrev?`<div class="bar-line"><span class="bar-name">${tr('Previous','上期')}</span><div class="bar-track"><i class="bar previous" style="width:${pw.toFixed(1)}%"></i></div><b>${fmt(prev,0)}</b></div>`:''}<div class="bar-line"><span class="bar-name">${tr('Current','本期')}</span><div class="bar-track"><i class="bar current" style="width:${nw.toFixed(1)}%"></i></div><b>${fmt(now,0)}</b></div></div></div>`;
    }).join('');
    const driverMax=Math.max(...r.drivers.map(d=>Math.abs(d.value)),0.001);
    const driverRows=r.drivers.length?r.drivers.map(d=>{
      const width=Math.max(3,Math.abs(d.value)/driverMax*45),negative=d.value<0;
      return `<div class="driver-row"><span>${safe(driverLabel(m,d.key))}</span><div class="driver-track"><i class="zero"></i><i class="driver-bar ${negative?'negative':'positive'}" style="width:${width.toFixed(1)}%;${negative?`right:50%`:`left:50%`}"></i></div><b>${d.value>=0?'+':''}${fmt(d.value,3)}</b></div>`;
    }).join(''):`<p class="chart-empty">${tr('Not enough positive denominators to decompose ROAS.','有效分母不足，无法分解 ROAS。')}</p>`;
    const top=r.sku[0],share=top&&c.spend>0?top.current.spend/c.spend:null;
    const focus=top?tr(`${top.name} represents ${pct(share)} of current spend; review it before changing the whole account.`,`${top.name} 占本期花费的 ${pct(share)}；先复核该 SKU，再调整整个账户。`):tr('No SKU spend concentration can be calculated.','无法计算 SKU 花费集中度。');
    const visuals=`<section class="diagnostic-section"><div class="section-heading"><span class="panel-kicker">${tr('MEASUREMENT','指标拆解')}</span><h2>${tr('Follow the signal from reach to return','从触达到回报，逐层定位变化')}</h2><p>${tr('The bars compare each stage within its own scale. They describe co-occurring changes and do not assign causes.','每一级的条形图使用各自刻度；它们展示同期变化，不提供因果归因。')}</p></div><div class="visual-grid"><figure class="chart-card"><figcaption>${tr('Advertising funnel','广告漏斗')}</figcaption>${funnelRows}<p class="chart-foot">${tr('Rates use summed numerators and denominators. The two periods may have attribution lag.','比率先汇总分子和分母再计算；两个周期都可能受到归因回补影响。')}</p></figure><figure class="chart-card"><figcaption>${tr('ROAS identity · log-change components','ROAS 恒等式 · 对数变化分量')}</figcaption>${driverRows}<p class="chart-foot">ROAS = CVR × AOV / CPC. ${tr('Component bars sum to the log change when all terms are positive; this is descriptive, not causal.','当各项均为正值时，分量之和等于 ROAS 的对数变化；它是描述性的，不证明因果。')}</p></figure></div><div class="focus-strip"><strong>${tr('Portfolio focus','组合焦点')}</strong><span>${safe(focus)}</span></div></section>`;

    const skuCards=r.sku.slice(0,8).map(s=>{
      const contribution=s.current.contribution,positive=contribution!=null&&contribution>=0;
      const rate=s.variable_cost_rate,threshold=s.break_even_roas;
      const thresholdText=rate==null?tr('Cost rate missing','缺少成本率'):rate>=1?tr('No finite break-even ROAS','无有限盈亏平衡 ROAS'):fmt(threshold);
      const status=contribution==null?tr('Contribution unavailable','贡献不可计算'):positive?tr('Positive attributed proxy','归因贡献估算为正'):tr('Negative attributed proxy','归因贡献估算为负');
      return `<article class="sku-card ${contribution!=null&&!positive?'is-loss':''}"><div class="sku-top"><h3>${safe(s.name)}</h3><span>${status}</span></div><div class="sku-values"><div><small>${tr('Ad spend','广告花费')}</small><strong>${fmt(s.current.spend)} ${safe(m.currency)}</strong></div><div><small>${tr('Estimated attributed contribution','归因贡献估算')}</small><strong>${fmt(contribution)} ${safe(m.currency)}</strong></div><div><small>${tr('ROAS / break-even proxy','ROAS／盈亏平衡参考')}</small><strong>${fmt(s.current.roas)} / ${thresholdText}</strong></div></div><p>${tr('Break-even proxy uses 1 ÷ (1 − variable cost rate); it excludes fixed costs and does not measure incrementality.','盈亏平衡参考值＝1 ÷ (1－可变成本率)；未计固定成本，也不衡量增量效果。')}</p></article>`;
    }).join('');
    const portfolio=`<section class="portfolio-section"><div class="section-heading"><span class="panel-kicker">${tr('ALLOCATION','资源分配')}</span><h2>${tr('Which SKU deserves the next test?','下一轮先测试哪个 SKU？')}</h2><p>${tr('Use contribution and cost coverage together with ROAS. A high ROAS alone is not a profit decision.','结合归因贡献、成本覆盖率与 ROAS 判断；高 ROAS 本身不是利润结论。')}</p></div><div class="sku-grid">${skuCards||`<p>${tr('No SKU rows were supplied.','未提供 SKU 数据。')}</p>`}</div></section>`;
    return {decision,visuals,portfolio};
  }

  const VISUAL_CSS=`
  :root{--ink:#172d3a;--muted:#516b7a;--line:#dce6e7;--teal:#078574;--coral:#c8664d}
  body{background:#edf3f1;color:var(--ink)}
  header{background:radial-gradient(circle at 85% -20%,#315b63,#142f42 45%,#10263a 85%);padding-top:54px;padding-bottom:54px}
  header h1{font-size:clamp(2rem,3vw,2.9rem);max-width:900px;letter-spacing:-.03em}
  main{max-width:1160px;padding-top:14px}
  section{border-color:var(--line);box-shadow:0 10px 28px #142f4210;padding:28px}
  section h2{letter-spacing:-.02em}
  .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  .kpi{background:#f2f7f6;border:1px solid #e0eae9;min-height:120px}
  .kpi strong{font-size:clamp(1.3rem,2vw,1.75rem);letter-spacing:-.025em}
  .decision-panel{background:#e2f0ec;border:1px solid #b6d8cd;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,.65fr);gap:28px;align-items:stretch}
  .panel-kicker{font-size:.74rem;font-weight:850;letter-spacing:.13em;color:#087e70}
  .decision-panel h2{font-size:clamp(1.5rem,2.3vw,2.2rem);line-height:1.18;margin:9px 0 13px}
  .decision-panel p{max-width:72ch;line-height:1.65;margin:0;color:#385561}
  .decision-panel aside{background:#fff;border-radius:12px;border-left:4px solid var(--teal);padding:18px;display:flex;flex-direction:column;gap:8px}
  .decision-panel aside small{color:var(--muted);font-weight:700}.decision-panel aside strong{font-size:1rem}.decision-panel aside span{font-size:.9rem;line-height:1.55}
  .diagnostic-section,.portfolio-section{background:transparent;border:0;box-shadow:none;padding:12px 0;margin:28px 0}
  .section-heading h2{font-size:1.6rem;margin:6px 0}.section-heading p{color:var(--muted);margin:0 0 18px;max-width:80ch}
  .visual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
  .chart-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:14px;padding:23px;min-width:0;box-shadow:0 9px 24px #142f420d}
  .chart-card figcaption{font-size:1.06rem;font-weight:800;margin-bottom:17px}
  .funnel-row{padding:10px 0;border-bottom:1px solid #e8eeee}.funnel-label{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}.funnel-label small{color:var(--muted);text-align:right}
  .bar-line{display:grid;grid-template-columns:64px 1fr 62px;gap:9px;align-items:center;margin:5px 0}.bar-name{font-size:.73rem;color:var(--muted)}.bar-line b{text-align:right;font-size:.76rem}
  .bar-track{height:9px;background:#e7eeed;border-radius:9px;overflow:hidden}.bar{display:block;height:100%;border-radius:9px}.bar.previous{background:#9db8bd}.bar.current{background:#087f70}
  .driver-row{display:grid;grid-template-columns:150px 1fr 54px;gap:8px;align-items:center;margin:22px 0;font-size:.84rem}.driver-row b{text-align:right}
  .driver-track{height:18px;position:relative;background:#eef3f2;border-radius:5px}.driver-track .zero{position:absolute;left:50%;top:-4px;height:26px;border-left:1px solid #708c92}.driver-bar{position:absolute;top:2px;height:14px;border-radius:3px}.driver-bar.negative{background:#ca6b53}.driver-bar.positive{background:#078574}
  .chart-foot{font-size:.8rem;color:var(--muted);line-height:1.55;margin:17px 0 0}.chart-empty{color:var(--muted);font-size:.86rem}
  .focus-strip{display:flex;gap:12px;align-items:baseline;padding:16px 19px;margin-top:15px;border-radius:11px;background:#e4f0ed;color:#214a4b}.focus-strip strong{white-space:nowrap}
  .sku-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  .sku-card{background:#fff;border:1px solid var(--line);border-top:4px solid var(--teal);border-radius:13px;padding:20px;box-shadow:0 8px 24px #142f420d}.sku-card.is-loss{border-top-color:var(--coral)}
  .sku-top{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.sku-top h3{font-size:1.12rem;margin:0}.sku-top span{font-size:.78rem;font-weight:750;color:var(--muted)}
  .sku-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:17px 0}.sku-values div{background:#f3f7f6;border-radius:8px;padding:11px}.sku-values small{display:block;color:var(--muted);font-size:.72rem;line-height:1.35}.sku-values strong{display:block;margin-top:6px;font-size:.98rem;line-height:1.3}.sku-card p{color:var(--muted);font-size:.79rem;line-height:1.5;margin:0}
  @media(max-width:850px){.decision-panel,.visual-grid{grid-template-columns:1fr}.sku-grid{grid-template-columns:1fr}}
  @media(max-width:620px){header{padding:34px 20px}section{padding:22px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.driver-row{grid-template-columns:115px 1fr 50px}.funnel-label{display:block}.funnel-label small{text-align:left;display:block}.focus-strip{display:block}.sku-values{grid-template-columns:1fr}}
  `;
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
    const actions=r.actions.map((a,i)=>`<article class="action"><div><b>${i+1}. ${safe(a.title)}</b><em>${safe(a.priority==='high'?tr('High priority','高优先级'):tr('Medium priority','中优先级'))}</em></div><p><strong>${tr('Evidence','证据')}:</strong> ${safe(a.evidence)}</p><p><strong>${tr('Action','建议')}:</strong> ${safe(a.action)}</p><p><strong>${tr('Suggested owner','建议负责人')}:</strong> ${safe(a.owner)}</p><p><strong>${tr('Verify','验证')}:</strong> ${safe(a.verify)}</p><p><strong>${tr('Stop / reconsider','停止或复议条件')}:</strong> ${safe(a.stop)}</p></article>`).join('');
    const quality=r.quality.length?r.quality.map(x=>`<li>${safe(x)}</li>`).join(''):`<li>${tr('No material calculation gaps detected.','未发现会影响本报告计算的明显缺口。')}</li>`;
    const drivers=r.drivers.length?tr(`ROAS log-change decomposition: ${r.drivers.map(d=>`${driverLabel(m,d.key)} ${d.value>=0?'+':''}${fmt(d.value,3)}`).join('; ')}. Components sum to the log change in ROAS; this is descriptive, not causal.`,`ROAS 的对数变化分解：${r.drivers.map(d=>`${driverLabel(m,d.key)} ${d.value>=0?'+':''}${fmt(d.value,3)}`).join('；')}。三项相加对应 ROAS 的对数变化；这描述指标构成，不证明因果。`):tr('Insufficient data to decompose the ROAS change.','当前数据不足以分解 ROAS 变化。');
    const objective=isZh(m)?m.objective_zh||m.objective:m.objective;
    const attribution=isZh(m)?m.attribution.label_zh||m.attribution.label:m.attribution.label;
    const notes=isZh(m)?m.business_context?.notes_zh||m.business_context?.notes:m.business_context?.notes;
    const platformName=isZh(m)?m.platform_zh||m.platform:m.platform;
    const css=`:root{font-family:system-ui,-apple-system,"Segoe UI","PingFang SC",sans-serif;color:#17212e;background:#f5f7fa}*{box-sizing:border-box}body{margin:0}header{background:#11243a;color:white;padding:38px max(20px,calc((100vw - 1100px)/2))}header h1{margin:6px 0 12px;font-size:30px}header p{margin:4px 0;color:#bfd0e3}main{max-width:1100px;margin:auto;padding:24px 20px 60px}section{background:white;border:1px solid #dce3ec;border-radius:14px;padding:24px;margin:18px 0;box-shadow:0 2px 10px #162a4610}h2{font-size:20px;margin:0 0 18px}h2 small{font-size:12px;color:#60758a;font-weight:400}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.kpi{background:#f4f8fc;border-radius:10px;padding:16px;min-height:105px}.kpi small,.kpi span{display:block;color:#586c80}.kpi strong{display:block;font-size:25px;margin:8px 0}.kpi span{font-size:12px}.action{border-left:4px solid #2779a7;padding:10px 14px;margin:12px 0;background:#f6fafc}.action div{display:flex;justify-content:space-between;gap:10px}.action em{font-style:normal;color:#735200;font-size:12px}.action p{margin:7px 0;line-height:1.6}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px;border-bottom:1px solid #e5eaf0;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{background:#f4f8fc}li{margin:7px 0;line-height:1.5}.note{color:#536578;font-size:14px;line-height:1.6}footer{color:#6b7b8c;font-size:12px;margin-top:24px}@media print{body{background:white}section{break-inside:avoid;box-shadow:none}header{background:white;color:#17212e;padding:12px 20px}header p{color:#536578}}`;
    const visual=visualDiagnostics(r);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(platformName)} ${safe(m.site)} ${tr('Ad Performance Report','广告分析报告')}</title><style>${css}${VISUAL_CSS}</style></head><body><header><p>SHOP AD ANALYSIS · ${safe(platformName)} / ${safe(m.site)}</p><h1>${safe(m.category)} ${tr('Ad Performance Report','店铺广告分析')}</h1><p>${safe(m.periods.current.start)} ${tr('to','至')} ${safe(m.periods.current.end)} · ${safe(m.currency)} · ${safe(m.timezone)}</p><p>${tr('Business goal','业务目标')}: ${safe(objective||tr('Not provided','未提供'))} · ${tr('Attribution','归因口径')}: ${safe(attribution)}</p></header><main>${visual.decision}<section><h2>${tr('Executive summary','管理摘要')}</h2><div class="grid">${cell(tr('Ad spend','广告花费'),fmt(c.spend)+' '+m.currency,delta('spend'))}${cell(tr('Attributed ad sales','广告归因销售额'),fmt(c.ad_sales)+' '+m.currency,delta('ad_sales'))}${cell('ROAS',fmt(c.roas),delta('roas'))}${cell('ACOS',pct(c.acos),delta('acos'))}${cell('TACOS',pct(c.tacos),c.tacos==null?tr('Store sales missing or incomplete','缺少或不完整的店铺销售额'):delta('tacos'))}${cell(tr('Est. attributed contribution','归因贡献估算'),c.contribution==null?'—':fmt(c.contribution)+' '+m.currency,c.contribution==null?tr('Some SKU cost rates are missing','缺少部分 SKU 成本率'):delta('contribution'))}</div><p class="note">${safe(drivers)}</p></section>${visual.visuals}${visual.portfolio}<section><h2>${tr('Recommended actions','建议行动')}</h2>${actions}</section>${table(tr('Campaigns','广告活动'),r.campaign)}${table(tr('Products / SKUs','商品 SKU'),r.sku)}${table(tr('Keywords','关键词'),r.keyword)}<section><h2>${tr('Data quality and scope','数据质量与范围')}</h2><p class="note">${tr('Rows read','读取行数')}: ${r.source_counts.ads} ${tr('ads','广告')}, ${r.source_counts.store} ${tr('store','店铺')}; ${r.source_counts.economics} ${tr('SKU cost rates','个 SKU 成本率')}. ${tr('Comparison period','对比周期')}: ${hasPrev?safe(m.periods.previous.start)+' '+tr('to','至')+' '+safe(m.periods.previous.end):tr('Not provided','未提供')}.</p><p class="note">${tr('Company context','企业背景')}: ${safe(notes||tr('Not provided','未提供'))}; ${tr('Target ROAS','目标 ROAS')}: ${m.business_context?.target_roas==null?tr('Not provided','未提供'):fmt(Number(m.business_context.target_roas))}.</p><ul>${quality}</ul></section><section><h2>${tr('Definitions and limits','口径说明')}</h2><p class="note">${tr('CTR = clicks / impressions; CPC = spend / clicks; CVR = attributed orders / clicks; ROAS = attributed sales / spend; ACOS = spend / attributed sales; TACOS = ad spend / same-period store sales. Ratios are calculated after summing their numerators and denominators. A zero denominator displays “—”.','CTR=点击/展示；CPC=花费/点击；CVR=归因订单/点击；ROAS=归因销售额/花费；ACOS=花费/归因销售额；TACOS=广告花费/同期店铺销售额。所有比率先汇总分子与分母，再计算。分母为零显示“—”。')}</p><p class="note">${tr('Estimated attributed contribution = attributed sales × (1 − SKU variable cost rate) − ad spend. It is shown only when all advertised SKUs have a cost rate. It is neither audited net profit nor proof of incremental ad impact. Review inventory, competition, price, and attribution lag before acting.','归因贡献估算=广告归因销售额×(1−SKU 可变成本率)−广告花费，仅在全部广告 SKU 均有成本率时计算。它不是财务净利润，也不代表广告增量收益。建议须结合库存、竞争、价格和归因回补复核。')}</p></section><footer>${tr('Generated by Shop Ad Analysis · Based only on supplied files; no external benchmark was used.','由 Shop Ad Analysis 生成 · 报告数据仅来自提供的文件，未查询外部基准。')}</footer></main></body></html>`;
  }
  const api={parseCsv,analyze,renderHtml};root.ShopAdAnalysis=api;if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
