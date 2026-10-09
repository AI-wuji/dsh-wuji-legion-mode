import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const req = createRequire("C:/Users/Administrator/.dsh/profiles/node_modules/@deepseek-ai/dsh-skill-filesystem/lib/index.js");
const YAML = req("yaml");
const raw = readFileSync(process.argv[2], "utf8");
const fl = raw.indexOf("\n");
const start = fl + 1;
let ls = start, closing;
while (ls <= raw.length) {
  const nn = raw.indexOf("\n", ls); const le = nn < 0 ? raw.length : nn;
  if (raw.slice(ls, le).replace(/\r$/,"") === "---") { closing = { start: ls }; break; }
  if (nn < 0) break; ls = nn + 1;
}
const data = YAML.parse(raw.slice(start, closing.start));
// === faithful replay of host J:679-695 order ===
const strField = (d,k) => { const v = d[k]; return typeof v === "string" && v.length > 0 ? v : undefined; };
const name = strField(data,"name"), desc = strField(data,"description");
if (name === undefined || desc === undefined) { console.log("HOST#1 -> ignore: requires name and description"); process.exit(0); }
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) { console.log(`HOST#2 -> ignore: invalid skill name "${name}"`); process.exit(0); }
try {
  for (const [l,c] of [["disableModelInvocation","disable-model-invocation"],["modelInvocable","disable-model-invocation"],["userInvocable","user-invocable"]])
    if (Object.hasOwn(data,l)) throw new Error(`frontmatter field "${l}" is unsupported; use "${c}"`);
  console.log("HOST#3 -> invocation ok");
} catch (e) { console.log("HOST#3 -> ignore: invalid invocation frontmatter: " + e.message); }
