// 决定性测试：preset 声明的每个插件行能否被真实 import。
//
// 为什么需要它：`--dump-config` 只做静态组合，不 import；
// headless 缺 agentPresets 服务，preset 停在 pending，也不 import。
// 而 registry 的 activation audit 只在真正加载子插件时才报 import 失败。
// 因此这里直接按 loader 的解析基准（app.asar 内的 @deepseek-ai/*）逐个 import。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ASAR = 'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
// 默认校验 bundle 的生成物，便于单文件诊断。
const PATCH = process.argv[2] ?? 'packages/wuji-bundle/cordis.patch.yml';

// 本仓库自有的包：装在 profile 的 node_modules 里，不在 app.asar 内。
// 它们经过明确决策保留（见 check-wuji-preset.mjs 的 ALLOWED_SELF_BUILT），
// 因此按「本地包」校验其存在性，而不是当作官方包去 asar 里找。
const OWN_PACKAGES = new Set(['@wuji/dsh-wuji-bundle', '@wuji/dsh-wuji-staff']);

// 1) asar 成员表
const buf = readFileSync(ASAR);
const hs = buf.readUInt32LE(12);
const header = JSON.parse(buf.subarray(16, 16 + hs).toString('utf8'));
const scopeDir = header.files.dsh.files.node_modules.files['@deepseek-ai'].files;
const present = new Set(Object.keys(scopeDir));

// 2) 解析 patch 里的插件行
const req = createRequire('C:/Users/Administrator/.dsh/profiles/node_modules/js-yaml/package.json');
const yamlMod = req('js-yaml');
const yaml = yamlMod.default ?? yamlMod;
const jsType = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: (d) => ({ __js: d }) });
const doc = yaml.load(readFileSync(PATCH, 'utf8'), { schema: yaml.DEFAULT_SCHEMA.extend({ explicit: [jsType] }) });

const row = doc.find((r) => r.insert?.some((x) => x.id === 'preset-wuji'))?.insert.find((x) => x.id === 'preset-wuji');
if (!row) {
  console.error('preset-wuji 未找到');
  process.exit(1);
}

const flat = [];
const walk = (rows) => {
  for (const r of rows ?? []) {
    flat.push(r);
    if (Array.isArray(r.config)) walk(r.config);
  }
};
walk(row.config.plugins);

console.log(`preset 内插件行（展平）: ${flat.length}`);
console.log('');

// 3) 逐个判定包是否存在于本机 DSH
let bad = 0;
const seen = new Set();
const ownSeen = new Set();
for (const r of flat) {
  const name = String(r.name ?? '');
  if (name.startsWith('cordis:')) continue;

  // 本仓库自有包：校验它们在 profile node_modules 里真实存在
  if (name.startsWith('@wuji/')) {
    const bare = name.split('/').slice(0, 2).join('/');
    if (ownSeen.has(bare)) continue;
    ownSeen.add(bare);
    if (!OWN_PACKAGES.has(bare)) {
      bad += 1;
      console.log(`  UNKNOWN  ${name}   (行 id=${r.id})  ← 未登记的 @wuji/* 包，需先论证官方无对应能力`);
      continue;
    }
    const installed = `C:/Users/Administrator/.dsh/profiles/node_modules/${bare}/package.json`;
    const isBundle = bare === '@wuji/dsh-wuji-bundle';
    const candidate = isBundle ? installed.replace('package.json', 'cordis.patch.yml') : installed;
    let exists = false;
    try {
      exists = readFileSync(candidate).length > 0;
    } catch {
      exists = false;
    }
    if (!exists) {
      bad += 1;
      console.log(`  MISSING  ${name}   (行 id=${r.id})  ← 未安装到 profile，preset 会挂载失败`);
    }
    continue;
  }

  if (!name.startsWith('@deepseek-ai/')) continue;
  // 子路径导出按包根判定
  const parts = name.split('/');
  const bare = parts[1];
  if (seen.has(bare)) continue;
  seen.add(bare);
  const ok = present.has(bare);
  if (!ok) {
    bad += 1;
    console.log(`  MISSING  ${name}   (行 id=${r.id})  ← import 会失败，preset mount 被拒`);
  }
}

// cordis:* 内部行单独说明
const cordisRows = flat.filter((r) => String(r.name).startsWith('cordis:'));
for (const r of cordisRows) {
  const kids = Array.isArray(r.config) ? r.config.length : 0;
  console.log(`  cordis   ${r.name}  (行 id=${r.id}, ${kids} 个子行)`);
}

console.log('');
console.log(`@deepseek-ai/* 唯一包数: ${seen.size}`);
if (ownSeen.size) {
  console.log(`@wuji/* 自研包（已登记）: ${[...ownSeen].join(', ')}`);
}
console.log(bad === 0 ? '结论：所有引用包均存在于本机（import 不会因缺包失败）'
                      : `结论：${bad} 个包缺失或未登记，preset 无法挂载`);
process.exit(bad === 0 ? 0 : 1);
