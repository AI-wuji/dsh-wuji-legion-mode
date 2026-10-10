import fs from 'node:fs';
import path from 'node:path';
const ROOT='E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const P3='E:\\wuji-projects\\wuji-legion-codex-4.0\\catalog\\p3';
const dm=JSON.parse(fs.readFileSync(P3+'\\delegation-manifest.json','utf8'));
const recipes=dm.recipes;
console.log('recipe_count field:',dm.recipe_count,'actual:',recipes.length);
console.log('leader_family_count:',dm.leader_family_count,'actual leader_family_ids:',dm.leader_family_ids.length);

// assignment occurrences
let asg=0, total=0;
function walk(o){ if(Array.isArray(o))return o.forEach(walk); if(o&&typeof o==='object'){for(const[k,v]of Object.entries(o)){ if(k==='assignment'){asg++;} if(k==='members'&&Array.isArray(v)){total+=v.length;} walk(v);} } }
walk(dm);
console.log('assignment key count:',asg);

// members per recipe
let memberCount=0, membersWithAssignment=0;
for(const r of recipes){
  const ms=r.members||r.member_ids||[];
  memberCount+=ms.length;
  for(const m of ms){ if(m&&typeof m==='object'&&'assignment' in m) membersWithAssignment++; }
}
console.log('total member entries:',memberCount,'with assignment:',membersWithAssignment);
console.log('sample recipe:',JSON.stringify(recipes[0],null,2).slice(0,1500));
console.log('\nrecipe ids:',recipes.map(r=>r.recipe_id).join(', '));

// domains & typed_intents diversity
const doms=new Set(), tis=new Set();
recipes.forEach(r=>{(r.domains||[]).forEach(d=>doms.add(d));(r.typed_intents||[]).forEach(t=>tis.add(t));});
console.log('\nrecipe domains count:',doms.size,'typed_intents count:',tis.size);
console.log('domains:',[...doms].sort().join(', '));
console.log('typed_intents:',[...tis].sort().join(', '));
