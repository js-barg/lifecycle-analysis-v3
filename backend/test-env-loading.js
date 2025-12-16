// Test script to verify .env file loading
const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Environment Variable Loading');
console.log('============================================================');
console.log(`Current working directory: ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);

// Try to load .env from backend directory (same directory as this script)
const envPath = path.join(__dirname, '.env');
console.log(`\nLooking for .env at: ${envPath}`);
console.log(`File exists: ${fs.existsSync(envPath)}`);

if (fs.existsSync(envPath)) {
  console.log('\n📄 .env file contents:');
  const content = fs.readFileSync(envPath, 'utf8');
  console.log(content);
  
  // Load dotenv
  require('dotenv').config({ path: envPath });
  
  console.log('\n📋 Environment Variables After Loading:');
  console.log(`   AI_RESEARCH_PROVIDER: ${process.env.AI_RESEARCH_PROVIDER || 'NOT SET'}`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`   GEMINI_MODEL: ${process.env.GEMINI_MODEL || 'NOT SET'}`);
} else {
  console.log('\n❌ .env file not found!');
  console.log('Trying default dotenv behavior...');
  require('dotenv').config();
  
  console.log('\n📋 Environment Variables (default location):');
  console.log(`   AI_RESEARCH_PROVIDER: ${process.env.AI_RESEARCH_PROVIDER || 'NOT SET'}`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`   GEMINI_MODEL: ${process.env.GEMINI_MODEL || 'NOT SET'}`);
}

console.log('\n============================================================');

