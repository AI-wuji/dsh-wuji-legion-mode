import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const experts = fs.readdirSync(ROOT).filter(d=>d.startsWith('wuji-expert-')&&fs.statSync(path.join(ROOT,d)).isDirectory()).sort();

function split(text){const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);return m?{fm:m[1],body:text.slice(m[0].length)}:{fm:'',body:text};}
function section(body,re){
  const lines=body.split(/\r?\n/); let s=-1,e=lines.length;
  for(let i=0;i<lines.length;i++){
    if(/^##\s+/.test(lines[i])&&re.test(lines[i])){s=i;continue;}
    if(s>=0&&i>s&&/^##\s+/.test(lines[i])){e=i;break;}
  }
  return s<0?null:lines.slice(s+1,e).join('\n').trim();
}
const data={};
for(const d of experts){
  const t=fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8');
  const b=split(t).body;
  data[d]={
    resp: section(b,/^##\s+我负责\s*\/\s*我不负责/),
    inp:  section(b,/^##\s+输入契约/),
    out:  section(b,/^##\s+输出\s*$/),
    flow: section(b,/^##\s+工作流程/),
    team: section(b,/^##\s+在团队中的职责/),
  };
}
const names=Object.keys(data);

function norm(s){return (s||'').replace(/\s+/g,' ').trim();}
function jaccardLines(a,b){
  const A=new Set(a.split(/\r?\n/).map(norm).filter(Boolean));
  const B=new Set(b.split(/\r?\n/).map(norm).filter(Boolean));
  const inter=[...A].filter(x=>B.has(x)).length;
  const uni=new Set([...A,...B]).size;
  return uni?inter/uni:1;
}
function jaccardCharBigram(a,b){
  const bg=s=>{const t=norm(s).replace(/[，。：；、（）—`#>*\-\s]/g,'');const r=[];for(let i=0;i<t.length-1;i++)r.push(t.slice(i,i+2));return new Set(r);};
  const A=bg(a),B=bg(b); const inter=[...A].filter(x=>B.has(x)).length; const uni=new Set([...A,...B]).size; return uni?inter/uni:1;
}

console.log('=== PAIRWISE SIMILARITY on (resp+inp+out) combined, top 20 ===');
const pairs=[];
for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
  const a=names[i],b=names[j];
  const combine=x=>[data[x].resp,data[x].inp,data[x].out].join('\n');
  pairs.push({a,b,line:jaccardLines(combine(a),combine(b)),char:jaccardCharBigram(combine(a),combine(b))});
}
pairs.sort((x,y)=>y.line-x.line);
pairs.slice(0,20).forEach(p=>console.log(`  ${p.line.toFixed(3)} line / ${p.char.toFixed(3)} char  ${p.a}  <->  ${p.b}`));

console.log('\n=== EXACT-EQUALITY check by section ===');
for(const key of ['resp','inp','out','flow','team']){
  const groups={};
  names.forEach(n=>{const v=norm(data[n][key]);(groups[v]||=[]).push(n);});
  const dupes=Object.entries(groups).filter(([,v])=>v.length>1);
  console.log(` [${key}] distinct=${Object.keys(groups).length}/57  duplicate-groups=${dupes.length}`);
  dupes.forEach(([v,arr])=>console.log('    DUP',arr.join(', '),'::',v.slice(0,140)));
}

// field-level: extract 我负责 content only (the bold line)
console.log('\n=== "我负责" FIRST-LINE equality ===');
const g2={};
names.forEach(n=>{const m=/\*\*我负责\*\*[：:]\s*(.*?)(?:\n|$)/.exec(data[n].resp||'');g2[(m?m[1]:'').trim()]=(g2[(m?m[1]:'').trim()]||[]).concat(n);});
console.log('distinct 我负责 values:', Object.keys(g2).length);
Object.entries(g2).filter(([,v])=>v.length>1).forEach(([k,v])=>console.log('  DUP:',v.join(','),'::',k));
fs.writeFileSync('E:\\wuji-projects\\dsh-wuji-legion-mode\\.audit\\sim.json',JSON.stringify({pairs:pairs.slice(0,40)},null,2));
