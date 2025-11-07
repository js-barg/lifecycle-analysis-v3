-- Add new columns to raw_inventory table
ALTER TABLE raw_inventory 
ADD COLUMN IF NOT EXISTS asset_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS ship_date DATE;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'raw_inventory' 
AND column_name IN ('asset_type', 'ship_date');
