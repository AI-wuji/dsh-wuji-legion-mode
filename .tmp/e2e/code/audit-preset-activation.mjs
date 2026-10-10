import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const repo = 'E:/wuji-projects/dsh-wuji-legion-mode';
const req = createRequire(pathToFileURL(repo + '/noop.js'));
const { parse } = req('C:/Users/Administrator/.dsh/profiles/node_modules/yaml');

const preset = repo + '/preset/agent.cordis.yml';
const y = parse(readFileSync(preset, 'utf8'));

// preset 顶层是数组
const rows = Array.isArray(y) ? y : (y.plugins ?? []);
console.log('preset 插件行数:', rows.length);

const enabled = rows.filter((r) => r && r.disabled !== true);
const disabled = rows.filter((r) => r && r.disabled === true);
console.log('启用行:', enabled.length, ' 禁用行:', disabled.length);

console.log('\n=== 启用的行（这些才可能生效）===');
for (const r of enabled) {
  const n = typeof r.name === 'string' ? r.name : '(js expr)';
  console.log('  ', r.id ?? '', '->', n);
}

console.log('\n=== 禁用行（写在那儿但不起作用）===');
for (const r of disabled) {
  console.log('  ', r.id ?? '', '->', typeof r.name === 'string' ? r.name : '(js expr)');
}

// 关键：persona 里提到的能力 vs 实际启用
const flat = JSON.stringify(y);
const mentions = ['goal', 'ralph', 'present', 'workflow', 'wuji_staff_plan', 'wuji_staff_select'];
console.log('\n=== persona 声明 vs preset 是否真装了 ===');
for (const m of mentions) {
  const installed = flat.includes(`"${m}"`) || flat.includes(m);
  console.log('  ', m, installed ? '✅ preset 中有引用' : '❌ preset 中查无');
}
