-- Migration to create alteration_measurements table for voice command tool
-- Supports voice command measurement tracking and fit tool integration

CREATE TABLE IF NOT EXISTS alteration_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  garment_id UUID REFERENCES garments(id) ON DELETE CASCADE,
  measurement_type TEXT NOT NULL, -- e.g., 'neiging', 'kraag', 'schouder_l', 'sluitknoop', 'arm_length'
  value NUMERIC,
  unit TEXT DEFAULT 'mm',
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  voice_command TEXT,
  confidence_score NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPS
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_customer_id ON alteration_measurements (customer_id);
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_garment_id ON alteration_measurements (garment_id);
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_recorded_at ON alteration_measurements (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_voice_command ON alteration_measurements (voice_command);

-- RLS policies for security
ALTER TABLE alteration_measurements ENABLE ROW LEVEL SECURITY;

-- Staff can view all measurements
CREATE POLICY "Staff can view measurements"
  ON alteration_measurements FOR SELECT
  USING (true);

-- Customers can view their own measurements
CREATE POLICY "Customers can view own measurements"
  ON alteration_measurements FOR SELECT
  USING (customer_id = current_user_id());

-- Staff can update measurement status
CREATE POLICY "Staff can update measurement status"
  ON alteration_measurements FOR UPDATE
  USING (true);

-- Staff can insert measurements
CREATE POLICY "Staff can insert measurements"
  ON alteration_measurements FOR INSERT
  WITH CHECK (true);