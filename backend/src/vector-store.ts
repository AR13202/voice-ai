import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface DocumentChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  embedding: number[];
}

export class VectorStore {
  private dbPath: string;
  private chunks: DocumentChunk[] = [];
  private ai: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string) {
    this.dbPath = path.join(__dirname, '..', 'vector_db.json');
    if (apiKey) {
      this.ai = new GoogleGenerativeAI(apiKey);
    }
    this.load();
  }

  setApiKey(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  private load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        this.chunks = JSON.parse(data);
        console.log(`Loaded ${this.chunks.length} chunks from vector database.`);
      }
    } catch (error) {
      console.error('Error loading vector database:', error);
      this.chunks = [];
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.chunks, null, 2), 'utf-8');
      console.log(`Saved ${this.chunks.length} chunks to vector database.`);
    } catch (error) {
      console.error('Error saving vector database:', error);
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!this.ai) {
      throw new Error('Google Gemini API Key is not set in the vector store.');
    }
    const model = this.ai.getGenerativeModel({ model: 'gemini-embedding-2' });
    const result = await model.embedContent(text);
    if (!result.embedding || !result.embedding.values) {
      throw new Error('Failed to generate embedding from Gemini API.');
    }
    return result.embedding.values;
  }

  async addDocument(docId: string, docName: string, text: string) {
    // Simple character/recursive-like chunking: 1000 chars chunks with 200 chars overlap
    const chunkSize = 1000;
    const overlap = 200;
    const chunks: string[] = [];
    
    let start = 0;
    while (start < text.length) {
      const end = start + chunkSize;
      chunks.push(text.substring(start, end));
      start += chunkSize - overlap;
    }

    console.log(`Splitting "${docName}" into ${chunks.length} chunks for embedding...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i].trim();
      if (!chunkText) continue;
      
      const embedding = await this.getEmbedding(chunkText);
      const chunk: DocumentChunk = {
        id: `${docId}_chunk_${i}`,
        docId,
        docName,
        text: chunkText,
        embedding
      };
      this.chunks.push(chunk);
    }

    this.save();
  }

  deleteDocument(docId: string) {
    this.chunks = this.chunks.filter(c => c.docId !== docId);
    this.save();
  }

  getDocumentsList(): { docId: string; docName: string; chunksCount: number }[] {
    const docMap = new Map<string, { docName: string; count: number }>();
    for (const chunk of this.chunks) {
      const entry = docMap.get(chunk.docId);
      if (entry) {
        entry.count++;
      } else {
        docMap.set(chunk.docId, { docName: chunk.docName, count: 1 });
      }
    }
    return Array.from(docMap.entries()).map(([docId, val]) => ({
      docId,
      docName: val.docName,
      chunksCount: val.count
    }));
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(query: string, topK: number = 3): Promise<{ text: string; docName: string; score: number }[]> {
    if (this.chunks.length === 0) {
      return [];
    }
    const queryEmbedding = await this.getEmbedding(query);
    const results = this.chunks.map(chunk => {
      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        text: chunk.text,
        docName: chunk.docName,
        score
      };
    });

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}
