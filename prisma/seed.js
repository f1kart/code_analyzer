/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
// prisma/seed.js
// Idempotent seeding of ModelProvider records from environment.
// Reads env for common providers and creates entries only if none exist with same (provider,name,modelId).

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function envStr(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function buildProvidersFromEnv() {
  const results = [];

  // Gemini
  const gemApi = envStr('API_KEY') || envStr('GEMINI_API_KEY');
  if (gemApi) {
    results.push({
      name: 'Gemini Default',
      provider: 'gemini',
      baseUrl: null,
      apiKeyRef: envStr('API_KEY') ? 'API_KEY' : 'GEMINI_API_KEY',
      modelId: envStr('GEMINI_MODEL') || 'gemini-2.5-flash',
    });
  }

  // OpenAI
  const oaiKey = envStr('OPENAI_API_KEY') || envStr('OAI_API_KEY');
  if (oaiKey) {
    results.push({
      name: 'OpenAI Default',
      provider: 'openai',
      baseUrl: envStr('OPENAI_BASE_URL') || null,
      apiKeyRef: envStr('OPENAI_API_KEY') ? 'OPENAI_API_KEY' : 'OAI_API_KEY',
      modelId: envStr('OPENAI_MODEL') || 'gpt-4o-mini',
    });
  }

  // Local (Ollama)
  const ollamaUrl = envStr('OLLAMA_BASE_URL') || envStr('LOCAL_LLM_BASE_URL');
  if (ollamaUrl) {
    results.push({
      name: 'Ollama Local',
      provider: 'ollama',
      baseUrl: ollamaUrl,
      apiKeyRef: null,
      modelId: envStr('OLLAMA_MODEL') || 'llama3.1:8b',
    });
  }

  return results;
}

async function upsertProvider(p) {
  // We will match on unique triple (provider, name, modelId) for idempotency
  const existing = await prisma.modelProvider.findFirst({
    where: { provider: p.provider, name: p.name, modelId: p.modelId },
  });
  if (existing) {
    // Update baseUrl/apiKeyRef if changed
    await prisma.modelProvider.update({
      where: { id: existing.id },
      data: { baseUrl: p.baseUrl, apiKeyRef: p.apiKeyRef },
    });
    return { action: 'updated', id: existing.id, name: p.name };
  }
  const created = await prisma.modelProvider.create({ data: p });
  return { action: 'created', id: created.id, name: p.name };
}

async function main() {
  const providers = buildProvidersFromEnv();
  if (providers.length === 0) {
    console.log('No provider environment variables detected. Nothing to seed.');
    return;
  }
  console.log(`Seeding ${providers.length} provider(s)...`);
  for (const p of providers) {
    const res = await upsertProvider(p);
    console.log(`Provider ${p.provider}/${p.name} (${p.modelId}): ${res.action} (id=${res.id})`);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
