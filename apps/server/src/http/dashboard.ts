import express from 'express';
import type {Express} from 'express';
import {resolve} from 'node:path';
export function registerDashboard(app:Express,directory:string):void{const root=resolve(directory);app.use(express.static(root,{index:false}));app.get(/^\/(?:$|guilds\/[1-9][0-9]{0,19}(?:\/.*)?$)/,(_req,res)=>res.sendFile('index.html',{root}));}
