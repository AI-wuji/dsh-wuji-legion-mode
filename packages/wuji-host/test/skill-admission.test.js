import { admitCapability } from '@wuji/dsh-wuji-host/skill-registry';
if (admitCapability({ lifecycle: 'callable', entrypoint: 'skill:x' }).admitted) process.exit(1);
if (admitCapability({ lifecycle: 'behavior-verified', entrypoint: 'plugin:x' }).admitted) process.exit(1);
if (!admitCapability({ lifecycle: 'behavior-verified', entrypoint: 'skill:x' }).admitted) process.exit(1);
if (admitCapability({ lifecycle: 'primary', platforms: ['linux'], entrypoint: 'skill:x' }, { platform: 'win32' }).admitted) process.exit(1);
console.log('skill admission test OK');
