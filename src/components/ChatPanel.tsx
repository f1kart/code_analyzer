import React, { useState, useRef, useEffect } from 'react';
import { SummaryDisplay } from './SummaryDisplay';
import { LoadingSpinner } from './LoadingSpinner';
import { ModelConfig } from '../utils/sessionManager';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { SearchResultsDisplay } from './SearchResultsDisplay';
import { Message } from '../services/geminiService';
import { TerminalDisplay } from './TerminalDisplay';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { SnippetIcon } from './icons/SnippetIcon';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string, imageBase64?: string) => void;
  isLoading: boolean;
  onApplyEdit: (code: string) => void;
  onInsertSnippet: (code: string) => void;
  availableModels: ModelConfig[];
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}

const parseCodeFromMessage = (content: string): string | null => {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]+?)\n```/;
  const match = content.match(codeBlockRegex);
  return match ? match[1] : null;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onApplyEdit,
  onInsertSnippet,
  availableModels,
  selectedModelId,
  onModelChange,
}) => {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ file: File | null; base64: string | null }>({
    file: null,
    base64: null,
  });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || image.file) && !isLoading) {
      onSendMessage(input, image.base64 || undefined);
      setInput('');
      setImage({ file: null, base64: null });
    }
  };

  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      setImage({ file, base64 });
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        setInput((prev) => prev + finalTranscript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }

    recognitionRef.current.start();
    setIsListening(true);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* COMPACT HEADER */}
      <div className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🤖</span> AI Chat
          </h3>
        </div>
        <select
          aria-label="Model selection"
          value={selectedModelId}
          onChange={(e) => onModelChange(e.target.value)}
          className="bg-white/20 border border-white/30 rounded-lg py-1 px-2 text-xs text-white font-medium hover:bg-white/30 transition-all"
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id} className="text-gray-900">
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {/* COMPACT MESSAGES AREA */}
      <div className="flex-grow p-2 overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-4">
            👋 Start chatting with AI
          </div>
        )}
        {messages.map((msg, index) => {
          const codeToApply = msg.author === 'model' ? parseCodeFromMessage(msg.content) : null;

          if (msg.terminalOutput) {
            return <TerminalDisplay key={index} output={msg.terminalOutput} />;
          }

          return (
            <div
              key={index}
              className={`flex flex-col ${msg.author === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[95%] rounded-xl px-3 py-2 text-sm ${msg.author === 'user' ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white' : 'bg-slate-800 border border-slate-700 text-gray-200'}`}
              >
                {msg.image && (
                  <img src={msg.image} alt="User attachment" className="rounded-lg mb-1 max-w-[200px]" />
                )}
                {msg.toolUse && (
                  <div className="text-[10px] text-gray-400 italic border-b border-slate-700 mb-1 pb-1">
                    ⚙️ {msg.toolUse.name}...
                  </div>
                )}
                <SummaryDisplay
                  summary={msg.content + (isLoading && index === messages.length - 1 ? '...' : '')}
                />
                {msg.searchResults && <SearchResultsDisplay results={msg.searchResults} />}
              </div>
              {msg.suggestedSnippets && msg.suggestedSnippets.length > 0 && (
                <div className="mt-1 p-2 bg-slate-800 rounded-lg border border-slate-700 w-full">
                  <h5 className="text-[10px] font-bold flex items-center gap-1 text-gray-400 mb-1">
                    <SnippetIcon className="w-3 h-3" /> Snippets
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {msg.suggestedSnippets.map((snippet) => (
                      <button
                        key={snippet.id}
                        onClick={() => onInsertSnippet(snippet.code)}
                        className="px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 rounded-md text-white"
                        title={`Insert "${snippet.title}"`}
                      >
                        {snippet.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {codeToApply && (
                <button
                  onClick={() => onApplyEdit(codeToApply)}
                  className="mt-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow"
                >
                  ✓ Apply
                </button>
              )}
            </div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.author === 'user' && (
          <div className="flex items-start">
            <div className="rounded-xl px-3 py-2 bg-slate-800 border border-slate-700">
              <LoadingSpinner />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* COMPACT INPUT AREA */}
      <div className="p-2 border-t-2 border-slate-800 bg-slate-900">
        <form onSubmit={handleSend} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg hover:bg-slate-700 transition-all"
            title="Attach Image"
          >
            <PaperclipIcon className="w-4 h-4 text-gray-400" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageAttach}
            accept="image/*"
            className="hidden"
            aria-label="Attach image file"
            title="Attach image file"
          />

          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                image.file
                  ? `📎 ${image.file.name}`
                  : isListening
                    ? '🎤 Listening...'
                    : 'Ask AI...'
              }
              disabled={isLoading}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 pl-2 pr-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              aria-label="Chat input"
            />
            {image.base64 && (
              <button
                type="button"
                onClick={() => setImage({ file: null, base64: null })}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                &times;
              </button>
            )}
            <button
              type="button"
              onClick={handleMicClick}
              className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-700 ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}
              title="Use Voice"
            >
              <MicrophoneIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !image.file)}
            className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-all"
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  );
};
