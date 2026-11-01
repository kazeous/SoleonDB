import type {RuleAction} from '@eousbot/contracts';
export function chooseAction(actions:RuleAction[]):RuleAction {
 if(!actions.length)throw new Error('At least one action is required');
 const rank=(action:RuleAction)=>action.kind==='ban'?3:action.kind==='kick'?2:1;
 return structuredClone(actions.reduce((selected,action)=>rank(action)>rank(selected)||(action.kind==='timeout'&&selected.kind==='timeout'&&action.durationSeconds>selected.durationSeconds)?action:selected));
}

