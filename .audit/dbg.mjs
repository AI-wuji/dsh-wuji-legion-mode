import fs from 'node:fs';
import path from 'node:path';
const ROOT='E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const experts=fs.readdirSync(ROOT).filter(d=>d.startsWith('wuji-expert-')&&fs.statSync(path.join(ROOT,d)).isDirectory()).sort();
function split(text){const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);return m?text.slice(m[0].length):text;}
function section(body,re){
  const lines=body.split(/\r?\n/); let s=-1,e=lines.length;
  for(let i=0;i<lines.length;i++){
    if(/^##\s+/.test(lines[i])){ if(re.test(lines[i])){s=i;} else if(s>=0){e=i;break;} }
  }
  return s<0?null:lines.slice(s+1,e).join('\n').trim();
}
const a=fs.readFileSync(path.join(ROOT,'wuji-expert-ai-workflow-engineer','SKILL.md'),'utf8');
const b=fs.readFileSync(path.join(ROOT,'wuji-expert-code-review','SKILL.md'),'utf8');
const A=split(a),B=split(b);
for(const [name,re] of [['resp',/我负责/],['inp',/输入契约/],['out',/^##\s+输出\s*$/],['team',/在团队中的职责/]]){
  const ra=section(A,re), rb=section(B,re);
  console.log('---',name,'---');
  console.log('LEN a=',ra?ra.length:'NULL',' b=',rb?rb.length:'NULL');
}
console.log('\nFULL A:');
console.log(A);
