import {Link} from 'react-router-dom';
import type {DashboardStatus} from '@eousbot/contracts';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
export function RecentCases({status}:{status:DashboardStatus}){return <Card><CardHeader><CardTitle>Recent cases</CardTitle><CardDescription>Stored results from this server.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{status.recentCases.length===0?<p className="text-muted-foreground">No cases recorded for this server.</p>:status.recentCases.map(item=><div key={item.id} className="flex flex-wrap gap-3"><span>Case #{item.number} · {item.targetId} · {item.action??'cleanup'}</span><Badge variant={item.outcome?.state==='succeeded'?'default':'outline'}>{item.outcome?.state??'pending'}</Badge></div>)}<Button className="self-start" variant="outline" render={<Link to={'/guilds/'+status.guildId+'/moderation/cases'}/>}>View case history</Button></CardContent></Card>;}
