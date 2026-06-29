import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function testModel(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenerativeAI(apiKey!);
  try {
    console.log(`Testing model: "${modelName}"...`);
    const model = ai.getGenerativeModel({ model: modelName });
    const res = await model.embedContent('Hello world');
    console.log(`SUCCESS for "${modelName}"! Embedding dimensions:`, res.embedding.values.length);
  } catch (err: any) {
    console.error(`FAILED for "${modelName}":`, err.message || err);
  }
}

async function run() {
  await testModel('gemini-embedding-001');
  await testModel('gemini-embedding-2');
}

run();
