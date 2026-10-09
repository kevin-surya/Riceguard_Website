import { chatStatus } from '../../server/chat-config.mjs';

export default function handler(req,res){return chatStatus(req,res,process.env);}
