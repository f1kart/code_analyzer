// Quick test of gemini-flash-latest
const API_KEY = 'AIzaSyDyOsXFR66jNZK4C0u7Za6ev0vvApR8NDg';

async function testFlashLatest() {
  console.log('🧪 Testing gemini-flash-latest...\n');
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "Hello from Gemini!" and nothing else.' }] }]
        })
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Failed (${response.status}):`);
      console.error(JSON.stringify(data, null, 2));
      
      if (data.error?.message?.includes('quota')) {
        console.log('\n⚠️  BILLING ACTIVATION TIPS:');
        console.log('1. Go to: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com');
        console.log('2. Make sure "Generative Language API" is enabled');
        console.log('3. Check billing is linked to the correct project');
        console.log('4. Wait 5-10 minutes for propagation\n');
      }
    } else {
      const text = data.candidates[0].content.parts[0].text;
      console.log('✅ SUCCESS! Gemini API is working!\n');
      console.log(`Response: ${text}\n`);
      console.log('🎉 Your Production AI system is ready to use!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFlashLatest();
