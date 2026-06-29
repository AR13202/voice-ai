import { VectorStore } from './vector-store';

async function runTest() {
  console.log('Testing Vector Store Cosine Similarity logic...');
  const vs = new VectorStore();
  
  // Cosine Similarity test cases
  const vecA = [1, 0, 1];
  const vecB = [1, 1, 0];
  
  // Access the private method for validation
  const similarity = (vs as any).cosineSimilarity(vecA, vecB);
  console.log(`Cosine Similarity between [1,0,1] and [1,1,0]: ${similarity}`);
  
  const expected = 0.5; // 1 / (sqrt(2) * sqrt(2)) = 0.5
  
  if (Math.abs(similarity - expected) < 1e-6) {
    console.log('SUCCESS: Vector similarity calculation is correct.');
    process.exit(0);
  } else {
    console.error(`FAILURE: Expected ${expected}, got ${similarity}`);
    process.exit(1);
  }
}

runTest();
