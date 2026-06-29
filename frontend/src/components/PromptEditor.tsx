import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';

interface PromptEditorProps {
  backendUrl: string;
}

export function PromptEditor({ backendUrl }: PromptEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchPrompt();
  }, []);

  const fetchPrompt = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/agent/prompt`);
      if (res.ok) {
        const data = await res.json();
        setPrompt(data.prompt);
      }
    } catch (e) {
      console.error('Error fetching prompt:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      const res = await fetch(`${backendUrl}/api/agent/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Error saving prompt:', e);
      setSaveStatus('error');
    }
  };

  return (
    <div className="glass-panel rounded-xl p-md flex flex-col gap-md">
      <div className="flex items-center gap-sm mb-base border-b border-outline-variant/30 pb-3">
        <Settings className="text-primary" size={18} />
        <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Agent Prompt Configuration</h2>
      </div>

      {loading ? (
        <div className="text-xs text-on-surface-variant italic">Loading system prompt...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            className="prompt-textarea"
            placeholder="Instruct the agent on how to behave..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            className="bg-primary hover:bg-primary-container text-on-primary font-label-md px-md py-2 rounded-lg active:scale-95 flex items-center justify-center gap-sm self-end"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            style={{ width: 'auto' }}
          >
            <Save size={16} />
            <span>
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'success' && 'Saved!'}
              {saveStatus === 'error' && 'Error saving'}
              {saveStatus === 'idle' && 'Save Prompt'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
