import {selfServiceForbiddenPermissions} from '@eousbot/contracts';
import type {RoleRef} from '@eousbot/contracts';
import {AppError} from '../core/errors.js';
export function assertNonPrivilegedRole(guildId:string,role:RoleRef):void {
 if(role.guildId!==guildId||role.id===guildId||role.managed||(BigInt(role.permissions)&selfServiceForbiddenPermissions)!==0n)throw new AppError('validation','Choose a dedicated non-privileged role in this server. Managed and staff roles are not assignable.');
}
export function assertAssignableRole(guildId:string,role:RoleRef,botPosition:number,canManageRoles:boolean):void {
 assertNonPrivilegedRole(guildId,role);if(!canManageRoles||botPosition<=role.position)throw new AppError('forbidden','Grant Manage Roles and place the bot role above the selected role.');
}

