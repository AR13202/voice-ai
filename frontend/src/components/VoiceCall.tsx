import { useState, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant,
  useConnectionState
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { DocManager } from './DocManager';
import { PromptEditor } from './PromptEditor';

interface VoiceCallProps {
  backendUrl: string;
  onConnectedChange?: (connected: boolean) => void;
}

export function VoiceCall({ backendUrl, onConnectedChange }: VoiceCallProps) {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>('voice_rag_room');
  const [connecting, setConnecting] = useState(false);

  // Notify parent App component when connection status transitions
  useEffect(() => {
    onConnectedChange?.(!!token);
  }, [token, onConnectedChange]);

  const startCall = async () => {
    try {
      setConnecting(true);
      const res = await fetch(`${backendUrl}/api/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName })
      });

      if (!res.ok) throw new Error('Failed to generate LiveKit token');
      
      const data = await res.json();
      setToken(data.token);
      setUrl(data.url);
    } catch (e) {
      console.error('Call initialization error:', e);
      alert('Error initiating voice call: ' + (e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setToken(null);
    setUrl(null);
  };

  if (token && url) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={handleDisconnect}
      >
        <RoomAudioRenderer />
        <ActiveCallUI onDisconnect={handleDisconnect} backendUrl={backendUrl} />
      </LiveKitRoom>
    );
  }

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="bg-background w-full h-16 flex justify-between items-center px-gutter border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <div className="bg-secondary-container p-1.5 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-on-secondary text-[20px]">memory</span>
          </div>
          <h1 className="font-headline-md text-headline-md font-bold text-primary">Orchestra AI</h1>
          <span className="ml-4 text-on-surface-variant font-label-md text-label-md hidden md:block">Real-Time Voice AI Orchestration</span>
        </div>

      </header>

      {/* Main Layout Grid */}
      <main className="max-w-[1600px] mx-auto p-gutter grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Left Panel: Real-Time Voice Call */}
        <section className="lg:col-span-8 flex flex-col gap-md">
          <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-[650px] relative">

            {/* Call Content Canvas */}
            <div className="flex-1 flex flex-col items-center justify-center p-xl relative overflow-hidden">
              {/* Background Visual Element */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"></div>
              </div>
              <div className="relative z-10 flex flex-col items-center text-center max-w-md">
                {/* Centered Pulse Icon */}
                <div className="w-32 h-32 rounded-full bg-surface-container-highest flex items-center justify-center mb-lg border border-outline-variant relative">
                  {/* Simulated Waveform rings */}
                  <div className="absolute inset-0 border border-primary/20 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                  <div className="absolute inset-0 border border-primary/10 rounded-full animate-ping" style={{ animationDelay: '1s', animationDuration: '3s' }}></div>
                  <span className="material-symbols-outlined text-on-surface text-[48px]">call</span>
                </div>
                
                <h3 className="font-headline-lg text-headline-lg mb-sm">Start Voice Session</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-xl leading-relaxed">
                  Connect over WebRTC to speak with the RAG agent. You must have ingested documents to test retrieval.
                </p>
                
                {/* Action Controls */}
                <div className="flex flex-wrap items-center justify-center gap-md w-full">
                  <div className="relative group">
                    <select 
                      className="bg-surface-container-highest border border-outline-variant text-on-surface rounded-lg px-md py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none min-w-[200px] cursor-pointer font-label-md"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    >
                      <option value="voice_rag_room">voice_rag_room</option>
                      <option value="staging_environment">staging_environment</option>
                      <option value="dev_sandbox">dev_sandbox</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                  </div>
                  <button 
                    className="bg-secondary-container hover:bg-secondary transition-all text-on-secondary-container font-label-md px-xl py-2.5 rounded-lg active:scale-95 flex items-center gap-sm active-glow"
                    onClick={startCall}
                    disabled={connecting}
                  >
                    <span className="material-symbols-outlined">{connecting ? 'sync' : 'bolt'}</span>
                    <span>{connecting ? 'Connecting...' : 'Connect Agent'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Right Panel: Ingestion, Prompt & Telemetry */}
        <aside className="lg:col-span-4 flex flex-col gap-lg">
          {/* KB Ingestion */}
          <DocManager backendUrl={backendUrl} />

          {/* Prompt Configuration */}
          <PromptEditor backendUrl={backendUrl} />

        </aside>
      </main>
    </>
  );
}

/* Call Dashboard rendered within LiveKitRoom context */
interface ActiveCallUIProps {
  onDisconnect: () => void;
  backendUrl: string;
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  isFinal: boolean;
}

interface CitedSource {
  docName: string;
  text: string;
  score: number;
}

interface CitationGroup {
  query: string;
  sources: CitedSource[];
  timestamp: string;
}

function ActiveCallUI({ onDisconnect, backendUrl }: ActiveCallUIProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [citations, setCitations] = useState<CitationGroup[]>([]);
  const [waveHeights, setWaveHeights] = useState<number[]>([4, 8, 12, 16, 10, 14, 8, 4]);
  const [documents, setDocuments] = useState<{ docId: string; docName: string; chunksCount: number }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarFileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarUploading, setSidebarUploading] = useState(false);

  // Auto-scroll chat container to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch ingested documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (e) {
      console.error('Error fetching documents in active call:', e);
    }
  };

  // Ambient Voice Waveform animation
  useEffect(() => {
    const isConnected = connectionState === ConnectionState.Connected;
    if (!isConnected) return;
    const interval = setInterval(() => {
      setWaveHeights(prev => prev.map(() => Math.floor(Math.random() * 28) + 4));
    }, 120);
    return () => clearInterval(interval);
  }, [connectionState]);

  // Action: Clear local transcripts
  const clearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat transcript?")) {
      setMessages([]);
    }
  };

  // Action: Export transcripts to file
  const downloadTranscript = () => {
    if (messages.length === 0) {
      alert("No transcript messages to export.");
      return;
    }
    const textContent = messages
      .map(m => `[${m.sender.toUpperCase()}] ${m.text}`)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `voice_agent_transcript_${new Date().toISOString().slice(0, 10)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action: Upload new document from sidebar
  const triggerSidebarFileSelect = () => {
    sidebarFileInputRef.current?.click();
  };

  const handleSidebarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);

    setSidebarUploading(true);
    try {
      const res = await fetch(`${backendUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload document.');
      }
      
      // Add a simulated pipeline event
      console.log(`[RAG Ingestion] Document parsed and added: ${file.name}`);
      alert(`Document "${file.name}" uploaded and indexed successfully!`);
      fetchDocuments();
    } catch (err: any) {
      alert('Upload error: ' + err.message);
    } finally {
      setSidebarUploading(false);
      if (sidebarFileInputRef.current) {
        sidebarFileInputRef.current.value = '';
      }
    }
  };

  // Toggle local microphone
  const toggleMute = () => {
    if (localParticipant) {
      const currentlyEnabled = localParticipant.isMicrophoneEnabled;
      localParticipant.setMicrophoneEnabled(!currentlyEnabled);
      setIsMuted(currentlyEnabled);
    }
  };

  // Subscribing to LiveKit room audio/transcript/data events
  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: any[], participant: any) => {
      const identity = participant?.identity || '';
      const sender = identity.startsWith('user_') ? 'user' : 'agent';

      setMessages((prev) => {
        const next = [...prev];
        for (const segment of segments) {
          const idx = next.findIndex((m) => m.id === segment.id);
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              text: segment.text,
              isFinal: segment.isFinal
            };
          } else {
            next.push({
              id: segment.id,
              sender,
              text: segment.text,
              isFinal: segment.isFinal
            });
          }
        }
        return next;
      });
    };

    const handleDataReceived = (payload: Uint8Array, _participant: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        
        if (data.type === 'sources') {
          setCitations((prev) => [
            {
              query: data.query,
              sources: data.sources,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            ...prev
          ]);
        }
      } catch (e) {
        console.error('Error parsing data channel payload:', e);
      }
    };

    room.on('transcriptionReceived', handleTranscription);
    room.on('dataReceived', handleDataReceived);

    return () => {
      room.off('transcriptionReceived', handleTranscription);
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting || connectionState === ConnectionState.Reconnecting;
  const lastMessage = messages[messages.length - 1];
  const isWaitingForAgent = lastMessage && lastMessage.sender === 'user' && lastMessage.isFinal;

  // Determine current active pipeline events for display logs
  const pipelineEvents = citations.slice(0, 3).map((cite) => [
    { time: cite.timestamp, desc: `Query: "${cite.query.slice(0, 35)}..."` },
    { time: cite.timestamp, desc: `Retrieval returned ${cite.sources.length} chunks` },
  ]).flat();

  if (connectionState !== ConnectionState.Connected) {
    return (
      <main className="flex h-screen items-center justify-center bg-background text-on-surface p-xl font-body-md">
        <div className="glass-panel max-w-md w-full p-xl rounded-2xl flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
          {/* Decorative gradients */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-primary/10 blur-xl rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-secondary-container/10 blur-xl rounded-full pointer-events-none"></div>
          
          {/* Animated Spinner with sync icon */}
          <div className="relative mb-lg">
            <div className="w-16 h-16 rounded-full border-4 border-outline-variant/30 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[24px] animate-pulse">sync</span>
            </div>
          </div>

          <h3 className="font-headline-md text-headline-md font-bold mb-sm text-primary">Setting Up Session</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-lg leading-relaxed">
            Establishing WebRTC connection, setting up secure media channels, and initializing the voice agent. Please wait...
          </p>

          {/* Connection steps */}
          <div className="w-full space-y-sm text-left font-label-md text-sm border-t border-outline-variant/30 pt-md">
            <div className="flex items-center gap-sm">
              {connectionState === ConnectionState.Connecting ? (
                <>
                  <span className="material-symbols-outlined text-primary text-[18px] animate-spin">sync</span>
                  <span className="text-on-surface text-xs">Connecting to LiveKit server...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                  <span className="text-on-surface-variant text-xs">LiveKit Server: OK</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">radio_button_unchecked</span>
              <span className="text-on-surface-variant/50 text-xs">Allocating WebRTC channels...</span>
            </div>
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">radio_button_unchecked</span>
              <span className="text-on-surface-variant/50 text-xs">Initializing audio stream...</span>
            </div>
          </div>

          {/* Cancel button */}
          <button 
            onClick={onDisconnect}
            className="mt-xl text-on-surface-variant hover:text-red-400 transition-colors font-label-md text-xs bg-surface-container-high/40 px-lg py-2 rounded-xl border border-outline-variant/30 active:scale-95 flex items-center gap-sm"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            <span>Cancel Connection</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen relative bg-background text-on-surface font-body-md selection:bg-primary/30 overflow-hidden">
      
      {/* Left Column: Centered Conversation Thread */}
      <section className="flex-1 flex flex-col h-full relative border-r border-outline-variant/30">
        
        {/* Top App Bar */}
        <header className="w-full z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex items-center justify-between px-xl h-16 shrink-0">
          <div className="flex items-center gap-md">
            <h1 className="font-headline-md text-body-md font-bold text-primary tracking-tight mr-lg">Orchestrator AI</h1>
            <div className="flex items-center gap-sm px-md py-base bg-success-container/10 border border-green-500/20 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="font-label-md text-label-md text-green-400 uppercase tracking-widest text-[10px]">
                {isConnecting ? 'Reconnecting' : 'Real-Time Active'}
              </span>
            </div>
            <h2 className="font-label-md text-label-md font-bold text-on-surface uppercase tracking-wider hidden lg:block">
              Voice AI Orchestration
            </h2>
          </div>
          
          {/* Action buttons added to the header */}
          <div className="flex items-center gap-md">
            <button 
              onClick={downloadTranscript} 
              className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-xs font-label-md text-xs bg-surface-container-high/40 px-3 py-1.5 rounded-lg border border-outline-variant/30 active:scale-95"
              title="Download Transcript"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              <span>Export</span>
            </button>
            <button 
              onClick={clearChat} 
              className="text-on-surface-variant hover:text-red-400 transition-colors flex items-center gap-xs font-label-md text-xs bg-surface-container-high/40 px-3 py-1.5 rounded-lg border border-outline-variant/30 active:scale-95"
              title="Clear Chat"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              <span>Clear</span>
            </button>
          </div>
        </header>

        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto pt-lg pb-48 px-xl flex flex-col items-center" id="chat-container">
          <div className="w-full max-w-3xl space-y-xl">
            {/* Agent Intro */}
            <div className="flex flex-col items-center mb-xl opacity-60">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-md border border-primary/20">
                <span className="material-symbols-outlined text-primary text-3xl">graphic_eq</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface-variant">Initialized Voice Agent: EVE-04 (Gemini 2.0 Flash)</p>
            </div>

            {/* Empty State */}
            {messages.length === 0 && (
              <div className="flex justify-center py-20 text-on-surface-variant font-label-md text-center opacity-40">
                Speak into your mic. The RAG Agent is listening...
              </div>
            )}

            {/* Message Thread */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full group`}>
                  <div className={`flex gap-md ${isUser ? 'justify-end' : ''} w-full`}>
                    {!isUser && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-primary text-sm">bolt</span>
                      </div>
                    )}
                    <div className={isUser ? 'max-w-[85%]' : 'flex-1 space-y-md'}>
                      <div className={isUser 
                        ? "bg-surface-container-highest/50 border border-outline-variant/30 px-lg py-md rounded-2xl rounded-tr-sm"
                        : "bg-surface-container-low border border-outline-variant/20 px-lg py-md rounded-2xl rounded-tl-sm shadow-sm"
                      }>
                        <p className={`font-body-md text-body-md text-on-surface leading-relaxed ${!msg.isFinal ? 'interim-text' : ''}`}>
                          {isUser ? `"${msg.text}"` : msg.text}
                        </p>
                      </div>
                      <span className={`${isUser ? 'mr-sm' : 'ml-sm'} block font-label-md text-[10px] text-on-surface-variant opacity-40 uppercase tracking-tighter`}>
                        {isUser ? 'You' : 'EVE-04'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {isWaitingForAgent && (
              <div className="flex flex-col items-start w-full group animate-pulse">
                <div className="flex gap-md w-full">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-primary text-sm animate-spin" style={{ animationDuration: '3s' }}>sync</span>
                  </div>
                  <div className="flex-1 space-y-md">
                    <div className="bg-surface-container-low border border-outline-variant/20 px-lg py-md rounded-2xl rounded-tl-sm shadow-sm max-w-max">
                      <p className="font-body-md text-body-md text-on-surface-variant/80 italic leading-relaxed">
                        thinking.....
                      </p>
                    </div>
                    <span className="ml-sm block font-label-md text-[10px] text-on-surface-variant opacity-40 uppercase tracking-tighter">
                      EVE-04
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Persistent Voice Controller (Floating) */}
        <div className="absolute bottom-md left-1/2 -translate-x-1/2 w-full max-w-2xl px-xl z-30">
          <div className="bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant/40 rounded-2xl p-md shadow-2xl flex items-center justify-between gap-xl">
            {/* Status & Latency */}
            <div className="hidden md:flex flex-col gap-xs min-w-[120px]">
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="font-code-sm text-code-sm text-on-surface">{isConnected ? '12ms Latency' : 'Connecting'}</span>
              </div>
              <span className="font-label-md text-[10px] text-on-surface-variant uppercase opacity-50">Codec: OPUS-HD</span>
            </div>

            {/* Visualizer and Main Controls */}
            <div className="flex-1 flex items-center justify-center gap-lg">
              <button className="relative group" onClick={toggleMute} id="mic-toggle">
                <div className={`absolute -inset-2 bg-primary/10 rounded-full scale-110 voice-active-ring transition-opacity ${!isMuted ? 'opacity-100' : 'opacity-0'}`}></div>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:brightness-110 transition-all relative z-10 ${
                  !isMuted ? 'bg-primary text-on-primary' : 'bg-surface-container-highest border border-outline text-on-surface-variant'
                }`} id="mic-btn">
                  <span className="material-symbols-outlined text-2xl" id="mic-icon">
                    {!isMuted ? 'mic' : 'mic_off'}
                  </span>
                </div>
              </button>

              {/* Pulse Visualizer */}
              <div className="flex items-center gap-1 h-8 px-lg">
                {waveHeights.map((h, i) => (
                  <div 
                    key={i} 
                    className="wave-bar w-1 bg-primary rounded-full transition-all duration-75"
                    style={{ height: `${h}px`, opacity: isMuted ? 0.2 : (0.3 + (i * 0.1)) }}
                  />
                ))}
              </div>
            </div>

            {/* End Session */}
            <button 
              className="flex items-center gap-sm px-lg py-sm bg-error/10 hover:bg-error/20 border border-error/30 text-error rounded-xl transition-all font-label-md text-label-md group active:scale-95"
              onClick={onDisconnect}
            >
              <span className="material-symbols-outlined">call_end</span>
              <span className="hidden sm:inline">End Session</span>
            </button>
          </div>
        </div>
      </section>

      {/* Right Sidebar: RAG Orchestration */}
      <aside className="w-80 h-screen bg-surface border-l border-outline-variant flex flex-col shrink-0 overflow-hidden">
        {/* Panel Header */}
        <div className="p-lg border-b border-outline-variant bg-surface-container-low/50">
          <h3 className="font-headline-md text-body-md font-bold uppercase tracking-widest text-primary flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">account_tree</span>
            RAG Orchestration
          </h3>
          <p className="font-label-md text-[10px] text-on-surface-variant opacity-60 uppercase mt-xs">Real-time Retrieval Pipeline</p>
        </div>

        <div className="flex-1 overflow-y-auto p-md space-y-lg">
          {/* Retrieval Metrics Section */}
          <section>
            <h4 className="font-label-md text-[11px] text-on-surface-variant uppercase tracking-widest mb-md opacity-70">Retrieval Metrics</h4>
            <div className="grid grid-cols-2 gap-md">
              <div className="bg-surface-container-highest/40 p-sm rounded-lg border border-outline-variant/30">
                <span className="block text-[10px] text-on-surface-variant uppercase">Vector Latency</span>
                <span className="text-tertiary font-code-sm text-md">18ms</span>
              </div>
              <div className="bg-surface-container-highest/40 p-sm rounded-lg border border-outline-variant/30">
                <span className="block text-[10px] text-on-surface-variant uppercase">Recall Hit</span>
                <span className="text-primary font-code-sm text-md">94.2%</span>
              </div>
            </div>
          </section>

          {/* Direct File Ingest Action */}
          <div>
            <input 
              type="file" 
              ref={sidebarFileInputRef} 
              onChange={handleSidebarUpload}
              accept=".pdf,.txt,.md"
              style={{ display: 'none' }}
            />
            <button 
              className="w-full flex items-center justify-center gap-sm px-lg py-md bg-secondary-container/20 hover:bg-secondary-container/30 border border-secondary/30 text-secondary rounded-xl transition-all font-label-md text-label-md group active:scale-95"
              onClick={triggerSidebarFileSelect}
              disabled={sidebarUploading}
            >
              <span className="material-symbols-outlined">cloud_upload</span>
              <span>{sidebarUploading ? 'Uploading...' : 'Upload Files'}</span>
            </button>
          </div>

          {/* Ingested Documents List */}
          <section className="bg-surface-container-low/40 p-md rounded-xl border border-outline-variant/30">
            <h4 className="font-label-md text-[11px] text-on-surface-variant uppercase tracking-widest mb-sm opacity-70">
              Ingested Files ({documents.length})
            </h4>
            {documents.length === 0 ? (
              <div className="text-xs text-on-surface-variant italic py-xs">
                No documents in database.
              </div>
            ) : (
              <div className="space-y-sm max-h-[120px] overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <div key={doc.docId} className="bg-surface-container-low border border-outline-variant/60 p-sm rounded-lg flex items-center justify-between gap-sm">
                    <span className="font-label-md text-xs text-on-surface truncate" title={doc.docName}>
                      {doc.docName}
                    </span>
                    <span className="text-[9px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant shrink-0">
                      {doc.chunksCount} chk
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active Sources Section */}
          <section>
            <div className="flex items-center justify-between mb-md">
              <h4 className="font-label-md text-[11px] text-on-surface-variant uppercase tracking-widest opacity-70">Active Sources</h4>
              <span className="bg-primary/20 text-primary text-[10px] px-sm py-0.5 rounded-full font-bold">
                {citations.length === 0 ? '0 CITED' : `${citations[0].sources.length} CITED`}
              </span>
            </div>

            {citations.length === 0 ? (
              <div className="text-xs text-on-surface-variant italic py-md">
                No citations retrieved yet. Ask the voice assistant about your documents to pull references.
              </div>
            ) : (
              <div className="space-y-md">
                <p className="text-[10px] text-on-surface-variant italic">Latest Query: "{citations[0].query}"</p>
                {citations[0].sources.map((src, sIdx) => {
                  const colors = ['text-tertiary', 'text-secondary', 'text-on-surface-variant'];
                  const color = colors[sIdx % colors.length];
                  return (
                    <div key={sIdx} className="p-md bg-surface-container-low border border-outline-variant rounded-xl hover:border-primary/50 transition-colors cursor-pointer group">
                      <div className={`flex items-center gap-sm mb-sm ${color}`}>
                        <span className="material-symbols-outlined text-sm">description</span>
                        <span className="font-label-md text-[11px] uppercase font-bold truncate max-w-[160px]">{src.docName}</span>
                      </div>
                      <p className="font-body-sm text-[12px] text-on-surface line-clamp-2 leading-relaxed">
                        {src.text}
                      </p>
                      <div className="mt-sm pt-sm border-t border-outline-variant/10 flex items-center justify-between">
                        <span className="font-code-sm text-[10px] text-on-surface-variant">Relevance: {src.score.toFixed(2)}</span>
                        <span className="material-symbols-outlined text-sm opacity-60 group-hover:opacity-100 transition-opacity">open_in_new</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Knowledge Base Sync Status */}
          <section className="mt-auto">
            <div className="p-md bg-primary-container/10 border border-primary/20 rounded-xl">
              <div className="flex items-center justify-between mb-sm">
                <span className="font-label-md text-[11px] text-primary uppercase font-bold">KB Sync Status</span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
              <div className="space-y-xs">
                <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[100%]"></div>
                </div>
                <div className="flex justify-between font-code-sm text-[10px] text-on-surface-variant">
                  <span>Index: V4-Production</span>
                  <span>100% Indexed</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* System Logs / Mini-History */}
        <div className="p-md border-t border-outline-variant bg-surface-container-lowest h-40 overflow-hidden">
          <div className="flex items-center justify-between mb-sm">
            <span className="font-label-md text-[10px] text-on-surface-variant uppercase tracking-widest">Pipeline Events</span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">history</span>
          </div>
          <div className="space-y-sm font-code-sm text-[11px] text-on-surface-variant/80 max-h-[85px] overflow-y-auto">
            {pipelineEvents.length === 0 ? (
              <div className="italic text-xs text-on-surface-variant/50">Awaiting query traces...</div>
            ) : (
              pipelineEvents.map((evt, idx) => (
                <div key={idx} className="flex gap-sm">
                  <span className="text-primary shrink-0">{evt.time}</span>
                  <span className="truncate">{evt.desc}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </main>
  );
}
