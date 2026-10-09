#!/usr/bin/env node
/**
 * oracle.mjs —— 独立评审用的"真值裁判"。
 *
 * 为什么需要它：t2 用自研窄 YAML 解析器；host 实际用的是完整 `yaml` 包
 * (dsh-skill-filesystem/lib/index.js:7 `import { parse } from "yaml"`)。
 * 因此"t2 判 FAIL 但 host yaml.parse 判 OK" = 确凿的假阳性。
 *
 * 本脚本只做两件事（只读，不修改 t2，不修改任何现有文件）：
 *  1) 拿到 host 侧真值解析结果
 *  2) 复用 t2 的判定逻辑（作为被测对象），做差异对比
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// 从 harness 安装位置解析真实 yaml 包
const req = createRequire(
  "C:/Users/Administrator/.dsh/profiles/node_modules/@deepseek-ai/dsh-skill-filesystem/lib/index.js"
);
const YAML = req("yaml");

// 精确复刻 host 的 parseFrontmatter（J:780-805）
function hostParseFrontmatter(raw) {
  const firstLineEnd = raw.indexOf("\n");
  if (firstLineEnd < 0) return { ok: false, why: "no first line" };
  if (raw.slice(0, firstLineEnd).replace(/\r$/, "") !== "---")
    return { ok: false, why: "first line not exactly ---" };
  const start = firstLineEnd + 1;
  // findClosingFrontmatter
  let lineStart = start;
  let closing;
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf("\n", lineStart);
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, "") === "---") {
      closing = { start: lineStart, bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1 };
      break;
    }
    if (nextNewline < 0) return { ok: false, why: "no closing ---" };
    lineStart = nextNewline + 1;
  }
  if (!closing) return { ok: false, why: "no closing ---" };
  let parsed;
  try {
    parsed = YAML.parse(raw.slice(start, closing.start));
  } catch (e) {
    return { ok: false, why: "yaml parse error: " + e.message, yamlError: true };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return { ok: false, why: "not a mapping" };
  return { ok: true, data: parsed };
}

const file = process.argv[2];
const raw = readFileSync(file, "utf8");
const r = hostParseFrontmatter(raw);
if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(r) + "\n");
} else {
  process.stdout.write(
    (r.ok ? "HOST OK\n" + JSON.stringify(r.data, null, 2) : "HOST REJECT: " + r.why) + "\n"
  );
}
