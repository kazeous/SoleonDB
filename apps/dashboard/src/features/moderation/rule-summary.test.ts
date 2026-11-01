import {it,expect} from 'vitest';
import type {RuleInput} from '@eousbot/contracts';
import {summarizeRule} from './rule-summary';
const base:RuleInput={name:'Test',channelId:'111111111111111111',enabled:true,trigger:{kind:'link'},threshold:{count:3,windowSeconds:10},action:{kind:'timeout',durationSeconds:3600},exemptRoleIds:[],exemptUserIds:[]};
it('N=1 says first matching message and keeps cleanup timing explicit',()=>{expect(summarizeRule({...base,threshold:{count:1,windowSeconds:10}},'general')).toMatch(/first matching message.*delete.*Timeout.*1 hour/i);});
it.each(['any','link','photo','mention'] as const)('N>1 describes trigger %s and exact rolling window',kind=>{const trigger=kind==='mention'?{kind,users:true,roles:false,everyone:false}:{kind};const text=summarizeRule({...base,trigger},'general');expect(text).toMatch(/3.*10 seconds.*delete/i);expect(text).toContain('#general');expect(text).toContain({any:'message',link:'link',photo:'photo',mention:'mention'}[kind]);});
it.each(['kick','ban'] as const)('names only the selected %s action',kind=>{expect(summarizeRule({...base,action:{kind}},'general')).toContain(kind==='kick'?'Kick':'Ban');});
it('paused rules do nothing until enabled',()=>{expect(summarizeRule({...base,enabled:false},'general')).toMatch(/paused.*no messages.*punishment/i);});
it.each([[60,'1 minute'],[120,'2 minutes'],[3600,'1 hour'],[86400,'1 day']])('timeout %s seconds uses readable units', (durationSeconds,label)=>{expect(summarizeRule({...base,action:{kind:'timeout',durationSeconds:durationSeconds as number}},'general')).toContain(label);});
