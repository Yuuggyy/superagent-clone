// llm.js — Multi-provider support
// Supporte: Groq (gratuit, rapide), OpenAI, OpenRouter, Mistral, ou tout endpoint compatible OpenAI

import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Configuration des providers
const PROVIDERS = {
  groq: {
    name: 'Groq (FREE — Llama 3.3 70B)',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'deepseek-r1-distill-llama-70b'],
    free: true,
    supportsTools: true,
    supportsImages: false,
    signup: 'https://console.groq.com'
  },
  openrouter: {
    name: 'OpenRouter (free models disponibles)',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-7b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-r1:free'],
    free: true,
    supportsTools: true,
    supportsImages: true,
    signup: 'https://openrouter.ai'
  },
  mistral: {
    name: 'Mistral (free tier — européen)',
    baseURL: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'],
    free: false,
    supportsTools: true,
    supportsImages: false,
    signup: 'https://console.mistral.ai'
  },
  openai: {
    name: 'OpenAI (payant, guardrails)',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
    free: false,
    supportsTools: true,
    supportsImages: true,
    signup: 'https://platform.openai.com'
  },
  together: {
    name: 'Together AI (free credits)',
    baseURL: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHER_API_KEY',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
    free: true,
    supportsTools: true,
    supportsImages: false,
    signup: 'https://api.together.ai'
  },
  ollama: {
    name: 'Ollama (LOCAL — 100% gratuit, sur ton PC)',
    baseURL: 'http://localhost:11434/v1',
    apiKeyEnv: 'OLLAMA_API_KEY',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'llama3.1:8b', 'mistral', 'qwen2.5:7b', 'deepseek-r1:7b'],
    free: true,
    supportsTools: false,
    supportsImages: false,
    signup: 'https://ollama.com'
  }
};

// Détecter quel provider est configuré
export function getActiveProvider() {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();

  // Si un provider est explicitement défini, l'utiliser
  if (explicit && PROVIDERS[explicit]) {
    const provider = PROVIDERS[explicit];
    const apiKey = process.env[provider.apiKeyEnv] || (explicit === 'ollama' ? 'ollama' : '');
    return { key: explicit, ...provider, apiKey };
  }

  // Auto-détection : trouver le premier provider avec une clé API
  const order = ['groq', 'openrouter', 'together', 'mistral', 'openai', 'ollama'];
  for (const key of order) {
    const provider = PROVIDERS[key];
    const apiKey = process.env[provider.apiKeyEnv];
    if (apiKey || key === 'ollama') {
      return { key, ...provider, apiKey: apiKey || 'ollama' };
    }
  }

  return null;
}

// Créer le client LLM
export function createLLMClient() {
  const provider = getActiveProvider();
  if (!provider) {
    return { client: null, provider: null, error: 'Aucun provider configuré. Ajoute une clé API dans .env (Groq recommandé — gratuit).' };
  }

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });

  return { client, provider, error: null };
}

// Lister tous les providers disponibles
export function listProviders() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({
    key,
    name: p.name,
    free: p.free,
    models: p.models,
    defaultModel: p.defaultModel,
    apiKeyEnv: p.apiKeyEnv,
    signup: p.signup,
    configured: !!process.env[p.apiKeyEnv] || key === 'ollama',
    supportsTools: p.supportsTools,
    supportsImages: p.supportsImages
  }));
}

export { PROVIDERS };
