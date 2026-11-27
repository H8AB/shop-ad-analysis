'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.join(root,'skills/shop-ad-analysis'),dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'shop-ad-skill-'));
function pack(name,workbuddy){const folder=path.join(tmp,name,'shop-ad-analysis');fs.mkdirSync(path.dirname(folder),{recursive:true});fs.cpSync(source,folder,{recursive:true});if(workbuddy){const file=path.join(folder,'SKILL.md'),content=fs.readFileSync(file,'utf8');fs.writeFileSync(file,content.replace('name: shop-ad-analysis\n','name: shop-ad-analysis\ndisplay_name: 店铺广告分析\ndisplay_name_zh: 店铺广告分析\ndescription: 看清广告钱花在哪里、哪些商品值得继续投，并给出下一步可验证的调整建议。\ndescription_zh: 看清广告钱花在哪里、哪些商品值得继续投，并给出下一步可验证的调整建议。\ndescription_en: Analyze store advertising and unit economics into an HTML decision report.\nversion: 1.2.1\nauthor: Shop Ad Analysis Contributors\n'));}const archive=path.join(dist,name+'.zip');fs.rmSync(archive,{force:true});cp.execFileSync('zip',['-q','-r',archive,'shop-ad-analysis'],{cwd:path.join(tmp,name)});}
try{pack('shop-ad-analysis-agent',false);pack('shop-ad-analysis-workbuddy',true);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
const files=['dist/shop-ad-analysis-agent.zip','dist/shop-ad-analysis-workbuddy.zip','web/ad-analysis.html','examples/demo/report.html'];
fs.writeFileSync(path.join(root,'SHA256SUMS.txt'),files.map(file=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}  ${file}`).join('\n')+'\n');
console.log('Built dist/shop-ad-analysis-agent.zip and dist/shop-ad-analysis-workbuddy.zip');
