import {it,expect} from 'vitest';
import {registerPruning} from '../src/db/pruning.js';
it('runs bounded pruning only when the scheduler invokes it and unregisters cleanly',async()=>{
  let job:(()=>Promise<void>)|undefined;let calls=0;let stopped=false;
  const stop=registerPruning({register(_name,interval,run){expect(interval).toBe(60000);job=run;return ()=>{stopped=true;};}},[async limit=>{expect(limit).toBe(1000);calls++;}]);
  expect(calls).toBe(0);await job!();expect(calls).toBe(1);stop();expect(stopped).toBe(true);
});
