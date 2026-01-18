/**
 * Free AI API Fallback Service
 * Provides fallback AI providers when Gemini quota is exceeded
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

import { logDebug } from '../utils/logging';

// Free AI Provider configurations
export interface FreeAIProvider {
  name: string;
  endpoint: string;
  model: string;
  requiresKey: boolean;
  freeLimit: string;
  priority: number;
}

// Available free AI providers (ordered by priority)
export const FREE_AI_PROVIDERS: FreeAIProvider[] = [
  {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile', // Free, fast, good for code
    requiresKey: true,
    freeLimit: '6000 requests/day',
    priority: 1
  },
  {
    name: 'Together AI',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    requiresKey: true,
    freeLimit: '$25 free credits',
    priority: 2
  },
  {
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.2-3b-instruct:free', // Free model
    requiresKey: true,
    freeLimit: 'Free models available',
    priority: 3
  },
  {
    name: 'Hugging Face',
    endpoint: 'https://api-inference.huggingface.co/models/codellama/CodeLlama-34b-Instruct-hf',
    model: 'CodeLlama-34b-Instruct',
    requiresKey: true,
    freeLimit: 'Rate limited free tier',
    priority: 4
  }
];

// API key storage with localStorage persistence
const STORAGE_KEY = 'gemini-ide-free-ai-keys';
const apiKeys: Record<string, string> = {};

// Load saved keys on module initialization
function loadSavedKeys(): void {
  try {
    // First, load from environment variables (Vite exposes these with VITE_ prefix)
    // Cast import.meta as any for TypeScript compatibility
    const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
    const envKeys: Record<string, string | undefined> = {
      groq: env.VITE_GROQ_API_KEY || env.GROQ_API_KEY,
      openrouter: env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY,
      'together ai': env.VITE_TOGETHER_API_KEY || env.TOGETHER_API_KEY,
      'hugging face': env.VITE_HUGGINGFACE_API_KEY || env.HUGGINGFACE_API_KEY,
    };
    
    for (const [provider, key] of Object.entries(envKeys)) {
      if (key) {
        apiKeys[provider] = key;
        logDebug(`[FreeAIFallback] Loaded ${provider} API key from environment`);
      }
    }
    
    // Then load from localStorage (can override env vars)
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(apiKeys, parsed);
        logDebug(`[FreeAIFallback] Loaded ${Object.keys(parsed).length} saved API keys from localStorage`);
      }
    }
    
    const configuredCount = Object.keys(apiKeys).length;
    if (configuredCount > 0) {
      console.log(`[FreeAIFallback] ${configuredCount} fallback provider(s) configured: ${Object.keys(apiKeys).join(', ')}`);
    }
  } catch (error) {
    console.warn('[FreeAIFallback] Failed to load saved API keys:', error);
  }
}

// Save keys to localStorage
function saveKeys(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
    }
  } catch (error) {
    console.warn('[FreeAIFallback] Failed to save API keys:', error);
  }
}

// Initialize on load
loadSavedKeys();

// Expose to window for easy configuration from browser console
if (typeof window !== 'undefined') {
  (window as any).setFreeAIKey = (provider: string, key: string) => {
    setProviderApiKey(provider, key);
    console.log(`✓ ${provider} API key saved. The pipeline will now use ${provider} as a fallback when Gemini quota is exceeded.`);
  };
  
  (window as any).listFreeAIProviders = () => {
    console.log('\n=== Free AI Providers ===\n');
    FREE_AI_PROVIDERS.forEach(p => {
      const configured = isProviderConfigured(p);
      console.log(`${configured ? '✓' : '○'} ${p.name} (${p.freeLimit}) ${configured ? '- CONFIGURED' : ''}`);
    });
    console.log('\nTo add a key, run: setFreeAIKey("ProviderName", "your-api-key")');
    console.log('\nFree API key links:');
    console.log('- Groq: https://console.groq.com/keys');
    console.log('- Together AI: https://api.together.xyz/settings/api-keys');
    console.log('- OpenRouter: https://openrouter.ai/keys');
    console.log('- Hugging Face: https://huggingface.co/settings/tokens\n');
  };
  
  console.log('[FreeAIFallback] Free AI fallback system loaded. Run listFreeAIProviders() to see available providers.');
}

/**
 * Set API key for a provider
 */
