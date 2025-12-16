// Test script to verify environment variables are loaded correctly
// Run with: node backend/test-env-config.js (from project root)
// Or: cd backend && node test-env-config.js

// Load dotenv from project root
const path = require('path');
const fs = require('fs');

// Load .env from project root (one level up from backend/)
// This script is in: backend/test-env-config.js
// .env file is in: project root (c:\development\lifecycle-analysis\.env)
const envPath = path.join(__dirname, '../.env');

console.log(`📁 Looking for .env at: ${envPath}`);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`✅ Loaded .env file from: ${envPath}`);
} else {
  console.log(`❌ .env file not found at: ${envPath}`);
  console.log(`   Current directory: ${__dirname}`);
  console.log(`   Working directory: ${process.cwd()}`);
  // Try default location as fallback
  require('dotenv').config();
}

console.log('\n🔍 Testing Environment Variable Configuration\n');
console.log('='.repeat(60));

// Check Gemini configuration
console.log('\n📋 Generative AI Configuration:');
console.log(`   AI_RESEARCH_PROVIDER: ${process.env.AI_RESEARCH_PROVIDER || '❌ NOT SET'}`);
console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : '❌ NOT SET'}`);
console.log(`   GEMINI_MODEL: ${process.env.GEMINI_MODEL || '❌ NOT SET'}`);

// Check Google Custom Search (if configured)
console.log('\n📋 Google Custom Search Configuration:');
console.log(`   GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   GOOGLE_CSE_API_KEY: ${process.env.GOOGLE_CSE_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   GOOGLE_SEARCH_ENGINE_ID: ${process.env.GOOGLE_SEARCH_ENGINE_ID ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   GOOGLE_CSE_CX: ${process.env.GOOGLE_CSE_CX ? '✅ SET' : '❌ NOT SET'}`);

// Verify Gemini setup
console.log('\n✅ Verification:');
if (process.env.GEMINI_API_KEY) {
  console.log('   ✅ GEMINI_API_KEY is configured');
  console.log('   ✅ Generative AI research should work');
} else {
  console.log('   ❌ GEMINI_API_KEY is missing');
  console.log('   ❌ Generative AI research will fail');
}

if (process.env.AI_RESEARCH_PROVIDER === 'gemini') {
  console.log('   ✅ AI_RESEARCH_PROVIDER is set to "gemini"');
} else {
  console.log(`   ⚠️  AI_RESEARCH_PROVIDER is "${process.env.AI_RESEARCH_PROVIDER || 'not set'}" (will default to gemini)`);
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 Tip: If variables are missing, check that .env file exists in project root');
console.log('   Expected location: c:\\development\\lifecycle-analysis\\.env\n');

