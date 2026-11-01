import type {CommandRouter} from '../../discord/interactions.js';
import type {fetchPublicText} from '../../http-client/public-fetch.js';
import {getCatFact} from './service.js';
export function registerCatFactCommand(router:CommandRouter,fetcher:typeof fetchPublicText):void{router.register({name:'catfact',kind:'command',handler:async context=>{await context.edit(await getCatFact(fetcher));}});}
