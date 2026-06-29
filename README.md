# Real-Time Voice AI Orchestration (with RAG & Dynamic Prompting)

An end-to-end real-time voice agent built on WebRTC using **LiveKit**. The application includes a React dashboard, an Express backend management server, a custom vector store, and a Python LiveKit agent worker. Users can upload documents (PDF, TXT, MD) to create a knowledge base, tweak the agent's system prompt dynamically, and talk to the voice assistant via WebRTC with live transcription and citation tracking.

---

## 🌟 Key Features
- **Real-Time Voice Pipeline:** Bidirectional WebRTC audio connection enabled by LiveKit.
- **Dynamic System Prompting:** Modify the agent's behavior, tone, or role on the fly from the UI before starting a call.
- **Ingestion & Custom RAG:** Upload PDFs, text documents, or markdown files. Chunks are embedded using Gemini (`text-embedding-004`) and stored in a lightweight local vector store.
- **Tool-Based Retrieval:** The voice agent calls a custom tool (`search_kb`) to fetch relevant document excerpts dynamically during the call.
- **Multi-Provider LLM Orchestration:** Run the reasoning engine on Google Gemini, Groq Cloud (`llama-3.3-70b-versatile`), OpenRouter, or 100% locally with Ollama (e.g., `qwen2.5:7b` or `llama3.1`).
- **Speech-to-Text & Text-to-Speech:** Integrated Deepgram (STT and TTS) for low-latency voice interactions.
- **Visual Citations & Transcripts:** Watch live transcription and see list of cited document excerpts used in the agent's verbal answer.
- **Active Call Ingestion Panel:** View currently indexed documents and their database chunk counts dynamically inside the session sidebar.

---

## 🏗️ Architecture Layout

```
real-time-voice-ai/
├── backend/            # Express.js + TS (PDF parsing, Custom Vector DB, token vending)
├── frontend/           # React + Vite + TS (Voice controls, dropzone upload, prompt configuration)
└── agent/              # Python Worker (LiveKit agent room connector, STT/TTS pipeline, RAG tool)
```

---

## ⚙️ Environment Variables

Create a `.env` file at the project root based on `.env.example`:

```env
# Backend & API Configuration
PORT=3000
BACKEND_URL=http://localhost:3000

# Frontend Configuration
VITE_BACKEND_URL=http://localhost:3000

# Google Gemini API Key (Required for Document Embeddings & optional LLM fallback)
# Get one for free: https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here

# Deepgram API Key (STT & TTS)
# Free signup with $200 credits: https://console.deepgram.com/
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# LiveKit WebRTC Server Credentials
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# --- OPTIONAL MULTI-LLM PROVIDERS ---

# Option A: Groq Cloud (Highly Recommended: ultra low-latency)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Option B: Local Ollama / OpenRouter (Offline/Local reasoning)
OPENROUTER_API_KEY=ollama
OPENROUTER_MODEL=qwen2.5:7b
OPENROUTER_BASE_URL=http://localhost:11434/v1
```

### ⚡ Configuring Alternate LLM Providers (e.g., Groq)

By default, the application runs on Google Gemini (`gemini-2.0-flash-001`). However, you can configure alternative providers in your `.env` file. The Python agent automatically detects your environment keys and prioritizes providers in the following order:

1. **Local Ollama / OpenAI-compatible endpoint** (active if `OPENROUTER_BASE_URL` contains `localhost`/`127.0.0.1` and `OPENROUTER_API_KEY` is set).
2. **Groq Cloud** (active if `GROQ_API_KEY` is set).
3. **OpenRouter Cloud** (active if `OPENROUTER_API_KEY` is set).
4. **Google Gemini** (default fallback if `GEMINI_API_KEY` is set).

#### Setup Groq Cloud for Ultra-Low Latency

Groq is highly recommended for real-time voice applications because of its incredibly low latency and high token-per-second output.

To use Groq:
1. Create a free account and generate an API key at the [Groq Console](https://console.groq.com/).
2. Add your Groq credentials to the `.env` file at the root of the project:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   ```
3. Restart your Python agent worker. It will log `Using Groq model: llama-3.3-70b-versatile` upon connection and route LLM queries through Groq.

---

## 🚀 Running the Project

Ensure you have **Node.js (v20+)** and **Python (3.11+)** installed. You will also need a local or cloud LiveKit instance to connect WebRTC clients.

Open four separate terminals to start the required services:

#### Terminal 1: Start LiveKit Server
Run a local LiveKit WebRTC server in developer mode using Docker:
```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev --node-ip 127.0.0.1
```

#### Terminal 2: Run Express Backend API
```bash
cd backend
npm install
npm run dev
```

#### Terminal 3: Run Python Agent Worker
```bash
cd agent
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate # On Windows (PowerShell)
# On macOS/Linux: source venv/bin/activate

pip install -r requirements.txt
python agent.py dev
```

#### Terminal 4: Run React Frontend Client
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🌐 Running LiveKit Cloud Sandbox (Alternative)
If you want to use **LiveKit Cloud** instead of running a local server:
1. Register a free account at [LiveKit Cloud](https://cloud.livekit.io/).
2. Create a project and download the connection URL, API Key, and Secret.
3. Update your root `.env` configuration:
   ```env
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-cloud-api-key
   LIVEKIT_API_SECRET=your-cloud-api-secret
   ```
4. Run your backend, agent worker, and React frontend as described in **Option B** (they will connect to the cloud server instead of localhost).

---

## ⚡ Verification & Testing

### local Vector DB Validation
To check that the custom vector database calculations are correct, you can run the built-in unit test:
```bash
cd backend
npx ts-node src/test-rag.ts
```
Expected output:
```
Testing Vector Store Cosine Similarity logic...
Cosine Similarity between [1,0,1] and [1,1,0]: 0.5
SUCCESS: Vector similarity calculation is correct.
```

---

## ⚠️ Known Limitations & Tradeoffs
1. **Network Address Translation (NAT) / Firewalls (Local Dev):** When running LiveKit Server locally on Windows, WebRTC UDP streams can sometimes be blocked by corporate firewalls or VPNs. If audio does not connect or is silent, run LiveKit Server on **LiveKit Cloud Sandbox** (Option C), which uses cloud TURN servers to bypass NAT issues.
2. **Cold-start & Ingestion Delay:** The ingestion process (chunking -> generating embeddings -> updating vector store) is performed synchronously on the backend. For extremely large documents (e.g. >100 pages), this might block the API request temporarily.
3. **Dynamic Prompt Updates:** Prompt modifications from the UI are loaded when the agent connects. If you update the prompt while a call is active, you must disconnect and reconnect to apply the updated instructions.
4. **VAD Sensitivity:** The Silero VAD module works well but might trigger on background ambient noise depending on your microphone gain. Use a headset for optimal voice quality.
