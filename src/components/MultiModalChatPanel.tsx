import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PaperAirplaneIcon,
  MicrophoneIcon,
  StopIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { multiModalAI, ChatMessage } from '../services/multiModalAI';
import { useNotifications } from './NotificationSystem';

interface MultiModalChatPanelProps {
  className?: string;
  codeContext?: {
    filePath?: string;
    selectedCode?: string;
    language?: string;
  };
}

export const MultiModalChatPanel: React.FC<MultiModalChatPanelProps> = ({
  className = '',
  codeContext,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { addNotification } = useNotifications();

  // Load messages and setup listeners
  useEffect(() => {
    setMessages(multiModalAI.getMessages());

    const unsubscribe = multiModalAI.onMessagesChanged((newMessages) => {
      setMessages(newMessages);
    });

    return unsubscribe;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle recording state
  useEffect(() => {
    setIsRecording(multiModalAI.isRecordingVoice());

    const interval = setInterval(() => {
      setIsRecording(multiModalAI.isRecordingVoice());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const sendTextMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const message = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      await multiModalAI.sendTextMessage(message, codeContext);
    } catch (error) {
      addNotification('error', 'Chat Error', {
        message: error instanceof Error ? error.message : 'Failed to send message',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, codeContext, addNotification]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const toggleVoiceRecording = useCallback(async () => {
    try {
      if (isRecording) {
        await multiModalAI.stopVoiceRecording();
        addNotification('info', 'Voice Recording', {
          message: 'Recording stopped, processing...',
          duration: 2000,
        });
      } else {
        await multiModalAI.startVoiceRecording();
        addNotification('info', 'Voice Recording', {
          message: 'Recording started, speak now...',
          duration: 2000,
        });
      }
    } catch (error) {
      addNotification('error', 'Voice Recording Error', {
        message: error instanceof Error ? error.message : 'Failed to toggle recording',
        duration: 3000,
      });
    }
  }, [isRecording, addNotification]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        addNotification('warning', 'Invalid File', {
          message: 'Please upload an image file',
          duration: 3000,
        });
        return;
      }

      setIsLoading(true);
      try {
        await multiModalAI.analyzeImage(file);
        addNotification('success', 'Image Analyzed', {
          message: 'Image has been processed and analyzed',
          duration: 2000,
        });
      } catch (error) {
        addNotification('error', 'Image Analysis Error', {
          message: error instanceof Error ? error.message : 'Failed to analyze image',
          duration: 3000,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [addNotification],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const toggleSpeaking = useCallback(
    (text: string) => {
      if (isSpeaking) {
        multiModalAI.stopSpeaking();
        setIsSpeaking(false);
      } else {
        multiModalAI.speakText(text);
        setIsSpeaking(true);
        // Reset speaking state after a delay
        setTimeout(() => setIsSpeaking(false), text.length * 50);
      }
    },
    [isSpeaking],
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addNotification('success', 'Copied', {
        message: 'Message copied to clipboard',
        duration: 1500,
      });
    } catch (error) {
      addNotification('error', 'Copy Failed', {
        message: 'Failed to copy to clipboard',
        duration: 2000,
      });
    }
  };

  const deleteMessage = (messageId: string) => {
    if (multiModalAI.deleteMessage(messageId)) {
      addNotification('info', 'Message Deleted', {
        message: 'Message has been removed',
        duration: 1500,
      });
    }
  };

  const clearChat = () => {
    multiModalAI.clearChat();
    addNotification('info', 'Chat Cleared', {
      message: 'All messages have been cleared',
      duration: 2000,
    });
  };

  const exportChat = () => {
    const data = multiModalAI.exportChat();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addNotification('success', 'Chat Exported', {
      message: 'Chat history has been downloaded',
      duration: 2000,
    });
  };

  const importChat = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (multiModalAI.importChat(content)) {
            addNotification('success', 'Chat Imported', {
              message: 'Chat history has been loaded',
              duration: 2000,
            });
          } else {
            addNotification('error', 'Import Failed', {
              message: 'Invalid chat file format',
              duration: 3000,
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div
          className={`max-w-[80%] rounded-lg p-4 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          }`}
        >
          {/* Message Content */}
          <div className="mb-2">
            {message.metadata?.hasImage && message.metadata.imageUrl && (
              <div className="mb-2">
                <img
                  src={message.metadata.imageUrl}
                  alt="Uploaded"
                  className="max-w-full h-auto rounded border max-h-48"
                />
              </div>
            )}

            {message.metadata?.hasVoice && message.metadata.voiceUrl && (
              <div className="mb-2">
                <audio controls className="w-full">
                  <source src={message.metadata.voiceUrl} type="audio/wav" />
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            <div className="whitespace-pre-wrap break-words">{message.content}</div>

            {message.metadata?.codeContext && (
              <div className="mt-2 p-2 bg-black bg-opacity-20 rounded text-xs">
                <div className="flex items-center gap-1 mb-1">
                  <CodeBracketIcon className="w-3 h-3" />
                  Code Context
                </div>
                {message.metadata.codeContext.filePath && (
                  <div>File: {message.metadata.codeContext.filePath}</div>
                )}
                {message.metadata.codeContext.language && (
                  <div>Language: {message.metadata.codeContext.language}</div>
                )}
              </div>
            )}

            {message.metadata?.hasWebSearch && message.metadata.searchResults && (
              <div className="mt-2 p-2 bg-black bg-opacity-20 rounded text-xs">
                <div className="flex items-center gap-1 mb-1">
                  <MagnifyingGlassIcon className="w-3 h-3" />
                  Web Search Results ({message.metadata.searchResults.length})
                </div>
                {message.metadata.searchResults.slice(0, 2).map((result, index) => (
                  <div key={index} className="mb-1">
                    <div className="font-medium">{result.title}</div>
                    <div className="opacity-75">{result.snippet}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Actions */}
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>{formatTimestamp(message.timestamp)}</span>

            <div className="flex items-center gap-1">
              {!isUser && multiModalAI.isSpeechSynthesisSupported() && (
                <button
                  onClick={() => toggleSpeaking(message.content)}
                  className="p-1 hover:bg-black hover:bg-opacity-20 rounded"
                  title={isSpeaking ? 'Stop Speaking' : 'Speak Message'}
                >
                  {isSpeaking ? (
                    <SpeakerXMarkIcon className="w-3 h-3" />
                  ) : (
                    <SpeakerWaveIcon className="w-3 h-3" />
                  )}
                </button>
              )}

              <button
                onClick={() => copyToClipboard(message.content)}
                className="p-1 hover:bg-black hover:bg-opacity-20 rounded"
                title="Copy Message"
              >
                <ClipboardDocumentIcon className="w-3 h-3" />
              </button>

              <button
                onClick={() => deleteMessage(message.id)}
                className="p-1 hover:bg-black hover:bg-opacity-20 rounded text-red-400"
                title="Delete Message"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`h-full flex flex-col bg-background ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Chat</h2>
          {codeContext && (
            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
              <CodeBracketIcon className="w-3 h-3" />
              Context: {codeContext.language || 'Code'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={importChat}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Import Chat"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
          </button>

          <button
            onClick={exportChat}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Export Chat"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
          </button>

          <button
            onClick={clearChat}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-red-600"
            title="Clear Chat"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <DocumentTextIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Start a Conversation</p>
            <p className="text-sm text-center max-w-md">
              Ask questions, upload images, use voice input, or get help with your code. I can
              search the web, analyze images, and provide coding assistance.
            </p>

            {codeContext && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-2">
                  <CodeBracketIcon className="w-4 h-4" />
                  <span className="font-medium">Code Context Available</span>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {codeContext.filePath && <div>File: {codeContext.filePath}</div>}
                  {codeContext.language && <div>Language: {codeContext.language}</div>}
                  {codeContext.selectedCode && (
                    <div>Selected: {codeContext.selectedCode.length} characters</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </>
        )}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-gray-600 dark:text-gray-400">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-10">
          <div className="bg-panel rounded-lg p-6 shadow-xl">
            <PhotoIcon className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <p className="text-lg font-medium text-center">Drop image to analyze</p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end gap-2">
          {/* Voice Recording Button */}
          <button
            onClick={toggleVoiceRecording}
            disabled={!multiModalAI.isSpeechSupported() || isLoading}
            className={`p-3 rounded-lg transition-colors ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
          >
            {isRecording ? (
              <StopIcon className="w-5 h-5" />
            ) : (
              <MicrophoneIcon className="w-5 h-5" />
            )}
          </button>

          {/* Image Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload Image"
          >
            <PhotoIcon className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Shift+Enter for new line)"
              disabled={isLoading}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50 min-h-12 max-h-30"
              rows={1}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={sendTextMessage}
            disabled={!inputText.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send Message"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Capabilities Info */}
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <MicrophoneIcon className="w-3 h-3" />
            Voice {multiModalAI.isSpeechSupported() ? 'enabled' : 'disabled'}
          </div>
          <div className="flex items-center gap-1">
            <PhotoIcon className="w-3 h-3" />
            Image analysis
          </div>
          <div className="flex items-center gap-1">
            <MagnifyingGlassIcon className="w-3 h-3" />
            Web search
          </div>
          <div className="flex items-center gap-1">
            <SpeakerWaveIcon className="w-3 h-3" />
            Text-to-speech {multiModalAI.isSpeechSynthesisSupported() ? 'enabled' : 'disabled'}
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        title="Upload image file"
        aria-label="Upload image file for analysis"
      />
    </div>
  );
};

export default MultiModalChatPanel;
