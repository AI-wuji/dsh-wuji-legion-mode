// Wuji Legion · 各级主帅域内选型（P2）
// 主帅只在域内选择 provider/skill，不做全局调度、不亲自执行。

const DOMAINS = new Set(['content', 'visual', 'development', 'intelligence', 'data', 'security', 'offense-defense', 'evolution']);
const TIERS = new Set(['low', 'mid', 'high']);

export const commanderSelectTool = {
  name: 'wuji_commander_select',
  description: '域主帅选择器：根据任务域、难度和现有 provider 目录选择执行路线；不创建第二个全局调度器。',
  parameters: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: '任务所属域。' },
      difficulty: { type: 'string', enum: ['low', 'mid', 'high'] },
      candidates: { type: 'array', items: { type: 'object' }, description: '参谋部提供的域内候选 provider/skill。' },
    },
    required: ['domain', 'difficulty', 'candidates'],
  },
  output: {
    schema: { type: 'object', properties: { domain: { type: 'string' }, tier: { type: 'string' }, selected: { type: 'object' }, alternatives: { type: 'array' } }, required: ['domain', 'tier', 'selected', 'alternatives'] },
    render(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }]; },
  },
  isConcurrencySafe() { return true; },
  async execute(args) {
    if (!DOMAINS.has(args.domain)) throw new Error(`未知主帅域：${args.domain}`);
    if (!TIERS.has(args.difficulty)) throw new Error(`未知能力档位：${args.difficulty}`);
    const candidates = Array.isArray(args.candidates) ? args.candidates : [];
    if (!candidates.length) throw new Error('主帅选型需要参谋部提供至少一个域内候选');
    const ranked = [...candidates].sort((a, b) => {
      const av = a.tier === args.difficulty ? 0 : 1;
      const bv = b.tier === args.difficulty ? 0 : 1;
      return av - bv || String(a.name || '').localeCompare(String(b.name || ''));
    });
    const [selected, ...alternatives] = ranked;
    return { domain: args.domain, tier: args.difficulty, selected, alternatives };
  },
};

export default commanderSelectTool;
