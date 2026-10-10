import fs from 'node:fs';
import path from 'node:path';
const ROOT='E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const dirs=fs.readdirSync(ROOT).filter(d=>(d.startsWith('wuji-expert-')||d.startsWith('wuji-leader-'))&&fs.statSync(path.join(ROOT,d)).isDirectory()).sort();
const BAD=[/undefined/i,/NaN/,/\[object Object\]/,/\bTODO\b/,/\bFIXME\b/,/\bXXX\b/,/待补/,/占位符待/,/PLACEHOLDER/i,/\{\{|\}\}/,/lorem ipsum/i,/\bnull\b/,/N\/A/];
console.log('=== RESIDUE SCAN ===');
let hits=0;
for(const d of dirs){
  const p=path.join(ROOT,d,'SKILL.md');
  const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
  lines.forEach((l,i)=>{
    for(const re of BAD){
      if(re.test(l)){
        // filter known-legit mentions
        const legit = /`process` 字段|同一句占位符|占位符（|空词|undefined/.test(l) && /占位符|process/.test(l);
        hits++;
        console.log(`${d}\\SKILL.md:${i+1}  [${re}]  ${l.trim().slice(0,160)}${legit?'   <-- LEGIT CONTEXTUAL':''}`);
        break;
      }
    }
  });
}
console.log('total residue hits:',hits);

console.log('\n=== EMPTY SECTIONS / EMPTY BULLETS ===');
for(const d of dirs){
  const t=fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8');
  const lines=t.split(/\r?\n/);
  lines.forEach((l,i)=>{
    if(/^#{2,3}\s+\S/.test(l)){
      // next non-empty line must not be another heading
      let j=i+1; while(j<lines.length && !lines[j].trim()) j++;
      if(j<lines.length && /^#{2,3}\s+/.test(lines[j]))
        console.log(`${d}\\SKILL.md:${i+1}  EMPTY SECTION "${l.trim()}" followed by "${lines[j].trim()}"`);
    }
    if(/^-\s*$/.test(l)||/^\*\*[^*]+\*\*[：:]\s*$/.test(l))
      console.log(`${d}\\SKILL.md:${i+1}  EMPTY BULLET: ${JSON.stringify(l)}`);
  });
}

console.log('\n=== MARKDOWN TABLE / LIST INTEGRITY ===');
for(const d of dirs){
  const t=fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8');
  const lines=t.split(/\r?\n/);
  // check trailing whitespace-rejoined lines (missing newline artifacts)
  lines.forEach((l,i)=>{ if(/[^\s]\s{0,1}$/.test(l)&&/\)\s*$/.test(l)&&/^[0-9]\./.test(l)) {} });
  // check unclosed code fences
  const fences=(t.match(/^```/gm)||[]).length;
  if(fences%2!==0) console.log(`${d}\\SKILL.md  UNBALANCED CODE FENCES: ${fences}`);
  // check heading levels
  const h1=(t.match(/^#\s+/gm)||[]).length;
  if(h1!==1) console.log(`${d}\\SKILL.md  H1 count = ${h1}`);
}
