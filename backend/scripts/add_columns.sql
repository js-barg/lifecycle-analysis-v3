-- Add new columns to raw_inventory table
ALTER TABLE raw_inventory 
ADD COLUMN IF NOT EXISTS asset_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS ship_date DATE;

-- Update the inventory_analysis table if needed
ALTER TABLE inventory_analysis
ADD COLUMN IF NOT EXISTS asset_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS ship_date DATE;
