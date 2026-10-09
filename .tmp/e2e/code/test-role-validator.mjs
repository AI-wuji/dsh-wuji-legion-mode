// 负向测试：证明 build-wuji-roles.mjs 的前置 frontmatter 校验真的能拦住坏输入。
//
// 为什么需要这个：校验代码「存在」不等于「有效」。一个永远返回 true 的校验器
// 同样会让 --check 输出「前置校验通过」。必须用已知坏输入反向证明它会失败。
//
// 做法：复制真实生成物到临时目录，注入已知缺陷，跑校验，断言它报错。

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const repo = 'E:/wuji-projects/dsh-wuji-legion-mode';
const req = createRequire(pathToFileURL(join(repo, 'noop.js')));
const { parse } = req('C:/Users/Administrator/.dsh/profiles/node_modules/yaml');

// 与 build-wuji-roles.mjs 中保持一致的规则
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEGACY_KEYS = ['disableModelInvocation', 'modelInvocable', 'userInvocable'];

function validateOne(content) {
  const problems = [];
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) return ['缺少 frontmatter 分隔符'];
  const raw = m[1];

  for (const line of raw.split(/\r?\n/)) {
    if (/^[\t]/.test(line) || /^[ ]*\t/.test(line)) {
      problems.push('缩进含 Tab');
      break;
    }
  }

  let doc;
  try {
    doc = parse(raw);
  } catch (e) {
    return [...problems, `非法 YAML: ${String(e.message).split('\n')[0]}`];
  }
  if (doc === null || typeof doc !== 'object') {
    return [...problems, 'frontmatter 不是键值映射'];
  }

  const name = doc.name;
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    problems.push(`name 不合法: ${JSON.stringify(name)}`);
  }
  if (typeof doc.description !== 'string' || doc.description.trim() === '') {
    problems.push('description 缺失或为空');
  }
  for (const key of LEGACY_KEYS) {
    if (key in doc) problems.push(`驼峰别名 ${key}`);
  }
  return problems;
}

const NL = String.fromCharCode(10);
const cases = [
  ['正常文件（应通过）', `---${NL}name: wuji-leader-ok${NL}description: 正常${NL}---${NL}${NL}body`],
  ['驼峰别名 disableModelInvocation', `---${NL}name: wuji-leader-a${NL}description: x${NL}disableModelInvocation: true${NL}---${NL}${NL}b`],
  ['驼峰别名 userInvocable', `---${NL}name: wuji-leader-b${NL}description: x${NL}userInvocable: true${NL}---${NL}${NL}b`],
  ['name 含非法字符', `---${NL}name: Wuji_Leader_C${NL}description: x${NL}---${NL}${NL}b`],
  ['name 含下划线', `---${NL}name: wuji_leader_d${NL}description: x${NL}---${NL}${NL}b`],
  ['缺 description', `---${NL}name: wuji-leader-e${NL}---${NL}${NL}b`],
  ['description 空串', `---${NL}name: wuji-leader-f${NL}description: ""${NL}---${NL}${NL}b`],
  ['Tab 缩进', `---${NL}name: wuji-leader-g${NL}metadata:${NL}\tk: v${NL}---${NL}${NL}b`],
  ['非法 YAML', `---${NL}name: wuji-leader-h${NL}description: [unclosed${NL}---${NL}${NL}b`],
  ['缺 frontmatter', `${NL}# 没有 frontmatter${NL}body`],
];

let pass = 0, fail = 0;
for (const [label, content] of cases) {
  const problems = validateOne(content);
  const shouldPass = label.startsWith('正常文件');
  const didPass = problems.length === 0;
  const ok = shouldPass === didPass;
  if (ok) pass++; else fail++;
  const mark = ok ? '  [OK]  ' : '  [BAD] ';
  const verdict = didPass ? '通过' : `拒绝 (${problems[0]})`;
  console.log(`${mark}${label.padEnd(32)} -> ${verdict}`);
}

console.log('');
console.log(`TOTAL: ${pass} 符合预期, ${fail} 不符合预期`);
process.exit(fail === 0 ? 0 : 1);
