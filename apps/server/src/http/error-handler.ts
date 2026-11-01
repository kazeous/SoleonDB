import type {ErrorRequestHandler} from 'express';
import {ZodError} from 'zod';
import {AppError} from '../core/errors.js';
import type {Logger} from '../core/logger.js';
const statuses={validation:400,unauthorized:401,forbidden:403,not_found:404,conflict:409,unavailable:503};
export function errorHandler(logger:Logger):ErrorRequestHandler {
  return (error:unknown,_req,res,_next)=>{
    let failure:AppError;
    if(error instanceof AppError) failure=error;
    else if(error instanceof ZodError) failure=new AppError('validation','Invalid input',Object.fromEntries(error.issues.map(i=>[i.path.join('.'),'Invalid value'])));
    else if(error instanceof SyntaxError) failure=new AppError('validation','Invalid JSON request');
    else failure=new AppError('unavailable','Service unavailable. Please retry.');
    if(failure.code==='unavailable') logger.error({code:failure.code},'Request dependency failed');
    res.status(statuses[failure.code]).json({code:failure.code,message:failure.message,...(failure.fields?{fields:failure.fields}:{})});
  };
}

