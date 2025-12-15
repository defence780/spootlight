import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srvocgygtpgzelmmdola.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNydm9jZ3lndHBnemVsbW1kb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MjA2MzcsImV4cCI6MjA1MjA5NjYzN30.1XOGeKkdqcl1LyrXPcPpPD9nkW1BzS_hX6nskt3j5Cc';

export const supabase = createClient(supabaseUrl, supabaseKey);

