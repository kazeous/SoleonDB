import {useGuild} from '@/app/guild-context';
import {SettingsPanel} from '@/components/settings-panel';
import {DiscordRoleField} from '@/components/discord-role-field';
import {Flag} from '@/components/forms/fields';
export function RolesForm(){const {guildId}=useGuild();return <SettingsPanel guildId={guildId} feature="roles" title="Role pickers" description="Requires Manage Roles. Save the assignable roles, then use /rolepicker create in Discord to post a registered panel with up to five options. The verification role cannot be used here." renderFields={form=><><Flag form={form} name="enabled" label="Enable role pickers"/><DiscordRoleField {...{guildId,form}} name="assignableRoleIds" label="Assignable roles" multiple/></>}/>;}
