import { aiConnector } from '../server/ai.mjs';
import { vercelHandler } from '../server/http.mjs';

export default vercelHandler(aiConnector(process.env),'/api/analyze');
