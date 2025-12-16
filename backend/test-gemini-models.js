// Test script to list available Gemini models
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
  console.error('   Please check your .env file in the backend directory');
  process.exit(1);
}

console.log('🔍 Testing Gemini API ListModels');
console.log('============================================================');
console.log(`API Key: ${apiKey.substring(0, 20)}...`);
console.log('');

// Try both v1beta and v1 endpoints
const endpoints = [
  { version: 'v1beta', url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}` },
  { version: 'v1', url: `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}` }
];

async function testListModels() {
  for (const endpoint of endpoints) {
    console.log(`\n📋 Testing ${endpoint.version} endpoint...`);
    console.log(`   URL: ${endpoint.url.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    try {
      const response = await axios.get(endpoint.url, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.models) {
        console.log(`   ✅ Success! Found ${response.data.models.length} models:`);
        console.log('');
        
        // Group models by support for generateContent
        const modelsWithGenerateContent = [];
        const modelsWithoutGenerateContent = [];
        
        response.data.models.forEach(model => {
          const modelInfo = {
            name: model.name,
            displayName: model.displayName || 'N/A',
            description: model.description || 'N/A',
            supportedMethods: model.supportedGenerationMethods || [],
            supportsGenerateContent: model.supportedGenerationMethods && 
                                   model.supportedGenerationMethods.includes('generateContent')
          };
          
          if (modelInfo.supportsGenerateContent) {
            modelsWithGenerateContent.push(modelInfo);
          } else {
            modelsWithoutGenerateContent.push(modelInfo);
          }
        });
        
        // Show models that support generateContent first
        if (modelsWithGenerateContent.length > 0) {
          console.log('   ✅ Models that support generateContent:');
          modelsWithGenerateContent.forEach(model => {
            console.log(`      • ${model.name}`);
            console.log(`        Display: ${model.displayName}`);
            console.log(`        Methods: ${model.supportedMethods.join(', ')}`);
            console.log('');
          });
        }
        
        // Show models that don't support generateContent
        if (modelsWithoutGenerateContent.length > 0) {
          console.log('   ⚠️  Models that do NOT support generateContent:');
          modelsWithoutGenerateContent.forEach(model => {
            console.log(`      • ${model.name} (${model.supportedMethods.join(', ') || 'no methods'})`);
          });
          console.log('');
        }
        
        // Recommend a model
        if (modelsWithGenerateContent.length > 0) {
          const recommended = modelsWithGenerateContent.find(m => 
            m.name.includes('1.5-pro') || m.name.includes('pro')
          ) || modelsWithGenerateContent[0];
          
          console.log('   💡 Recommended model for your .env file:');
          console.log(`      AI_RESEARCH_PROVIDER=gemini`);
          console.log(`      GEMINI_MODEL=${recommended.name.replace(/^models\//, '')}`);
          console.log('');
        }
        
      } else {
        console.log('   ⚠️  Response received but no models found');
        console.log(`   Response: ${JSON.stringify(response.data)}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Response: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error(`   No response received from server`);
      }
    }
  }
  
  console.log('\n============================================================');
  console.log('✅ Test complete');
}

testListModels().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

