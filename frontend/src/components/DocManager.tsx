import React, { useState, useEffect, useRef } from 'react';
import { FileText, Trash2, Upload, AlertCircle } from 'lucide-react';

interface Document {
  docId: string;
  docName: string;
  chunksCount: number;
}

interface DocManagerProps {
  backendUrl: string;
}

export function DocManager({ backendUrl }: DocManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      console.error('Error fetching documents:', e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload document.');
      }

      await fetchDocuments();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Connection error during file upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/documents/${docId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.docId !== docId));
      }
    } catch (e) {
      console.error('Error deleting document:', e);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="glass-panel rounded-xl p-md flex flex-col gap-md">
      <div className="flex items-center gap-sm mb-base">
        <span className="material-symbols-outlined text-tertiary">database</span>
        <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Knowledge Base Ingestion</h2>
      </div>

      <div
        className="border-2 border-dashed border-outline-variant rounded-xl p-xl flex flex-col items-center justify-center gap-md hover:border-primary/50 transition-colors cursor-pointer group bg-surface-container-low/30"
        onClick={triggerFileSelect}
        style={{ pointerEvents: uploading ? 'none' : 'auto', opacity: uploading ? 0.6 : 1 }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          accept=".pdf,.txt,.md"
          style={{ display: 'none' }}
        />
        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center group-hover:bg-primary-container transition-colors">
          <Upload className="text-on-surface-variant group-hover:text-on-primary-container" size={20} />
        </div>
        <div className="text-center">
          <p className="font-label-md text-on-surface">
            {uploading ? 'Processing & Embedding...' : 'Click to Upload Document'}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">Supports PDF, TXT, MD (Max 10MB)</p>
        </div>
      </div>

      {error && (
        <div className="text-error text-xs flex items-center gap-xs">
          <AlertCircle size={14} className="text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      <div className="mt-md">
        <p className="text-xs font-bold text-on-surface-variant mb-sm uppercase tracking-tight">
          Ingested Documents ({documents.length})
        </p>
        {documents.length === 0 ? (
          <div className="text-xs text-on-surface-variant italic py-sm">
            No documents ingested yet. Upload files to enable RAG.
          </div>
        ) : (
          <div className="space-y-sm max-h-[220px] overflow-y-auto pr-1">
            {documents.map((doc) => (
              <div 
                key={doc.docId} 
                className="bg-surface-container-highest/50 rounded-lg border border-outline-variant p-sm flex items-center justify-between group hover:border-tertiary/50 transition-colors"
              >
                <div className="flex items-center gap-sm min-w-0">
                  <FileText className="text-tertiary shrink-0" size={16} />
                  <span className="font-label-md text-on-surface truncate max-w-[180px]" title={doc.docName}>
                    {doc.docName}
                  </span>
                </div>
                <div className="flex items-center gap-md shrink-0">
                  <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">
                    {doc.chunksCount} chunks
                  </span>
                  <button 
                    className="text-on-surface-variant hover:text-red-400 transition-colors flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.docId);
                    }}
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
