import fs from 'node:fs';
import path from 'node:path';
const ROOT='E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const P3='E:\\wuji-projects\\wuji-legion-codex-4.0\\catalog\\p3';
const dm=JSON.parse(fs.readFileSync(P3+'\\delegation-manifest.json','utf8'));
console.log('manifest top keys:',Object.keys(dm));
// find recipes
function findRecipes(o,depth=0){
  if(depth>3||!o||typeof o!=='object')return [];
  if(Array.isArray(o))return o.flatMap(x=>findRecipes(x,depth+1));
  let r=[];
  for(const [k,v] of Object.entries(o)){ if(/recipe/i.test(k)) r.push([k,v]); r=r.concat(findRecipes(v,depth+1)); }
  return r;
}
console.log('recipe-ish keys:',findRecipes(dm).map(([k])=>k).slice(0,10));
// try to locate arrays
for(const [k,v] of Object.entries(dm)){
  if(Array.isArray(v)) console.log(`  ${k}: array len=${v.length}`);
  else if(v&&typeof v==='object') console.log(`  ${k}: object keys=${Object.keys(v).length}`);
  else console.log(`  ${k}: ${JSON.stringify(v)}`);
}
