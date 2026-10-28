// supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Remplace ces valeurs par les clés de ton projet Supabase
const SUPABASE_URL = 'https://nwulvkdbfbgutbwvbggy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dWx2a2RiZmJndXRid3ZiZ2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTIxNzIsImV4cCI6MjEwODQ4ODE3Mn0.-E9yCRy5HfEuuuG7VyFMiPcpxZ6gl2opZmAl6UB6ELg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);