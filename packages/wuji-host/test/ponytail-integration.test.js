import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import skillRegistryPlugin from '../lib/skill-registry.js';
import { staffDispatchTool, PONYTAIL_WORKER_RULES } from '../lib/staff.js';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const repoDir = fileURLToPath(new URL('../../../', import.meta.url));
const skillRoot = join(repoDir, 'skills');

const core = await readFile(join(skillRoot, 'ponytail', 'SKILL.md'), 'utf8');
for (const rung of ['真的需要', '复用', '平台原生', '标准能力', '已安装', '最小正确']) {
  if (!core.includes(rung)) throw new Error(`PonyTail core missing ladder rung: ${rung}`);
}
for (const boundary of ['授权', '安全', '错误处理', '必要验证', '完成证据']) {
  if (!core.includes(boundary)) throw new Error(`PonyTail core weakened boundary: ${boundary}`);
}

for (const adapter of ['code', 'research', 'writing', 'docs', 'data', 'presentation', 'browser', 'feishu']) {
  const name = adapter === 'research' ? 'ponytail-research' : `ponytail-${adapter}`;
  await readFile(join(skillRoot, name, 'SKILL.md'), 'utf8');
}
for (const helper of ['ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']) {
  const body = await readFile(join(skillRoot, helper, 'SKILL.md'), 'utf8');
  if (!/one-shot|一次性|按需|只读|does not apply|applies nothing/i.test(body)) throw new Error(`${helper} must stay on-demand`);
}

const registry = JSON.parse(await readFile(join(packageDir, 'lib', 'capability-registry.json'), 'utf8'));
const code = registry.capabilities.find(cap => cap.id === 'code-dev');
if (code.entrypoint !== 'ponytail preflight -> native coding / existing skill / staff') throw new Error('code-dev is not PonyTail-led');
if (code.policy?.preflight !== 'required' || code.policy?.defaultIntensity !== 'full') throw new Error('code-dev PonyTail policy missing');
if (registry.ponytailAdapters?.browser !== 'ponytail-browser') throw new Error('domain adapter metadata missing');

const registrations = [];
skillRegistryPlugin.apply({ skills: { register(skill) { registrations.push(skill); } } });
const registeredCode = registrations.find(skill => skill.name === 'code-dev');
if (!registeredCode?.metadata?.ponytailPreflight || registeredCode.metadata.ponytailAdapter !== 'ponytail-code') throw new Error('runtime registry did not expose PonyTail preflight');

const events = [];
let request;
const parent = { session: { append(type, data) { events.push({ type, data }); } }, ctx: { get(name) {
  if (name === 'subagents') return { async start(_provider, value) { request = value; return { childId: 'child-ponytail' }; } };
  return undefined;
} } };
await staffDispatchTool.execute({ task: { taskId: 't-ponytail' }, provider: 'test', prompt: '执行一个原子任务' }, { agent: parent, signal: new AbortController().signal });
if (!request.prompt.startsWith(PONYTAIL_WORKER_RULES) || !request.prompt.endsWith('执行一个原子任务')) throw new Error('worker prompt lacks PonyTail rules');
await staffDispatchTool.execute({ task: { taskId: 't-ponytail-2' }, provider: 'test', prompt: `${PONYTAIL_WORKER_RULES}\n\n已有规则` }, { agent: parent, signal: new AbortController().signal });
if (request.prompt.split('[Wuji PonyTail worker preflight]').length !== 2) throw new Error('worker rules injected twice');
if (events.filter(event => event.data.status === 'running').length !== 2) throw new Error('dispatch status semantics changed');

console.log('PonyTail integration test OK');
