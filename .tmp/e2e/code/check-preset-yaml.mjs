import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const repo = 'E:/wuji-projects/dsh-wuji-legion-mode';
const req = createRequire(pathToFileURL(repo + '/noop.js'));
const { parse } = req('C:/Users/Administrator/.dsh/profiles/node_modules/yaml');

const f = repo + '/preset/agent.cordis.yml';
const y = parse(readFileSync(f, 'utf8'));
console.log('  YAML 解析: 成功');
console.log('  顶层键:', Object.keys(y).join(', '));

// 找到 tool-subagent 行，确认 maxDepth 仍是数字 3
const rows = y.plugins ?? y.rows ?? [];
const flat = JSON.stringify(y);
const numeric = (flat.match(/"maxDepth":3/g) || []).length;
const strVal = (flat.match(/"maxDepth":"provider-managed"/g) || []).length;
console.log('  maxDepth: 3 (数字) 出现', numeric, '处');
console.log('  maxDepth: "provider-managed" (字符串) 出现', strVal, '处');
console.log('  => 数字 3 处数 = 2 为预期；字符串 2 处为已禁用的休眠行');
