import {chooseVisionRoute,makeVisionContract} from '@wuji/dsh-wuji-host';
let r=chooseVisionRoute({provider:'gpt',model:'gpt-5.6-sol',inputModalities:['text','image']},{enabled:true,provider:'local',model:'vision'});if(r.mode!=='native')process.exit(1);
r=chooseVisionRoute({provider:'deepseek',model:'text',inputModalities:['text']},{enabled:true,provider:'local',model:'vision'});if(r.mode!=='fallback')process.exit(1);
r=chooseVisionRoute({inputModalities:['text']},{enabled:false});if(r.mode!=='unsupported')process.exit(1);const c=makeVisionContract(r);if(c.output.format!=='structured-json'||c.privacy.localPreferred!==true)process.exit(1);console.log('vision routing test OK');
