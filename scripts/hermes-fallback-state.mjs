#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const home = process.env.HOME || '/home/torquepilot';
const logFiles = [
  path.join(home, '.hermes/logs/agent.log'),
  path.join(home, '.hermes/logs/gateway.log'),
];
const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const intervalArg = args.find((arg) => arg.startsWith('--interval-ms='));
const intervalMs = Math.max(
  5_000,
  Number.parseInt(intervalArg?.split('=')[1] || '30000', 10) || 30_000,
);
const outputArg = args.find((arg) => !arg.startsWith('--'));
const outputPath = outputArg
  ? path.resolve(projectRoot, outputArg)
  : path.join(projectRoot, 'public/hermes-fallback-state.json');

const EVENT_PATTERNS = [
  {
    type: 'fallback_activated',
    regex: /Fallback activated:\s*([^→]+)→\s*([^()]+)\s*\(([^)]+)\)/i,
    toEvent: (match) => ({
      fallbackActive: true,
      activeProvider: normalize(match[3]),
      activeModel: normalize(match[2]),
      primaryModel: normalize(match[1]),
    }),
  },
  {
    type: 'fallback_resolved',
    regex: /Fallback provider resolved:\s*([a-z0-9._-]+)/i,
    toEvent: (match) => ({
      fallbackActive: true,
      activeProvider: normalize(match[1]),
      activeModel: 'deepseek/deepseek-v4-pro',
      primaryModel: 'deepseek-v4-pro',
    }),
  },
  {
    type: 'primary_auth_failed',
    regex: /Primary provider auth failed:/i,
    toEvent: () => ({
      fallbackActive: true,
      activeProvider: 'openrouter',
      activeModel: 'deepseek/deepseek-v4-pro',
      primaryModel: 'deepseek-v4-pro',
    }),
  },
  {
    type: 'main_provider_active',
    regex: /using main provider\s+([a-z0-9._-]+)\s*\(([^)]+)\)/i,
    toEvent: (match) => ({
      fallbackActive: normalize(match[1]) !== 'openai-codex',
      activeProvider: normalize(match[1]),
      activeModel: normalize(match[2]),
      primaryModel: 'deepseek-v4-pro',
    }),
  },
];

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|secret|password|passwd|refresh[_-]?token|access[_-]?token|oauth[_-]?token|cookie)\b\s*[:=]\s*['\"]?[^'\"\s]{8,}/i,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/i,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\b(?:eyJ[A-Za-z0-9_-]+\.){2}[A-Za-z0-9_-]+\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

function containsSecretPattern(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return SECRET_PATTERNS.some((pattern) => pattern.test(serialized || ''));
}

function parseTimestamp(line) {
  const match = line.match(/(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  return `${match[1]}T${match[2]}+02:00`;
}

function parseEvent(line, sourceFile) {
  const at = parseTimestamp(line);
  if (!at) return null;

  for (const pattern of EVENT_PATTERNS) {
    const match = line.match(pattern.regex);
    if (!match) continue;
    return {
      at,
      eventType: pattern.type,
      source: path.basename(sourceFile),
      ...pattern.toEvent(match),
    };
  }
  return null;
}

async function readTail(filePath, maxBytes = 512_000) {
  if (!existsSync(filePath)) return '';
  const content = await readFile(filePath, 'utf8');
  return content.length > maxBytes ? content.slice(-maxBytes) : content;
}

async function collectState() {
  const events = [];
  for (const file of logFiles) {
    const content = await readTail(file);
    for (const line of content.split('\n')) {
      const event = parseEvent(line, file);
      if (event) events.push(event);
    }
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  const latest = events.at(-1);
  const nowMs = Date.now();
  const recentSinceMs = nowMs - 24 * 60 * 60 * 1000;
  const fallbackEvents = events.filter((event) => event.eventType.startsWith('fallback_') || event.eventType === 'primary_auth_failed');
  const recentFallbackEvents = fallbackEvents.filter((event) => new Date(event.at).getTime() >= recentSinceMs);

  const state = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'hermes_logs_redacted',
    status: latest ? 'ok' : 'unknown',
    fallbackActive: latest?.fallbackActive ?? null,
    activeProvider: latest?.activeProvider ?? null,
    activeModel: latest?.activeModel ?? null,
    primaryProvider: 'openai-codex',
    primaryModel: latest?.primaryModel ?? 'deepseek-v4-pro',
    fallbackProvider: 'openrouter',
    fallbackModel: 'deepseek/deepseek-v4-pro',
    lastEventAt: latest?.at ?? null,
    lastEventType: latest?.eventType ?? null,
    lastEventSource: latest?.source ?? null,
    eventCount: events.length,
    fallbackEventCount: fallbackEvents.length,
    recentFallbackEventCount: recentFallbackEvents.length,
    recentWindowHours: 24,
    safety: {
      containsSecrets: false,
      containsMessageContent: false,
      redacted: true,
    },
  };

  const hasSecretLikeValue = containsSecretPattern(state);
  state.safety.containsSecrets = hasSecretLikeValue;
  if (hasSecretLikeValue) throw new Error('Secret-like value detected in public fallback state; write aborted');
  return state;
}

async function writeState() {
  const state = await collectState();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    generatedAt: state.generatedAt,
    status: state.status,
    fallbackActive: state.fallbackActive,
    activeProvider: state.activeProvider,
    activeModel: state.activeModel,
    lastEventType: state.lastEventType,
    fallbackEventCount: state.fallbackEventCount,
    recentFallbackEventCount: state.recentFallbackEventCount,
    outputPath,
  }));
}

await writeState();

if (watchMode) {
  const timer = setInterval(() => {
    writeState().catch((error) => {
      console.error(JSON.stringify({ status: 'error', message: error.message }));
    });
  }, intervalMs);
  await new Promise(() => {});
}
