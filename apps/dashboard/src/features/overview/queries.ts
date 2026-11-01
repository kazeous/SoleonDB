import {useQuery} from '@tanstack/react-query';
import {dashboardStatusSchema} from '@eousbot/contracts';
import {api} from '@/lib/api';
export function useDashboardStatus(guildId:string){return useQuery({queryKey:['guilds',guildId,'status'],queryFn:async({signal})=>{const result=await api.get('/api/guilds/'+guildId+'/status',dashboardStatusSchema,{signal});if(result.guildId!==guildId)throw new Error('The diagnostic response does not match this server. Retry.');return result;},staleTime:0,refetchInterval:10000,refetchIntervalInBackground:false,refetchOnWindowFocus:true});}
