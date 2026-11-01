import type { Clock } from '../src/core/clock.js';
export function fakeClock(start=0):Clock & {advance(ms:number):void}{ let time=start;return {now:()=>time,advance(ms){time+=ms;}}; }