export function setProviderApiKey(providerName: string, apiKey: string): void {
  apiKeys[providerName.toLowerCase()] = apiKey;
  saveKeys();
  logDebug(`[FreeAIFallback] API key set for ${providerName}`);
  console.log(`[FreeAIFallback] ✓ API key configured for ${providerName}`);
}

/**
 * Get API key for a provider
 */
export function getProviderApiKey(providerName: string): string | undefined {
  return apiKeys[providerName.toLowerCase()];
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(provider: FreeAIProvider): boolean {
  if (!provider.requiresKey) return true;
  return !!getProviderApiKey(provider.name);
}

/**
 * Get available (configured) providers
 */
export function getAvailableProviders(): FreeAIProvider[] {
  return FREE_AI_PROVIDERS.filter(isProviderConfigured).sort((a, b) => a.priority - b.priority);
}

/**
 * Message format for chat completions
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Call a free AI provider
 */
export async function callFreeAI(
  provider: FreeAIProvider,
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const apiKey = getProviderApiKey(provider.name);
  
  if (provider.requiresKey && !apiKey) {
    throw new Error(`API key not configured for ${provider.name}. Get a free key at their website.`);
  }

  logDebug(`[FreeAIFallback] Calling ${provider.name} with model ${provider.model}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Special handling for different providers
  if (provider.name === 'OpenRouter') {
    headers['HTTP-Referer'] = 'https://gemini-code-ide.local';
    headers['X-Title'] = 'Gemini Code IDE';
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    })),
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096
  };

  // Hugging Face uses different format
  if (provider.name === 'Hugging Face') {
    const prompt = messages.map(m => 
      m.role === 'system' ? `System: ${m.content}` :
      m.role === 'user' ? `User: ${m.content}` :
      `Assistant: ${m.content}`
    ).join('\n\n');

    const hfResponse = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: options?.temperature ?? 0.7,
          max_new_tokens: options?.maxTokens ?? 4096,
          return_full_text: false
        }
      })
    });

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();
      throw new Error(`Hugging Face API error: ${hfResponse.status} - ${errorText}`);
    }

    const hfResult = await hfResponse.json();
    return Array.isArray(hfResult) ? hfResult[0]?.generated_text || '' : hfResult.generated_text || '';
  }

  // Standard OpenAI-compatible format (Groq, Together, OpenRouter)
  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.name} API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

/**
 * Try all available free providers in order
 */
export async function callFreeAIWithFallback(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<{ response: string; provider: string }> {
  const providers = getAvailableProviders();
  
  if (providers.length === 0) {
    throw new Error(
      'No free AI providers configured. Please add an API key for one of: ' +
      FREE_AI_PROVIDERS.map(p => p.name).join(', ') +
      '\n\nFree API keys available at:\n' +
      '- Groq: https://console.groq.com/keys (recommended, fastest)\n' +
      '- Together AI: https://api.together.xyz/settings/api-keys\n' +
      '- OpenRouter: https://openrouter.ai/keys\n' +
      '- Hugging Face: https://huggingface.co/settings/tokens'
    );
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      console.log(`[FreeAIFallback] Trying ${provider.name}...`);
      console.log(`[FreeAIFallback] Endpoint: ${provider.endpoint}`);
      console.log(`[FreeAIFallback] Model: ${provider.model}`);
      console.log(`[FreeAIFallback] API Key configured: ${!!getProviderApiKey(provider.name)}`);
      
      const response = await callFreeAI(provider, messages, options);
      console.log(`[FreeAIFallback] ✓ Success with ${provider.name}, response length: ${response.length}`);
      return { response, provider: provider.name };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.name}: ${errorMsg}`);
      console.error(`[FreeAIFallback] ✗ ${provider.name} failed:`, errorMsg);
      continue;
    }
  }

  throw new Error(
    'All free AI providers failed:\n' + errors.join('\n') +
    '\n\nPlease check your API keys or try again later.'
  );
}

/**
 * Convert Gemini-style messages to standard chat format
 */
export function convertGeminiMessages(
  geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }>
): ChatMessage[] {
  return geminiMessages.map((msg, index) => {
    const content = msg.parts.map(p => p.text).join('\n');
    
    // First message is often the system prompt
    if (index === 0 && msg.role === 'user') {
      return { role: 'system' as const, content };
    }
    
    return {
      role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
      content
    };
  });
}

/**
 * Check if error is a quota/rate limit error
 */
export function isQuotaOrRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource_exhausted') ||
    message.includes('429') ||
    message.includes('too many requests')
  );
}
