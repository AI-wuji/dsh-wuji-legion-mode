import fs from 'node:fs';
import path from 'node:path';
const ROOT='E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const dirs=fs.readdirSync(ROOT).filter(d=>(d.startsWith('wuji-expert-')||d.startsWith('wuji-leader-'))&&fs.statSync(path.join(ROOT,d)).isDirectory()).sort();
let issues=0;
console.log('=== TRUE empty-section / empty-content check ===');
for(const d of dirs){
  const lines=fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8').split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    if(!/^#{2,3}\s+\S/.test(lines[i]))continue;
    let j=i+1;while(j<lines.length&&!lines[j].trim())j++;
    if(j>=lines.length||/^#{1,3}\s+/.test(lines[j])){
      console.log(`${d}\\SKILL.md:${i+1}  EMPTY SECTION: ${lines[i].trim()}`);issues++;
    }
  }
  // true empty bullet: '- ' alone or '- **x**：' with nothing after
  lines.forEach((l,i)=>{
    if(/^-\s+$/.test(l)||/^-\s+\*\*[^*]+\*\*\s*[：:]\s*$/.test(l)){console.log(`${d}\\SKILL.md:${i+1} EMPTY BULLET ${JSON.stringify(l)}`);issues++;}
  });
  // 我不负责 must have >=1 bullet after
  const idx=lines.findIndex(l=>/^\*\*我不负责\*\*/.test(l));
  if(idx>=0){ let k=idx+1;while(k<lines.length&&!lines[k].trim())k++;
    if(!/^-\s/.test(lines[k]||'')){console.log(`${d}\\SKILL.md:${idx+1} 我不负责 has NO bullets (next="${(lines[k]||'').trim()}")`);issues++;} }
  // 我负责 must have value
  const m=/^\*\*我负责\*\*[：:](.*)$/m.exec(lines.join('\n'));
  if(!m||!m[1].trim()){console.log(`${d}\\SKILL.md  我负责 EMPTY`);issues++;}
}
console.log('true issues:',issues);

console.log('\n=== CHECKLIST consistency (6 items claimed) ===');
const counts={};
for(const d of dirs){
  const t=fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8');
  const blk=/##\s+交付前自检清单[\s\S]*?(?=\n##\s|$)/.exec(t);
  const n=blk?(blk[0].match(/^- \[ \]/gm)||[]).length:-1;
  (counts[n]||=[]).push(d);
}
Object.entries(counts).forEach(([k,v])=>console.log(`  items=${k}: ${v.length} files`));

console.log('\n=== 诚实标注 table: does it enumerate all sections? ===');
for(const d of dirs){
  const t=fs.readFileSync(path.join(ROOT,d,'SKILL.md'),'utf8');
  const heads=[...t.matchAll(/^##\s+(.+)$/gm)].map(m=>m[1].trim());
  const tbl=/##\s+诚实标注[\s\S]*?\n(\|[\s\S]*?)\n\n/.exec(t);
  if(!tbl){console.log(`${d} NO 诚实标注 TABLE`);continue;}
  const rows=[...tbl[1].matchAll(/^\|\s*([^|]+?)\s*\|/gm)].map(m=>m[1].trim()).filter(x=>x!=='本节内容'&&!/^-+$/.test(x));
  const missing=heads.filter(h=>h!=='诚实标注'&&!rows.includes(h));
  if(missing.length)console.log(`${d}: sections not in 诚实标注 table -> ${missing.join(' | ')}`);
}
