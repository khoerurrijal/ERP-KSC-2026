
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testLatency() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const start = Date.now();
  try {
    const result = await model.generateContent("bedanya cup oval dan flat apa ya ?");
    console.log(`Latency: ${Date.now() - start}ms`);
    console.log(`Response: ${result.response.text()}`);
  } catch (error) {
    console.log(`Error after ${Date.now() - start}ms:`, error);
  }
}

testLatency();
