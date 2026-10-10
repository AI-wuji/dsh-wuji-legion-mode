import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const P3 = 'E:\\wuji-projects\\wuji-legion-codex-4.0\\catalog\\p3';
const up = JSON.parse(fs.readFileSync(P3 + '\\experts.json', 'utf8'));
const roles = up.roles;
function fe(r){let v=r.five_elements; if(typeof v==='string'){try{v=JSON.parse(v)}catch{}} return v||{};}
const byBaseline={}; roles.forEach(r=>{if(r.baseline_id) byBaseline[r.baseline_id]=r;});

const experts = fs.readdirSync(ROOT).filter(d=>d.startsWith('wuji-expert-')&&fs.statSync(path.join(ROOT,d)).isDirectory()).sort();

// role_kind / kind consistency
const fm = [];
for (const d of experts) {
  const text = fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const block = m ? m[1] : '';
  const get = (k) => { const mm = new RegExp('^'+k+':\\s*(.*)$','m').exec(block); return mm?mm[1].trim():null; };
  const baseId = d.replace('wuji-expert-','');
  const r = byBaseline[baseId];
  fm.push({ dir:d, baseId, upKind: r?r.kind:null, localRoleKind: get('role_kind'),
            upBaseline: r?r.baseline_id:null, localBaseline: get('baseline_id'),
            upDesignTarget: r?r.design_target:null, localDesignTarget: get('design_target'),
            description: get('description') });
}
let kindMismatch = fm.filter(x=>x.upKind!==x.localRoleKind);
console.log('=== role_kind vs upstream kind mismatches:', kindMismatch.length, '===');
kindMismatch.forEach(x=>console.log(' ', x.dir, '| upstream kind =', x.upKind, '| local role_kind =', x.localRoleKind));

// description claims "（leaf）" / "（workflow）" etc
console.log('\n=== description-type-tag vs upstream kind ===');
let tagBad=[];
for (const x of fm) {
  const m = /（([a-z_]+)）/.exec(x.description||'');
  const tag = m?m[1]:'(none)';
  if (tag !== x.upKind) tagBad.push({dir:x.dir, tag, upKind:x.upKind});
}
console.log('mismatches:', tagBad.length);
tagBad.forEach(x=>console.log(' ', x.dir, '| description tag =', x.tag, '| upstream kind =', x.upKind));

// baseline_id / design_target consistency
console.log('\n=== baseline_id mismatch ===');
fm.filter(x=>x.upBaseline!==x.localBaseline).forEach(x=>console.log(' ',x.dir,x.upBaseline,'vs',x.localBaseline));
console.log('=== design_target mismatch ===');
fm.filter(x=>x.upDesignTarget!==x.localDesignTarget).forEach(x=>console.log(' ',x.dir,x.upDesignTarget,'vs',x.localDesignTarget));

// distribution of local role_kind
const c={}; fm.forEach(x=>c[x.localRoleKind]=(c[x.localRoleKind]||0)+1);
console.log('\nlocal role_kind distribution:', c);
const c2={}; fm.forEach(x=>c2[x.upKind]=(c2[x.upKind]||0)+1);
console.log('upstream kind distribution:  ', c2);
fs.writeFileSync('E:\\wuji-projects\\dsh-wuji-legion-mode\\.audit\\fm.json', JSON.stringify(fm,null,2));
