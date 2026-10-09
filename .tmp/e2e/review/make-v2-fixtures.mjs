// v2 修订验证：用 t3 发现的原始缺陷逐条复现，确认修复
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const P = "E:/wuji-projects/dsh-wuji-legion-mode/.tmp/e2e/review/v2check";
const req = createRequire("C:/Users/Administrator/.dsh/profiles/node_modules/noop.js");
const { parse } = req("yaml");

const fixtures = {
  // D1 —— 引号内逗号（合法，v1 曾误判 FAIL）
  "d1-comma-in-array": '---\nname: d1-comma-in-array\ndescription: minimal repro\nmetadata:\n  tags: ["a,b"]\n---\n',
  // D2 —— 块状序列（合法，v1 曾误判 FAIL）
  "d2-block-seq": '---\nname: d2-block-seq\ndescription: seq value\nmetadata:\n  tags:\n    - alpha\n    - beta\n---\n',
  // D3 —— Tab 缩进（非法，v1 曾误判 PASS；host 抛错）
  "d3-tab-indent": '---\nname: d3-tab-indent\ndescription: tab indent test\nmetadata:\n\ttags: [a]\n---\n',
  // D4 —— 锚点（合法，v1 曾误判 FAIL）
  "d4-anchor": '---\nname: d4-anchor\ndescription: anchor test\nmetadata: &m\n  a: 1\n---\n',
  // 对照 —— 完全普通的合法 skill，必须 PASS
  "ok-normal": '---\nname: ok-normal\ndescription: normal\n---\n',
};

for (const [name, text] of Object.entries(fixtures)) {
  mkdirSync(`${P}/${name}`, { recursive: true });
  writeFileSync(`${P}/${name}/SKILL.md`, text);
}

// host 真值对照
console.log("=== host (yaml 包) 真实行为 ===");
const expect = {};
for (const [name] of Object.entries(fixtures)) {
  const t = readFileSync(`${P}/${name}/SKILL.md`, "utf8");
  const L = t.split("\n");
  const c = L.findIndex((l, i) => i > 0 && l.replace(/\r$/, "") === "---");
  try {
    parse(L.slice(1, c).join("\n"));
    expect[name] = "OK";
  } catch (e) {
    expect[name] = "THROW: " + e.message.split("\n")[0];
  }
  console.log(`  ${name.padEnd(18)} ${expect[name]}`);
}
console.log(JSON.stringify(expect, null, 2));
console.log("written:", P);
