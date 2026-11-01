import {OverviewPage} from '@/features/overview/page';
import {CasesPage} from '@/features/cases/page';
import {VerificationForm,RolesForm,VoiceForm,StarboardForm,SuggestionsForm,ThreadsForm,GreetingsForm} from '@/features/community/routes';
import {SocialForm,FeedsForm,ProductivityForm} from '@/features/content/routes';
import {RuleList,AutoModForm,ModerationForm} from '@/features/moderation/routes';
import {createBrowserRouter,Outlet} from 'react-router-dom';
import {AuthGate} from './auth';
import {DirtyGuard} from './dirty-guard';
import {GuildProvider} from './guild-context';
import {Shell,ServerChooser,Overview,PendingView} from './shell';
export const router=createBrowserRouter([{element:<AuthGate><DirtyGuard><Outlet/></DirtyGuard></AuthGate>,children:[{path:'/',element:<ServerChooser/>},{path:'/guilds/:guildId',element:<GuildProvider><Shell/></GuildProvider>,children:[{path:'overview',element:<OverviewPage/>},{path:'moderation/channel-rules',element:<RuleList/>},{path:'moderation/automod',element:<AutoModForm/>},{path:'moderation/cases',element:<CasesPage/>},{path:'moderation/settings',element:<ModerationForm/>},{path:'community/verification',element:<VerificationForm/>},{path:'community/roles',element:<RolesForm/>},{path:'community/voice',element:<VoiceForm/>},{path:'community/starboard',element:<StarboardForm/>},{path:'community/suggestions',element:<SuggestionsForm/>},{path:'community/threads',element:<ThreadsForm/>},{path:'community/greetings',element:<GreetingsForm/>},{path:'content/social',element:<SocialForm/>},{path:'content/feeds',element:<FeedsForm/>},{path:'content/productivity',element:<ProductivityForm/>},{path:'*',element:<PendingView/>}]}]}]);



