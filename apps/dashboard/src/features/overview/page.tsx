import {useGuild} from '@/app/guild-context';
import {Overview as OverviewShell} from '@/app/shell';
import {Alert,AlertTitle,AlertDescription} from '@/components/ui/alert';
import {Skeleton} from '@/components/ui/skeleton';
import {useDashboardStatus} from './queries';
import {Health} from './health';
import {SetupList} from './setup-list';
import {RecentCases} from './recent-cases';
export function OverviewPage(){const {guildId}=useGuild(),query=useDashboardStatus(guildId);return <OverviewShell>{query.isPending?<div aria-busy="true" aria-label="Loading diagnostics"><Skeleton className="h-24 w-full"/></div>:query.error?<Alert aria-label="Diagnostics unavailable"><AlertTitle>Diagnostics unavailable</AlertTitle><AlertDescription>{query.error.message} The last response cannot confirm current health.</AlertDescription></Alert>:query.data&&<div data-testid="status-guild" data-guild-id={query.data.guildId} className="flex flex-col gap-6"><Health status={query.data}/><SetupList status={query.data}/><RecentCases status={query.data}/></div>}</OverviewShell>;}
