import { chatConnector } from '../server/chat.mjs';
import { vercelHandler } from '../server/http.mjs';

export default vercelHandler(chatConnector(process.env),'/api/chat');
