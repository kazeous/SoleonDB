import {createContext,useContext,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useNavigate,useParams} from 'react-router-dom';
import {z} from 'zod';
import {guildSummarySchema,type GuildSummary} from '@eousbot/contracts';
import {api} from '@/lib/api';
const Guild=createContext<{guildId:string;guild:GuildSummary;selectGuild:(id:string)=>Promise<void>;refresh:()=>Promise<unknown>}|null>(null);
export const guildsQuery={queryKey:['guilds'],queryFn:()=>api.get('/api/guilds',z.array(guildSummarySchema))};
export function useGuild(){return useContext(Guild)!;}
export function GuildProvider({children}:{children:ReactNode}){const {guildId}=useParams(),navigate=useNavigate(),query=useQuery(guildsQuery),guild=query.data?.find(g=>g.id===guildId);if(query.isPending)return <p aria-busy="true">Loading server…</p>;if(query.error)return <p role="alert">{query.error.message}</p>;if(!guild)return <p role="alert">Server unavailable. Choose a server from the dashboard.</p>;return <Guild.Provider value={{guildId:guild.id,guild,async selectGuild(id){navigate('/guilds/'+id+'/overview');},refresh:()=>query.refetch()}}>{children}</Guild.Provider>;}
