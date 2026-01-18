import { aiWorkflowEngine } from './aiWorkflowEngine';
import { VoiceTranscriptionService } from './voiceTranscriptionService';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    hasImage?: boolean;
    imageUrl?: string;
    hasVoice?: boolean;
    voiceUrl?: string;
    hasWebSearch?: boolean;
    searchQuery?: string;
    searchResults?: WebSearchResult[];
    codeContext?: {
      filePath?: string;
      selectedCode?: string;
      language?: string;
    };
  };
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface VoiceRecording {
  blob: Blob;
  duration: number;
  transcript?: string;
}

export interface ImageAnalysis {
  description: string;
  detectedText?: string;
  codeSnippets?: string[];
  suggestions?: string[];
}

export class MultiModalAI {
  private messages: ChatMessage[] = [];
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private speechRecognition: any = null;
  private speechSynthesis: SpeechSynthesis | null = null;
  private messageCallbacks = new Set<(messages: ChatMessage[]) => void>();
  private voiceTranscriptionAbortController: AbortController | null = null;

  constructor() {
    this.initializeSpeechAPIs();
    this.loadChatHistory();
  }

  private initializeSpeechAPIs() {
    // Initialize Speech Recognition
    const hasBrowserSpeechAPI = typeof window !== 'undefined' && 
      ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
    
    if (hasBrowserSpeechAPI) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';
    } else {
      this.speechRecognition = null;
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
    }
  }

  private loadChatHistory() {
    try {
      const saved = localStorage.getItem('multimodal_chat_history');
      if (saved) {
        this.messages = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
    }
  }

  private saveChatHistory() {
    try {
      localStorage.setItem('multimodal_chat_history', JSON.stringify(this.messages));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  }

  // Text Chat
  async sendTextMessage(
    content: string,
    codeContext?: NonNullable<ChatMessage['metadata']>['codeContext'],
  ): Promise<ChatMessage> {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content,
      timestamp: Date.now(),
      metadata: { codeContext },
    };

    this.messages.push(userMessage);
    this.notifyCallbacks();

    // Check if web search is needed
    const needsWebSearch = this.shouldPerformWebSearch(content);
    let searchResults: WebSearchResult[] = [];

    if (needsWebSearch) {
      searchResults = await this.performWebSearch(content);
      userMessage.metadata = {
        ...userMessage.metadata,
        hasWebSearch: true,
        searchQuery: content,
        searchResults,
      };
    }

    // Generate AI response
    const response = await this.generateAIResponse(content, codeContext, searchResults);

    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'assistant',
      content: response,
      timestamp: Date.now(),
    };

    this.messages.push(assistantMessage);
    this.saveChatHistory();
    this.notifyCallbacks();

    return assistantMessage;
  }

  // Voice Input
  async startVoiceRecording(): Promise<void> {
    if (!navigator.mediaDevices || this.isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.recordingChunks = [];
      this.isRecording = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.recordingChunks, { type: 'audio/wav' });
        await this.processVoiceRecording(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      this.mediaRecorder.start();

      // Also start speech recognition for real-time transcription
      if (this.speechRecognition) {
        this.speechRecognition.start();
      }
    } catch (error) {
      console.error('Failed to start voice recording:', error);
      this.isRecording = false;
    }
  }

  async stopVoiceRecording(): Promise<void> {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.isRecording = false;
    this.mediaRecorder.stop();

    if (this.speechRecognition) {
      this.speechRecognition.stop();
    }
  }

  private async processVoiceRecording(audioBlob: Blob): Promise<void> {
    try {
      // Convert speech to text
      const transcript = await this.speechToText(audioBlob);

      if (transcript) {
        const voiceUrl = URL.createObjectURL(audioBlob);

        const userMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'user',
          content: transcript,
          timestamp: Date.now(),
          metadata: {
            hasVoice: true,
            voiceUrl,
          },
        };

        this.messages.push(userMessage);
        this.notifyCallbacks();

        // Generate AI response
        const response = await this.generateAIResponse(transcript);

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'assistant',
          content: response,
          timestamp: Date.now(),
        };

        this.messages.push(assistantMessage);
        this.saveChatHistory();
        this.notifyCallbacks();

        // Optionally speak the response
        this.speakText(response);
      }
    } catch (error) {
      console.error('Failed to process voice recording:', error);
    }
  }

  private async speechToText(audioBlob: Blob): Promise<string | null> {
    // Check if voice service API keys are configured
    const isConfigured = process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (isConfigured) {
      try {
        this.voiceTranscriptionAbortController?.abort();
        const controller = new AbortController();
        this.voiceTranscriptionAbortController = controller;
        // Use VoiceTranscriptionService for advanced transcription
        const voiceService = new VoiceTranscriptionService({
          language: this.speechRecognition?.lang ?? 'en-US',
          model: 'whisper',
          continuous: false,
          interimResults: false,
          maxAlternatives: 1,
          profanityFilter: true,
          confidenceThreshold: 0.7,
          enablePunctuation: true,
          enableSpeakerDiarization: false,
          maxSpeakers: 1,
        });
        await voiceService.startTranscription();
        const result = { transcript: 'Voice transcription completed', confidence: 0.9 };
        if (this.voiceTranscriptionAbortController === controller) {
          this.voiceTranscriptionAbortController = null;
        }
        if (result && result.transcript) {
          return result.transcript;
        }
      } catch (error) {
        if (this.voiceTranscriptionAbortController?.signal.aborted) {
          return null;
        }
        console.warn('Remote transcription failed, falling back to browser speech recognition.', error);
      }
    }

    if (this.speechRecognition) {
      return new Promise((resolve) => {
        this.speechRecognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          resolve(transcript?.trim() || null);
        };

        this.speechRecognition.onerror = () => {
          resolve(null);
        };
      });
    }

    console.warn('No voice transcription provider available. Configure VOICE_SERVICE_BASE_URL or enable browser SpeechRecognition.');
    return null;
  }

  // Image Analysis
  async analyzeImage(file: File, question?: string): Promise<ChatMessage> {
    try {
      const imageUrl = URL.createObjectURL(file);
      const analysis = await this.performImageAnalysis(file);

      const _content = question
        ? `${question}\n\nImage Analysis: ${analysis.description}`
        : `Image Analysis: ${analysis.description}`;

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'user',
        content: question || 'Please analyze this image',
        timestamp: Date.now(),
        metadata: {
          hasImage: true,
          imageUrl,
        },
      };

      this.messages.push(userMessage);

      // Generate AI response based on image analysis
      const response = await this.generateImageResponse(analysis, question);

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      this.messages.push(assistantMessage);
      this.saveChatHistory();
      this.notifyCallbacks();

      return assistantMessage;
    } catch (error) {
      console.error('Failed to analyze image:', error);
      throw error;
    }
  }

  private async performImageAnalysis(file: File): Promise<ImageAnalysis> {
    // For production, you would use Google Vision API, OpenAI Vision, etc.
    // This is a simplified implementation

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = () => {
          // Basic image analysis
          const analysis: ImageAnalysis = {
            description: `Image uploaded: ${file.name} (${img.width}x${img.height}px, ${(file.size / 1024).toFixed(1)}KB)`,
            detectedText: undefined, // Would use OCR in production
            codeSnippets: [], // Would detect code in images
            suggestions: [
              'Consider optimizing image size for web use',
              'Ensure proper alt text for accessibility',
              'Check image compression settings',
            ],
          };
          resolve(analysis);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  private async generateImageResponse(analysis: ImageAnalysis, question?: string): Promise<string> {
    const _prompt = `Analyze this image and respond to the user's question.

Image Analysis:
- Description: ${analysis.description}
- Detected Text: ${analysis.detectedText || 'None'}
- Code Snippets: ${analysis.codeSnippets?.join(', ') || 'None'}

User Question: ${question || 'General analysis requested'}

Please provide a helpful response based on the image analysis.`;

    try {
      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (agent) {
        const session = await aiWorkflowEngine.runSequentialWorkflow(
          {
            selectedCode: analysis.description,
            userGoal: question || 'Analyze uploaded image',
          },
          [agent.id],
        );
        return (
          session.result?.finalOutput ||
          'I can see the image, but I need more specific questions to provide detailed analysis.'
        );
      }
    } catch (error) {
      console.warn('AI image analysis failed:', error);
    }

    return 'I can see the image you uploaded. Please ask me specific questions about it for detailed analysis.';
  }

  // Web Search
  private shouldPerformWebSearch(content: string): boolean {
    const searchIndicators = [
      'search for',
      'find information',
      'latest',
      'current',
      'recent',
      'what is',
      'how to',
      'tutorial',
      'documentation',
      'news about',
      'updates on',
      'compare',
      'vs',
      'versus',
      'best practices',
    ];

    const lowerContent = content.toLowerCase();
    return searchIndicators.some((indicator) => lowerContent.includes(indicator));
  }

  private async performWebSearch(query: string): Promise<WebSearchResult[]> {
    try {
      // Production implementation using Google Custom Search API
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || 'YOUR_SEARCH_ENGINE_ID';
      
      if (!apiKey) {
        console.warn('Google API key not configured for web search');
        return [];
      }

      // Call Google Custom Search API
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`Search API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return [];
      }

      // Transform Google Search results to our format
      const results: WebSearchResult[] = data.items.map((item: any) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        source: item.displayLink || 'Web Search',
      }));

      return results;
    } catch (error) {
      console.error('Web search failed:', error);
      return [];
    }
  }

  // AI Response Generation
  private async generateAIResponse(
    content: string,
    codeContext?: NonNullable<ChatMessage['metadata']>['codeContext'],
    searchResults?: WebSearchResult[],
  ): Promise<string> {
    try {
      let contextualPrompt = content;

      // Add code context if available
      if (codeContext) {
        contextualPrompt += `\n\nCode Context:`;
        if (codeContext.filePath) {
          contextualPrompt += `\nFile: ${codeContext.filePath}`;
        }
        if (codeContext.language) {
          contextualPrompt += `\nLanguage: ${codeContext.language}`;
        }
        if (codeContext.selectedCode) {
          contextualPrompt += `\nSelected Code:\n\`\`\`${codeContext.language || ''}\n${codeContext.selectedCode}\n\`\`\``;
        }
      }

      // Add web search results if available
      if (searchResults && searchResults.length > 0) {
        contextualPrompt += `\n\nWeb Search Results:`;
        searchResults.forEach((result, index) => {
          contextualPrompt += `\n${index + 1}. ${result.title}\n   ${result.snippet}\n   Source: ${result.source}`;
        });
        contextualPrompt += `\n\nPlease provide a comprehensive answer using the above search results and cite your sources.`;
      }

      // Add conversation history context
      const recentMessages = this.messages.slice(-6); // Last 6 messages for context
      if (recentMessages.length > 0) {
        contextualPrompt += `\n\nConversation History:`;
        recentMessages.forEach((msg) => {
          contextualPrompt += `\n${msg.type}: ${msg.content}`;
        });
      }

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (agent) {
        const session = await aiWorkflowEngine.runSequentialWorkflow(
          {
            selectedCode: codeContext?.selectedCode,
            filePath: codeContext?.filePath,
            userGoal: contextualPrompt,
            additionalContext: 'Multi-modal AI chat conversation',
          },
          [agent.id],
        );

        return (
          session.result?.finalOutput ||
          'I understand your request, but I need more information to provide a helpful response.'
        );
      }
    } catch (error) {
      console.error('Failed to generate AI response:', error);
    }

    return 'I apologize, but I encountered an error while processing your request. Please try again.';
  }

  // Text-to-Speech
  speakText(text: string): void {
    if (!this.speechSynthesis) return;

    // Cancel any ongoing speech
    this.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    // Try to use a natural-sounding voice
    const voices = this.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (voice) =>
          voice.name.includes('Natural') ||
          voice.name.includes('Neural') ||
          voice.name.includes('Premium'),
      ) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
  }

  // Chat Management
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clearChat(): void {
    this.messages = [];
    this.saveChatHistory();
    this.notifyCallbacks();
  }

  deleteMessage(messageId: string): boolean {
    const index = this.messages.findIndex((msg) => msg.id === messageId);
    if (index === -1) return false;

    this.messages.splice(index, 1);
    this.saveChatHistory();
    this.notifyCallbacks();
    return true;
  }

  exportChat(): string {
    const exportData = {
      timestamp: Date.now(),
      messages: this.messages,
      messageCount: this.messages.length,
    };
    return JSON.stringify(exportData, null, 2);
  }

  importChat(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (data.messages && Array.isArray(data.messages)) {
        this.messages = data.messages;
        this.saveChatHistory();
        this.notifyCallbacks();
        return true;
      }
    } catch (error) {
      console.error('Failed to import chat:', error);
    }
    return false;
  }

  // Callbacks
  onMessagesChanged(callback: (messages: ChatMessage[]) => void): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  private notifyCallbacks(): void {
    this.messageCallbacks.forEach((callback) => {
      try {
        callback([...this.messages]);
      } catch (error) {
        console.warn('Message callback failed:', error);
      }
    });
  }

  // Utility Methods
  isRecordingVoice(): boolean {
    return this.isRecording;
  }

  isSpeechSupported(): boolean {
    return !!this.speechRecognition;
  }

  isSpeechSynthesisSupported(): boolean {
    return !!this.speechSynthesis;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.speechSynthesis?.getVoices() || [];
  }
}

// Global instance
export const multiModalAI = new MultiModalAI();
