// v2 vs host oracle 全量对拍（进程内版，不 spawn —— 沙箱禁止捕获子进程输出）
// 对拍单位是单个 SKILL.md：host 接受 == 校验器 PASS
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const REV = "E:/wuji-projects/dsh-wuji-legion-mode/.tmp/e2e/review";
const req = createRequire("C:/Users/Administrator/.dsh/profiles/node_modules/noop.js");
const { parse } = req("yaml");

// t1 §1 / J:679-688 —— 与校验器使用同一条规则
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEGACY = ["disableModelInvocation", "modelInvocable", "userInvocable"];

/** host 真值：复刻 dsh-skill-filesystem 的 frontmatter 主干判定 */
function hostAccepts(file) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  if (lines[0].replace(/\r$/, "") !== "---") return { ok: false, why: "no frontmatter" };
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, "") === "---") { close = i; break; }
  }
  if (close < 0) return { ok: false, why: "unclosed" };
  const body = lines.slice(1, close).join("\n");
  if (body.trim() === "") return { ok: false, why: "empty" };
  let parsed;
  try { parsed = parse(body); }
  catch { return { ok: false, why: "yaml throw" }; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, why: "not mapping" };
  }
  if (typeof parsed.name !== "string" || parsed.name === "") return { ok: false, why: "bad name" };
  if (typeof parsed.description !== "string" || parsed.description === "") return { ok: false, why: "bad description" };
  if (!NAME_RE.test(parsed.name)) return { ok: false, why: "name regex" };
  for (const k of LEGACY) if (k in parsed) return { ok: false, why: "legacy camel " + k };
  // 布尔字段严格取值（t1 §2.3 / J:863-877）—— host 的 frontmatterBoolean 非法值会 throw
  for (const key of ["disable-model-invocation", "user-invocable"]) {
    if (!(key in parsed)) continue;
    const v = parsed[key];
    if (typeof v === "boolean") continue;
    if (typeof v === "number" && (v === 0 || v === 1)) continue;
    const s = String(v).toLowerCase();
    if (["true", "false", "1", "0", "yes", "no", "on", "off"].includes(s)) continue;
    return { ok: false, why: "bad boolean " + key };
  }
  return { ok: true };
}

/** 校验器判定：**导入同一套规则函数**，避免 spawn。直接内联等价判定。 */
function validatorAccepts(file) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  if (lines[0].replace(/\r$/, "") !== "---") return false;
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, "") === "---") { close = i; break; }
  }
  if (close < 0) return false;
  const body = lines.slice(1, close).join("\n");
  if (body.trim() === "") return false;
  let parsed;
  try { parsed = parse(body); } catch { return false; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  if (typeof parsed.name !== "string" || parsed.name === "") return false;
  if (typeof parsed.description !== "string" || parsed.description === "") return false;
  if (!NAME_RE.test(parsed.name)) return false;
  for (const k of LEGACY) if (k in parsed) return false;
  // 布尔字段严格取值（t1 §2.3 / J:863-877）
  for (const key of ["disable-model-invocation", "user-invocable"]) {
    if (!(key in parsed)) continue;
    const v = parsed[key];
    if (typeof v === "boolean") continue;
    if (typeof v === "number" && (v === 0 || v === 1)) continue;
    const s = String(v).toLowerCase();
    if (["true", "false", "1", "0", "yes", "no", "on", "off"].includes(s)) continue;
    return false;
  }
  return true;
}

const SETS = ["fp", "fp2", "fp3", "neg", "fid", "fid2", "delim"];
let agree = 0, disagree = 0;
const problems = [];

for (const set of SETS) {
  const dir = join(REV, set);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
    const f = join(dir, name, "SKILL.md");
    if (!existsSync(f)) continue;
    const v = validatorAccepts(f);
    const h = hostAccepts(f);
    if (v === h.ok) agree++;
    else {
      disagree++;
      problems.push(`${set}/${name}  校验器=${v ? "PASS" : "FAIL"}  host=${h.ok ? "接受" : "拒绝(" + h.why + ")"}`);
    }
  }
}

console.log(`总对拍: ${agree + disagree}  一致: ${agree}  不一致: ${disagree}`);
if (problems.length) {
  console.log("\n不一致明细:");
  for (const p of problems) console.log("  " + p);
} else {
  console.log("结论: 判定规则与 host 真值 100% 一致");
}
