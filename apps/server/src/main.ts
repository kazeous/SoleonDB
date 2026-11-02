import {formatStartupFailure,parseRuntimeEnv} from './core/env.js';
import {bootstrap} from './bootstrap.js';
async function main(){
  const {runtime}=bootstrap(parseRuntimeEnv(process.env));
  let ending=false;
  function shutdown(fatal:boolean){if(ending)return;ending=true;void(fatal?runtime.fatal():runtime.stop()).finally(()=>process.exit(fatal?1:0));}
  process.once('SIGTERM',()=>shutdown(false));process.once('SIGINT',()=>shutdown(false));
  process.once('uncaughtException',()=>shutdown(true));process.once('unhandledRejection',()=>shutdown(true));
  await runtime.start();
}
main().catch(error=>{process.stderr.write(formatStartupFailure(error));process.exitCode=1;});

