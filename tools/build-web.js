'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const skill = path.join(root, 'skills/shop-ad-analysis');
const demo = path.join(root, 'examples/demo');
const engine = fs.readFileSync(path.join(skill, 'scripts/engine.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const sample = {
  manifest: JSON.parse(fs.readFileSync(path.join(demo, 'manifest.json'), 'utf8')),
  ads: fs.readFileSync(path.join(demo, 'ads.csv'), 'utf8'),
  store: fs.readFileSync(path.join(demo, 'store.csv'), 'utf8'),
  economics: fs.readFileSync(path.join(demo, 'economics.csv'), 'utf8')
};
const sampleJson = JSON.stringify(sample).replace(/</g, '\\u003c');
const template = fs.readFileSync(path.join(root, 'tools/ad-analysis.template.html'), 'utf8');
if (!template.includes('/*__ENGINE__*/') || !template.includes('/*__SAMPLE__*/')) {
  throw new Error('Browser template markers are missing');
}
const html = template
  .replace('/*__ENGINE__*/', engine)
  .replace('/*__SAMPLE__*/', `const sample=${sampleJson};`);
fs.writeFileSync(path.join(root, 'web/ad-analysis.html'), html);
fs.writeFileSync(path.join(skill, 'assets/ad-analysis.html'), html);
console.log('Built bilingual standalone web/ad-analysis.html');
