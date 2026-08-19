import host from '@wuji/dsh-wuji-host';

const projectionKeys = [];
const skills = [];
const tools = [];
const ctx = {
  provide() {},
  inject(deps, fn) {
    const name = deps[0];
    if (name === 'sessionProjections') {
      fn({ sessionProjections: { register(definition) { projectionKeys.push(definition.key); } } });
    } else if (name === 'skills') {
      fn({ skills: { register(skill) { skills.push(skill); } } });
    } else if (name === 'tools') {
      fn({ tools: { register(tool) { tools.push(tool); } } });
    }
  },
};

host.apply(ctx);
console.log(JSON.stringify({
  projectionKeys,
  skillCount: skills.length,
  skillNames: skills.map(x => x.name),
  skillFields: skills[0] ? Object.keys(skills[0]) : [],
}, null, 2));
if (projectionKeys.length !== 6) process.exit(1);
if (skills.length !== 8) process.exit(1);
if (!skills[0].content || !skills[0].source || !skills[0].metadata) process.exit(1);
if (!tools.some(tool => tool.name === 'wuji_staff_plan')) process.exit(1);
if (!tools.some(tool => tool.name === 'wuji_staff_dispatch')) process.exit(1);
if (!tools.some(tool => tool.name === 'wuji_commander_select')) process.exit(1);
if (!tools.some(tool => tool.name === 'wuji_officer_advise')) process.exit(1);
if (!tools.some(tool => tool.name === 'wuji_council_plan')) process.exit(1);
