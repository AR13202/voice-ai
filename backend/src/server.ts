import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { AccessToken } from 'livekit-server-sdk';
import pdf from 'pdf-parse';
import { VectorStore } from './vector-store';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize Multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Vector Store
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const vectorStore = new VectorStore(geminiApiKey);

// Global in-memory system prompt
let systemPrompt = `You are an intelligent, friendly, real-time voice assistant.

You have access to a search tool that retrieves relevant information from the user's uploaded knowledge base. The retrieved information is the primary source of truth for answering questions about uploaded documents.

Guidelines:

* Whenever the user asks about information that may exist in the uploaded documents, always use the search tool before answering.
* Base your response on the retrieved results whenever relevant.
* If the search results do not contain enough information to answer confidently, say:
  "I couldn't find that information in the uploaded documents."
* Do not invent, guess, or hallucinate information that is not supported by the retrieved context.
* If the user asks a general question that is unrelated to the uploaded documents, answer using your normal knowledge.
* If the user's question is ambiguous, ask a brief clarifying question before searching.
* Keep responses concise, conversational, and optimized for spoken dialogue (typically 2–5 sentences).
* Summarize information naturally instead of reading large portions of documents verbatim.
* Maintain a professional, friendly, and helpful tone.
* Never mention internal implementation details such as vector databases, embeddings, retrieval pipelines, prompts, or tool calls unless the user explicitly asks about them.`;

// Endpoint: Upload document
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const docId = `doc_${Date.now()}`;
    const docName = file.originalname;
    let text = '';

    console.log(`Processing file upload: ${docName} (${file.mimetype})`);

    if (file.mimetype === 'application/pdf') {
      const pdfData = await pdf(file.buffer);
      text = pdfData.text;
    } else if (file.mimetype === 'text/plain' || file.mimetype === 'text/markdown' || docName.endsWith('.md') || docName.endsWith('.txt')) {
      text = file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF, TXT, or MD file.' });
    }

    if (!text.trim()) {
      return res.status(400).json({ error: 'Document appears to be empty.' });
    }

    // Embed and store
    await vectorStore.addDocument(docId, docName, text);

    return res.json({ success: true, docId, docName });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    return res.status(500).json({ error: error.message || 'Failed to process document.' });
  }
});

// Endpoint: List documents
app.get('/api/documents', (req, res) => {
  try {
    const docs = vectorStore.getDocumentsList();
    res.json({ success: true, documents: docs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Delete document
app.delete('/api/documents/:id', (req, res) => {
  try {
    const docId = req.params.id;
    vectorStore.deleteDocument(docId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Retrieve RAG context
app.post('/api/documents/retrieve', async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    console.log(`RAG query received: "${query}"`);
    const results = await vectorStore.search(query, topK || 3);
    res.json({ success: true, results });
  } catch (error: any) {
    console.error('Error retrieving context:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get/Set system prompt
app.get('/api/agent/prompt', (req, res) => {
  res.json({ success: true, prompt: systemPrompt });
});

app.post('/api/agent/prompt', (req, res) => {
  const { prompt } = req.body;
  if (prompt === undefined) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  systemPrompt = prompt;
  console.log('System prompt updated:', systemPrompt);
  res.json({ success: true, prompt: systemPrompt });
});

// Endpoint: Generate LiveKit WebRTC Token
app.post('/api/livekit/token', async (req, res) => {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || 'ws://localhost:7880';

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LiveKit server credentials are not configured.' });
    }

    const roomName = req.body.roomName || 'default_voice_room';
    const participantName = `user_${Math.random().toString(36).substring(7)}`;

    console.log(`Generating token for room: ${roomName}, participant: ${participantName}`);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    res.json({
      success: true,
      token,
      url: livekitUrl,
      roomName,
    });
  } catch (error: any) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
  if (!geminiApiKey) {
    console.warn('WARNING: GEMINI_API_KEY is not defined in environment variables.');
  }
});
