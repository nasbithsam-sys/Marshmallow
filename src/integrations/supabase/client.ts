import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kxiqholnmhkwhdkhtopp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4aXFob2xubWhrd2hka2h0b3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjU0OTcsImV4cCI6MjA4ODc0MTQ5N30.yDiNd6Sl2jWbkNN0Wf5cjClVJKoQXAd8q8kkBUWep7o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
