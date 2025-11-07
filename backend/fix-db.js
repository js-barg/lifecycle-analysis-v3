const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lifecycle_analysis'
});

async function fixDatabase() {
  try {
    console.log('Connecting to database...');
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'phase3_jobs'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating phase3_jobs table...');
      await pool.query(`
        CREATE TABLE phase3_jobs (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) UNIQUE NOT NULL,
          phase2_job_id VARCHAR(255) NOT NULL,
          filter_name VARCHAR(255),
          filtered_count INTEGER,
          original_count INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Table created successfully!');
    } else {
      console.log('Adding missing columns to phase3_jobs...');
      await pool.query(`
        ALTER TABLE phase3_jobs 
        ADD COLUMN IF NOT EXISTS filter_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS filtered_count INTEGER,
        ADD COLUMN IF NOT EXISTS original_count INTEGER
      `);
      console.log('Columns added successfully!');
    }
    
    console.log('Database schema updated successfully!');
  } catch (error) {
    console.error('Error updating database:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabase();