import { requirementProjection, taskProjection, officerAdviceProjection, memoryProjection, evolutionProjection, telemetryProjection } from '@wuji/dsh-wuji-host';
const units=[requirementProjection,taskProjection,officerAdviceProjection,memoryProjection,evolutionProjection,telemetryProjection];
for(const unit of units){
  const state=unit.init();
  const view=unit.view(state);
  const parsed=unit.schema.safeParse(view);
  if(!parsed.success){console.error('cold restore schema failed',unit.key,parsed.error);process.exit(1)}
  const checkpoint={ver:unit.stateVersion,seq:0,val:structuredClone(state)};
  if(checkpoint.ver!==unit.stateVersion||checkpoint.val===state)process.exit(1);
}
console.log('cold restore projection schemas OK',units.map(x=>x.key).join(','));
