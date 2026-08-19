// Wuji Legion · 技能注册宿主插件
// 注册随包携带的能力目录；不依赖外部环境变量。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const registryPath = fileURLToPath(new URL('./capability-registry.json', import.meta.url));

function skillContent(cap) {
  return [
    `# ${cap.id}`,
    '',
    `归属：${cap.commander}（${cap.domain}）`,
    `适用触发：${cap.triggers.join('、')}`,
    `实际入口：${cap.entrypoint}`,
    `生命周期：${cap.lifecycle}`,
    `回退：${cap.fallback}`,
    '',
    '这是无极军团能力目录项。命中后由参谋部/主帅选择实际已安装能力执行；本目录项本身不伪装成已执行能力。',
  ].join('\n');
}

export default {
  name: 'wuji-skill-registry',
  apply(ctx) {
    let registry = { capabilities: [] };
    try {
      registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    } catch (e) {
      console.error('[wuji] capability registry load failed:', e.message);
    }
    for (const cap of registry.capabilities || []) {
      ctx.skills.register({
        name: cap.id,
        description: `${cap.domain} · ${cap.commander} · ${cap.triggers.join('/')}`,
        whenToUse: `当用户需求命中：${cap.triggers.join('、')} 时使用。`,
        content: skillContent(cap),
        source: 'custom',
        metadata: {
          domain: cap.domain,
          commander: cap.commander,
          entrypoint: cap.entrypoint,
          lifecycle: cap.lifecycle,
          verify: cap.verify,
          fallback: cap.fallback,
        },
      });
    }
  },
};
