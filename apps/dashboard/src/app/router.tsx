import {RuleList,AutoModForm,ModerationForm} from '@/features/moderation/routes';
import {createBrowserRouter,Outlet} from 'react-router-dom';
import {AuthGate} from './auth';
import {DirtyGuard} from './dirty-guard';
import {GuildProvider} from './guild-context';
import {Shell,ServerChooser,Overview,PendingView} from './shell';
export const router=createBrowserRouter([{element:<AuthGate><DirtyGuard><Outlet/></DirtyGuard></AuthGate>,children:[{path:'/',element:<ServerChooser/>},{path:'/guilds/:guildId',element:<GuildProvider><Shell/></GuildProvider>,children:[{path:'overview',element:<Overview/>},{path:'moderation/channel-rules',element:<RuleList/>},{path:'moderation/automod',element:<AutoModForm/>},{path:'moderation/settings',element:<ModerationForm/>},{path:'*',element:<PendingView/>}]}]}]);

