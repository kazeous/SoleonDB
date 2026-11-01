export interface Clock { now():number }
export function createClock():Clock { return {now:()=>Date.now()}; }

