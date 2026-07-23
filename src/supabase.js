import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://vpnlblzkbmvpaeagbpow.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbmxibHprYm12cGFlYWdicG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTgxODAsImV4cCI6MjEwMDE3NDE4MH0.AkVaD_cu4cXL26XlkRW42_sE21emOmrXG6-Hw-ne8WA'
)