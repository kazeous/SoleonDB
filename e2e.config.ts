import type {E2EConfig} from 'e2e';
import {web} from '@e2e-dev/web';
export default {tests:'tests/e2e/**/*.e2e.ts',workers:1,targets:[{name:'desktop',engine:web({viewport:{width:1440,height:1000}}),app:{url:'http://127.0.0.1:0',command:{executable:'node',args:['--import','tsx','apps/server/test/browser-server.ts','{port}'],env:{TEST_DATABASE_URL:process.env.TEST_DATABASE_URL??''},log:'.e2e/logs/browser-server.log',startupTimeout:120000}}}],timeout:60000,cache:'off'} satisfies E2EConfig;
