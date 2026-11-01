import type { ApiError } from '@eousbot/contracts';
export class AppError extends Error {
  constructor(public readonly code:ApiError['code'],message:string,public readonly fields?:Record<string,string>) {
    super(message); this.name='AppError';
  }
}
export function unavailable(message='Dependency unavailable. Please retry.'):AppError { return new AppError('unavailable',message); }

