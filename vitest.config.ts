import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
 resolve:{alias:{'@eousbot/contracts':fileURLToPath(new URL('./packages/contracts/src/index.ts',import.meta.url))}},
 test:{projects:[{extends:true,test:{name:'unit',include:['apps/**/test/**/*.test.ts','apps/**/src/**/*.test.ts'],exclude:['**/*.integration.test.ts'],testTimeout:10000}}]}
});
