import { createClient } from '@supabase/supabase-js'

// Sustituye estos valores con los de tu proyecto de Supabase
const supabaseUrl = 'https://ifsfmqlquyjipiasbwwi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmc2ZtcWxxdXlqaXBpYXNid3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4ODE5NzQsImV4cCI6MjEwMDQ1Nzk3NH0.2Axh02g-4857W_wlAnneNSkCirjKgpoA74D5SnOXXnI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)