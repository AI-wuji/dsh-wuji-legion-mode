// 校验参谋部工具**最终呈现给模型**的描述与 schema。
//
// 为什么单独做这一步：
//   上一轮参谋部没被调用，根因是描述里写「可能并发执行时调用」—— 这个条件
//   模型判不出边界。**工具注册成功了，不等于它的描述可被理解。**
//   因此这里把注册结果原样打印出来，肉眼确认触发条件是可判定的。
//
// 用法：node scripts/show-staff-tool-surface.mjs
import { pathToFileURL } from 'node:url';

const entry = 'C:/Users/Administrator/.dsh/profiles/node_modules/@wuji/dsh-wuji-staff/lib/index.js';
const mod = await import(pathToFileURL(entry).href);

const registered = [];
await mod.apply({ tools: { register: (t) => registered.push(t) } }, {});

for (const tool of registered) {
  console.log('═'.repeat(72));
  console.log(`工具名: ${tool.name}`);
  console.log('═'.repeat(72));
  console.log();
  console.log('【描述（模型看到的就是这段）】');
  console.log(tool.description);
  console.log();
  console.log('【参数 schema】');
  console.log(JSON.stringify(tool.parameters, null, 2));
  console.log();
  console.log('【output 是否存在且含 render】', Boolean(tool.output?.render));
  console.log();
}

// 断言：触发条件必须含可判定的量化表达，而不是模糊词。
const plan = registered.find((t) => t.name === 'wuji_staff_plan');
const desc = plan?.description ?? '';
const vague = ['可能并发', '复杂任务', '视情况'];
const hit = vague.filter((v) => desc.includes(v));
console.log('─'.repeat(72));
console.log(`模糊措辞检查: ${hit.length === 0 ? '通过（无模糊词）' : `发现 ${hit.join(', ')}`}`);
console.log(`含可判定条件（2 个及以上）: ${/2 个及以上/.test(desc) ? '是' : '否'}`);
console.log(`含「不必调用」的明确边界: ${/不必调用|才不必调用/.test(desc) ? '是' : '否'}`);
process.exit(hit.length === 0 ? 0 : 1);
