import { readFileSync } from 'node:fs';

const repo = 'E:/wuji-projects/dsh-wuji-legion-mode';
const raw = readFileSync(repo + '/preset/agent.cordis.yml', 'utf8');

// 找出所有 !!js 表达式，逐条求值
const jsRe = /!!js\s+"((?:[^"\\]|\\.)*)"|!!js\s+(.+)$/gm;
let m;
const found = [];
while ((m = jsRe.exec(raw)) !== null) {
  const expr = m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2].trim();
  found.push(expr);
}

console.log('=== preset 里的 !!js 条件表达式（共 ' + found.length + ' 条）===');
console.log('这些决定了一行到底装没装。之前没展开，所以看不出来。\n');

let i = 0;
for (const expr of found) {
  i++;
  let result, err = null;
  try {
    // 在受限环境下求值，仅支持该 preset 实际用到的表达式
    const fn = new Function('process', 'return (' + expr + ')');
    result = fn(process);
  } catch (e) { err = e.message; }
  const mark = err ? '⚠ 求值失败' : result ? '✅ true → 生效' : '❌ false → 不生效';
  console.log(`  [${i}] ${mark}`);
  console.log(`      ${expr.slice(0, 110)}`);
  if (err) console.log(`      ${err}`);
}
