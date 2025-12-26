import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fyqwhjybwbugveyjpelg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cXdoanlid2J1Z3ZleWpwZWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTU5NjAsImV4cCI6MjA4MTM5MTk2MH0.4itaFhfMDYlUxSsIx3wxoyfoPbmjagld5G-wwwOPjq4';

export const supabase = createClient(supabaseUrl, supabaseKey);

