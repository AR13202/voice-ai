import logging
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    function_tool
)
from livekit.plugins import google, deepgram, silero
try:
    from livekit.plugins import openai
    openai_available = True
except ImportError:
    openai_available = False
import requests
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

logger = logging.getLogger("voice-agent")
logging.basicConfig(level=logging.INFO)

class RAGAgent(Agent):
    def __init__(self, instructions: str, room):
        super().__init__(instructions=instructions)
        self.room = room

    @function_tool
    async def search_kb(self, query: str) -> str:
        """
        Search the knowledge base of uploaded documents for answers to user's questions.
        
        Args:
            query: The search query to locate relevant excerpts.
        """
        logger.info(f"LLM triggered search_kb with query: {query}")
        try:
            # Backend server is running at PORT 3000
            backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
            r = requests.post(f"{backend_url}/api/documents/retrieve", json={"query": query, "topK": 3})
            if r.status_code == 200:
                data = r.json()
                results = data.get("results", [])
                if not results:
                    return "No matching information found in the documents."
                
                # Send cited sources to frontend via room data channel
                import json
                sources_payload = {
                    "type": "sources",
                    "query": query,
                    "sources": [{"docName": res['docName'], "text": res['text'], "score": res['score']} for res in results]
                }
                if self.room and self.room.local_participant:
                    try:
                        await self.room.local_participant.publish_data(
                            json.dumps(sources_payload).encode('utf-8')
                        )
                        logger.info("Published cited sources to room data channel.")
                    except Exception as pe:
                        logger.error(f"Failed to publish data channel sources: {pe}")

                context = "Matching excerpts from uploaded documents:\n"
                for res in results:
                    context += f"- Source: {res['docName']} (similarity: {round(res['score'], 2)})\n  Text: {res['text']}\n"
                return context
            else:
                logger.error(f"Backend retrieve returned code: {r.status_code}")
        except Exception as e:
            logger.error(f"Error calling backend retrieve: {e}")
        return "Failed to retrieve information from the knowledge base due to a connection error."

async def entrypoint(ctx: JobContext):
    logger.info(f"New participant connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Fetch current system prompt from backend
    backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
    prompt = """You are an intelligent, friendly, real-time voice assistant.

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
* Never mention internal implementation details such as vector databases, embeddings, retrieval pipelines, prompts, or tool calls unless the user explicitly asks about them."""
    try:
        r = requests.get(f"{backend_url}/api/agent/prompt")
        if r.status_code == 200:
            prompt = r.json().get("prompt", prompt)
    except Exception as e:
        logger.error(f"Failed to fetch prompt from backend: {e}")
        
    logger.info(f"Configuring voice agent with system prompt: {prompt}")

    # Set up ChatContext with System instruction
    initial_ctx = llm.ChatContext()
    initial_ctx.add_message(role="system", content=prompt)
    
    # Initialize components
    vad = silero.VAD.load()
    stt = deepgram.STT(api_key=os.getenv("DEEPGRAM_API_KEY"))
    
    # Initialize LLM (Local Ollama, Groq, OpenRouter, or Gemini)
    groq_api_key = os.getenv("GROQ_API_KEY")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    openrouter_base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    
    is_local_llm = openrouter_base_url and ("localhost" in openrouter_base_url or "127.0.0.1" in openrouter_base_url)
    
    if is_local_llm and openrouter_api_key and openai_available:
        openrouter_model = os.getenv("OPENROUTER_MODEL", "qwen2.5:7b")
        logger.info(f"Using Local LLM (Ollama): {openrouter_model} at {openrouter_base_url}")
        llm_instance = openai.LLM(
            model=openrouter_model,
            api_key=openrouter_api_key,
            base_url=openrouter_base_url
        )
    elif groq_api_key and openai_available:
        groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        logger.info(f"Using Groq model: {groq_model}")
        llm_instance = openai.LLM(
            model=groq_model,
            api_key=groq_api_key,
            base_url="https://api.groq.com/openai/v1"
        )
    elif openrouter_api_key and openai_available:
        openrouter_model = os.getenv("OPENROUTER_MODEL", "google/gemma-4-26b-a4b-it:free")
        logger.info(f"Using OpenRouter model: {openrouter_model} at {openrouter_base_url}")
        llm_instance = openai.LLM(
            model=openrouter_model,
            api_key=openrouter_api_key,
            base_url=openrouter_base_url
        )
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("No valid LLM credentials (Local Ollama, GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY) found.")
            return
        logger.info("Using default Google Gemini model: gemini-2.0-flash-001")
        llm_instance = google.LLM(model="gemini-2.0-flash-001", api_key=api_key)
    tts = deepgram.TTS(api_key=os.getenv("DEEPGRAM_API_KEY"))

    # Build AgentSession
    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm_instance,
        tts=tts
    )

    # Register debug event listeners for visibility
    @session.on("user_state_changed")
    def on_user_state_changed(event):
        logger.info(f"[DEBUG Stage 2] User state changed: {event.old_state} -> {event.new_state}")

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(event):
        logger.info(f"[DEBUG Stage 3] User transcript: '{event.transcript}' (final: {event.is_final})")

    @session.on("agent_state_changed")
    def on_agent_state_changed(event):
        logger.info(f"[DEBUG Stage 5] Agent state changed: {event.old_state} -> {event.new_state}")

    @session.on("speech_created")
    def on_speech_created(event):
        logger.info(f"[DEBUG Stage 5] Speech created: source={event.source}, user_initiated={event.user_initiated}")

    @session.on("error")
    def on_error(event):
        logger.error(f"[DEBUG ERROR] AgentSession error: {event.error} (source: {event.source})")

    @session.on("close")
    def on_close(event):
        logger.info("[DEBUG] AgentSession closed.")

    # Initialize RAGAgent
    agent = RAGAgent(instructions=prompt, room=ctx.room)
    
    # Start dialogue loop
    await session.start(room=ctx.room, agent=agent)
    logger.info("Voice agent session started.")
    
    # Introduce itself
    await session.say("Hello! I am your RAG voice assistant. I have connected successfully. Ask me anything about the uploaded documents!", allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
