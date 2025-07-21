import { RealtimeRelay } from './lib/relay.js';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = parseInt(process.env.PORT) || 8081;

const relay = new RealtimeRelay(OPENAI_API_KEY);
relay.listen(PORT);
