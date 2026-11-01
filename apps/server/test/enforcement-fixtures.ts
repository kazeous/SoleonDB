import type {AppDb} from '../src/db/client.js';
import type {Clock} from '../src/core/clock.js';
import type {RuleAction} from '@eousbot/contracts';
import {seedRule,intents} from './protection-fixtures.js';
import {createProtectionEngine} from '../src/features/protection/engine.js';
import {message} from './message.js';
export async function incident(db:AppDb,clock:Clock,action:RuleAction={kind:'timeout',durationSeconds:60},count=1){
 const rule=await seedRule(db,{action,threshold:{count,windowSeconds:10}}),engine=createProtectionEngine(db,clock);
 for(let i=1;i<=count;i++)await engine.observe(message({id:String(333333333333333300n+BigInt(i)),content:'https://example.org',createdAt:clock.now()}));
 return {rule,intent:(await intents(db))[0]!};
}
export async function blockCompletion(db:AppDb){
 await db.query("CREATE FUNCTION simulate_completion_failure() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF NEW.effect_key = ''punishment'' AND NEW.state = ''succeeded'' THEN RAISE EXCEPTION ''simulated crash after effect''; END IF; RETURN NEW; END'");
 await db.query('CREATE TRIGGER completion_failure BEFORE UPDATE ON incident_effects FOR EACH ROW EXECUTE FUNCTION simulate_completion_failure()');
}

