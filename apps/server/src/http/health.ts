import type {Express} from 'express';
import type {HealthReader} from './app.js';
export function registerHealthRoutes(app:Express,status:HealthReader):void {
  app.get('/health',(_req,res)=>{const value=status.health();res.status(value.status).json(value.body);});
  app.get('/ready',(_req,res)=>{const value=status.ready();res.status(value.status).json(value.body);});
}

