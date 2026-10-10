import fs from 'node:fs';
import path from 'node:path';
const ROOT='E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const experts=fs.readdirSync(ROOT).filter(d=>d.startsWith('wuji-expert-')&&fs.statSync(path.join(ROOT,d)).isDirectory()).sort();
function split(text){const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);return m?text.slice(m[0].length):text;}
function section(body,re){
  const lines=body.split(/\r?\n/); let s=-1,e=lines.length;
  for(let i=0;i<lines.length;i++){ if(/^##\s+/.test(lines[i])){ if(re.test(lines[i])){s=i;} else if(s>=0){e=i;break;} } }
  return s<0?null:lines.slice(s+1,e).join('\n').trim();
}
// payload = only lines that carry the role-specific content (drop shared boilerplate)
const BOILER=[
 /^上述输入缺任一项时/,/^\*\*猜测输入不是输入\*\*/,
 /^- \*\*反触发\*\*/,/^- 不属于本职责范围的相邻工作/,
 /^交回主帅时必含/,/^不写教程式内容，不复述通用知识/,
 /^- \*\*权限（通用契约）\*\*/,/^- \*\*取消（通用契约）\*\*/,/^- \*\*白帽\*\*/,/^- \*\*版本\*\*/,/^> /,/^$/,
 /^- `wb-preflight`/,/^- 通用：/,
 /^按框架统一为四步/,/^\d\. \*\*校验输入\*\*/,/^\d\. \*\*回交\*\*/,
];
function payload(sec,keepGoalLike=true){
  if(!sec)return '';
  const out=[];
  for(const l of sec.split(/\r?\n/)){
    const t=l.trim();
    if(!t)continue;
    if(BOILER.some(re=>re.test(t)))continue;
    out.push(t);
  }
  return out.join('\n');
}
const D={};
for(const d of experts){
  const b=split(fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8'));
  D[d]={resp:section(b,/我负责/),inp:section(b,/输入契约/),out:section(b,/^##\s+输出\s*$/),team:section(b,/在团队中的职责/)};
}
// Extract ONLY the discriminating payload: 我负责 value, 必需输入 value, 产物 value
function core(x){
  const m1=/\*\*我负责\*\*[：:]\s*(.+)/.exec(x.resp||'');
  const m2=/\*\*必需输入\*\*[：:]\s*(.+)/.exec(x.inp||'');
  const m3=/\*\*产物\*\*[：:]\s*(.+)/.exec(x.out||'');
  return {goal:(m1?m1[1]:'').trim(),inputs:(m2?m2[1]:'').trim(),output:(m3?m3[1]:'').trim()};
}
const CORE={};
for(const d of experts) CORE[d]=core(D[d]);

console.log('=== CORE payload duplication ===');
for(const k of ['goal','inputs','output']){
  const g={}; experts.forEach(d=>{const v=CORE[d][k];(g[v]||=[]).push(d);});
  const dup=Object.entries(g).filter(([,v])=>v.length>1);
  console.log(`[${k}] distinct=${Object.keys(g).length}/57 dup-groups=${dup.length}`);
  dup.forEach(([v,arr])=>console.log('   DUP:',arr.map(x=>x.replace('wuji-expert-','')).join(','),'::',v));
  // empty values
  const empty=experts.filter(d=>!CORE[d][k]);
  if(empty.length)console.log('   EMPTY:',empty.join(','));
}

// near-duplicate detection on normalized chars (换措辞但同义)
function norm(s){return s.replace(/[\s`（）()、，,：:；;\/\-—]/g,'').toLowerCase();}
console.log('\n=== NEAR-DUPLICATE core payloads (normalized equality) ===');
for(const k of ['goal','inputs','output']){
  const g={}; experts.forEach(d=>{const v=norm(CORE[d][k]);if(v)(g[v]||=[]).push(d);});
  Object.entries(g).filter(([,v])=>v.length>1).forEach(([v,arr])=>console.log(` [${k}]`,arr.map(x=>x.replace('wuji-expert-','')).join(','),'::',v));
}

// combined core similarity
function jac(a,b){const A=new Set(norm(a)),B=new Set(norm(b));const i=[...A].filter(x=>B.has(x)).length;const u=new Set([...A,...B]).size;return u?i/u:1;}
const pairs=[];
for(let i=0;i<experts.length;i++)for(let j=i+1;j<experts.length;j++){
  const a=experts[i],b=experts[j];
  const ka=[CORE[a].goal,CORE[a].inputs,CORE[a].output].join('|');
  const kb=[CORE[b].goal,CORE[b].inputs,CORE[b].output].join('|');
  pairs.push({a:a.replace('wuji-expert-',''),b:b.replace('wuji-expert-',''),s:jac(ka,kb)});
}
pairs.sort((x,y)=>y.s-x.s);
console.log('\n=== top 15 core-similarity pairs ===');
pairs.slice(0,15).forEach(p=>console.log('  ',p.s.toFixed(3),p.a,'<->',p.b));
console.log('\n=== mean/median core similarity ===');
const ss=pairs.map(p=>p.s).sort((a,b)=>a-b);
console.log('mean',(ss.reduce((a,b)=>a+b,0)/ss.length).toFixed(4),'median',ss[ss.length>>1].toFixed(4),'max',ss[ss.length-1].toFixed(4));
