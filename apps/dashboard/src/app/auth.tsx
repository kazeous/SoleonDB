import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {api,setCsrf} from '@/lib/api';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card';
import {Alert,AlertTitle,AlertDescription} from '@/components/ui/alert';
const Auth=createContext<{ownerId:string}|null>(null);
export function useAuth(){return useContext(Auth)!;}
export function AuthGate({children}:{children:ReactNode}){const [expired,setExpired]=useState(false),query=useQuery({queryKey:['auth'],queryFn:()=>api.get('/api/auth/me',z.object({owner:z.object({id:z.string()}),csrfToken:z.string()})),retry:false});useEffect(()=>{const handler=()=>setExpired(true);window.addEventListener('session-expired',handler);return()=>window.removeEventListener('session-expired',handler);},[]);useEffect(()=>{if(query.data)setCsrf(query.data.csrfToken);},[query.data]);if(query.isPending)return <main className="auth-page" aria-busy="true">Connecting to Eousbot…</main>;if(expired||query.error){const unavailable=query.error&&'status' in query.error&&query.error.status!==401;return <main className="auth-page"><Card><CardHeader><CardTitle><h1>{unavailable?'Dashboard unavailable':'Sign in to Eousbot'}</h1></CardTitle><CardDescription>Server control, with room to breathe.</CardDescription></CardHeader><CardContent>{unavailable?<Alert><AlertTitle>Connection unavailable</AlertTitle><AlertDescription>{query.error.message}</AlertDescription></Alert>:<Button render={<a href="/api/auth/discord"/>}>Sign in with Discord</Button>}</CardContent></Card></main>;}return <Auth.Provider value={{ownerId:query.data.owner.id}}>{children}</Auth.Provider>;}
