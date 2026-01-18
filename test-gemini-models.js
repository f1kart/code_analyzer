// Test script to check available Gemini models
const API_KEY = 'AIzaSyDyOsXFR66jNZK4C0u7Za6ev0vvApR8NDg';

async function listModels() {
  console.log('🔍 Checking available Gemini models...\n');
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', response.status);
      console.error(error);
      return;
    }
    
    const data = await response.json();
    
    if (!data.models || data.models.length === 0) {
      console.error('❌ No models found!');
      console.log('\nThis could mean:');
      console.log('1. Gemini API is not fully enabled');
      console.log('2. Billing is not set up');
      console.log('3. API key has restrictions\n');
      return;
    }
    
    console.log(`✅ Found ${data.models.length} models\n`);
    
    // Filter models that support generateContent
    const generateModels = data.models.filter(m => 
      m.supportedGenerationMethods?.includes('generateContent')
    );
    
    console.log(`📝 Models supporting generateContent: ${generateModels.length}\n`);
    
    generateModels.forEach(model => {
      console.log(`Model ID: ${model.name}`);
      console.log(`  Display Name: ${model.displayName}`);
      console.log(`  Description: ${model.description || 'N/A'}`);
      console.log(`  Methods: ${model.supportedGenerationMethods.join(', ')}\n`);
    });
    
    // Test the first available model
    if (generateModels.length > 0) {
      console.log('🧪 Testing first available model...');
      const testModel = generateModels[0].name;
      await testGenerate(testModel);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testGenerate(modelName) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say hello in 3 words' }] }]
        })
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Test failed for ${modelName}:`, data.error.message);
    } else {
      console.log(`✅ Test successful for ${modelName}!`);
      console.log(`Response: ${data.candidates[0].content.parts[0].text}\n`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

listModels();
