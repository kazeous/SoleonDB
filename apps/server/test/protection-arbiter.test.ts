import {it,expect} from 'vitest';
import {chooseAction} from '../src/features/protection/arbiter.js';
it('chooses Ban over Kick over the longest Timeout without mutating inputs',()=>{
 const short={kind:'timeout',durationSeconds:60} as const,long={kind:'timeout',durationSeconds:3600} as const;
 expect(chooseAction([short,long])).toEqual(long);expect(chooseAction([long,{kind:'kick'}])).toEqual({kind:'kick'});expect(chooseAction([{kind:'kick'},short,{kind:'ban'}])).toEqual({kind:'ban'});expect(()=>chooseAction([])).toThrow();
});

