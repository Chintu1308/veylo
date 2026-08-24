import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Enforce Sandbox Mode for unit / integration tests to prevent side effects on real DB
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_ANON_KEY = 'placeholder-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder-service-key';

