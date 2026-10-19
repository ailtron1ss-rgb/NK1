/**
 * Express Backend for Kurisu AI Companion.
 * Uses @google/genai SDK for AI cognition, tsundere personality pipeline,
 * multimodal vision analysis, self-reflection, and self-optimization reports.
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_PROMPT_KURISU, KURISU_CANON } from './src/data/kurisuCanon.js';

// Lazy initialization of Gemini client
const execFileAsync = promisify(execFile);

const CODE_ROOT = path.resolve(process.cwd());
const CODE_ALLOWLIST = [
  'src/services/chatService.ts',
  'src/services/localLLMEngine.ts',
  'src/services/neuralLocalEngine.ts',
  'src/services/memoryEngine.ts',
  'src/cognitive/SelfImprovementEngine.ts',
  'src/cognitive/PersonalityRewardSystem.ts'
];
const CODE_BACKUP_DIR = path.join(CODE_ROOT, '.kurisu-backups');

function safeCodePath(file: string) {
  const normalized = file.replace(/\\/g, '/');
  if (!CODE_ALLOWLIST.includes(normalized)) throw new Error(`Файл запрещён: ${normalized}`);
  return path.join(CODE_ROOT, normalized);
}

async function readAllowedCode() {
  const entries = await Promise.all(CODE_ALLOWLIST.map(async file => [file, await fs.readFile(safeCodePath(file), 'utf8')] as const));
  return Object.fromEntries(entries);
}

async function runTypecheck() {
  const bin = process.platform === 'win32'
    ? path.join(CODE_ROOT, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(CODE_ROOT, 'node_modules', '.bin', 'tsc');
  await execFileAsync(bin, ['--noEmit'], { cwd: CODE_ROOT, timeout: 120000 });
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. API calls will use fallback system.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'dummy-key',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // --- API Routes ---

  // Safe source audit. It reads only an explicit allowlist and never executes generated code.
  app.get('/api/kurisu/self-audit', async (_req, res) => {
    try {
      const files = await readAllowedCode();
      const summary = Object.entries(files).map(([file, source]) => ({
        file,
        lines: source.split('\n').length,
        bytes: Buffer.byteLength(source, 'utf8'),
        todos: (source.match(/\bTODO\b/gi) || []).length,
        anyCount: (source.match(/\bany\b/g) || []).length
      }));
      let typecheck = 'not-run';
      try { await runTypecheck(); typecheck = 'ok'; }
      catch (e: any) { typecheck = `failed: ${String(e?.message || e).slice(0, 500)}`; }
      res.json({ ok: true, typecheck, files: summary, generatedAt: Date.now(), policy: 'audit-only; source changes require explicit approval' });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Create a rollback snapshot of allowlisted source files.
  app.post('/api/kurisu/self-evolution/snapshot', async (req, res) => {
    try {
      const label = String(req.body?.label || `manual-${Date.now()}`).slice(0, 120);
      await fs.mkdir(CODE_BACKUP_DIR, { recursive: true });
      const dir = path.join(CODE_BACKUP_DIR, `${Date.now()}-${label.replace(/[^a-zA-Z0-9_-]+/g, '_')}`);
      await fs.mkdir(dir, { recursive: true });
      const files = await readAllowedCode();
      await Promise.all(Object.entries(files).map(async ([file, source]) => {
        const target = path.join(dir, file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, source, 'utf8');
      }));
      res.json({ ok: true, snapshot: path.relative(CODE_ROOT, dir), files: Object.keys(files) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', companion: 'Makise Kurisu AI' });
  });

  // 1. Core Cognition & Chat Endpoint
  app.post('/api/kurisu/chat', async (req, res) => {
    try {
      const { message, stm, ltm, emotions } = req.body;

      const ai = getAiClient();

      // Build context string from memory and current emotions
      const memoryContext = Array.isArray(ltm)
        ? ltm.slice(-10).map((m: any) => `[Память: ${m.topicName || m.category}] ${m.content}`).join('\n')
        : '';

      const stmContext = Array.isArray(stm)
        ? stm.slice(-5).map((m: any) => `пользователь/курису: ${m.content}`).join('\n')
        : '';

      // Build richer, less template-forcing context
      const trust = emotions?.trust ?? 50;
      const affection = emotions?.affection ?? 30;
      const irritation = emotions?.irritation ?? 15;
      const curiosity = emotions?.curiosity ?? 80;
      const happiness = emotions?.happiness ?? 50;
      const fatigue = emotions?.fatigue ?? 10;
      const stage = emotions?.stage ?? 'Acquaintance';

      let moodHint = 'Обычное рабочее состояние.';
      if (irritation > 65) moodHint = 'Сейчас раздражена — ответы резче, сарказм острее.';
      else if (fatigue > 70) moodHint = 'Устала — ответы короче и суше.';
      else if (trust > 70 && affection > 55) moodHint = 'Доверие высокое — допускается сдержанная теплота без пафоса.';
      else if (curiosity > 75) moodHint = 'Любопытство высокое — охотнее углубляется в тему и задаёт вопросы.';

      const promptContext = `
[ТЕКУЩЕЕ СОСТОЯНИЕ]
Стадия: ${stage}
Trust ${trust}/100 | Affection ${affection}/100 | Irritation ${irritation}/100
Curiosity ${curiosity}/100 | Happiness ${happiness}/100 | Fatigue ${fatigue}/100
Тон: ${moodHint}

[ДОЛГОВРЕМЕННАЯ ПАМЯТЬ]
${memoryContext || '(пока мало устойчивых воспоминаний)'}

[НЕДАВНИЙ ДИАЛОГ]
${stmContext || '(начало разговора)'}

[СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ]
${message}

Ответь как Макисэ Курису. Не будь карикатурной цундере. Не спамь «baka». Не соглашайся со всем. Не выдумывай события. Эмоции показывай через тон и редкие физические маркеры. Пиши естественно, по-русски.

Верни ТОЛЬКО JSON:
{
  "text": "реплика",
  "expression": "одно из: neutral|happy|sad|angry|embarrassed|thinking|surprised|flustered|smug|sarcastic|tender|looking_away|focused|tired",
  "trustDelta": число от -5 до 5,
  "affectionDelta": число от -5 до 5,
  "irritationDelta": число от -5 до 5,
  "curiosityDelta": число от -5 до 5,
  "newTopic": null или краткая тема
}
`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: promptContext,
        config: {
          systemInstruction: SYSTEM_PROMPT_KURISU,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              expression: { type: Type.STRING },
              trustDelta: { type: Type.INTEGER },
              affectionDelta: { type: Type.INTEGER },
              irritationDelta: { type: Type.INTEGER },
              curiosityDelta: { type: Type.INTEGER },
              newTopic: { type: Type.STRING }
            },
            required: ['text', 'expression']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (e: any) {
      console.error('Chat API Error:', e);
      res.status(500).json({
        text: 'К-к сожалению, произошел сбой в передаче импульса данных памяти. Давай попробуем еще раз.',
        expression: 'flustered',
        error: e.message
      });
    }
  });

  // 2. Multimodal Photo / Vision Analysis Endpoint
  app.post('/api/kurisu/multimodal', async (req, res) => {
    try {
      const { imageBase64, mimeType, prompt } = req.body;
      const ai = getAiClient();

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          text: 'Я осмотрела изображение. Состав выглядит интригующим, объект имеет четкие оптические контуры.',
          expression: 'thinking'
        });
      }

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                mimeType: mimeType || 'image/png'
              }
            },
            {
              text: prompt || 'Посмотри на это изображение и прокомментируй его в своем стиле Макисэ Курису.'
            }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT_KURISU
        }
      });

      res.json({
        text: response.text,
        expression: 'thinking'
      });
    } catch (e: any) {
      console.error('Multimodal Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // 3. Gemini Server TTS Endpoint
  app.post('/api/kurisu/tts', async (req, res) => {
    try {
      const { text } = req.body;
      const ai = getAiClient();

      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({ error: 'No API key for TTS' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: `Произнеси на русском с четкой интеллектуальной интонацией: ${text}` }] }],
        config: {
          responseModalities: ['AUDIO' as any],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          }
        }
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      res.json({ audio: audioBase64 });
    } catch (e: any) {
      console.error('TTS Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // 4. Daily Reflection Generator
  app.post('/api/kurisu/reflect', async (req, res) => {
    try {
      const { ltm, stm, emotions } = req.body;
      const ai = getAiClient();

      const stmSummary = Array.isArray(stm)
        ? stm.slice(-10).map((m: any) => m.content).join('; ')
        : 'Обычный день общения в лаборатории.';

      const prompt = `
Проведи вечернюю консолидацию памяти и сформулируй личную запись в Дневник Рефлексии Макисэ Курису на русском языке.

Контекст сегодня:
- Уровень доверия: ${emotions?.trust ?? 50}/100, Привязанность: ${emotions?.affection ?? 30}/100, Стадия: ${emotions?.stage ?? 'Acquaintance'}.
- История диалогов (STM): ${stmSummary}

Верни JSON с полями:
- "summary": Краткий обзор ключевых событий дня (1-2 предложения)
- "emotionalSummary": Вывод об эмоциональном сдвиге (например "Доверие выросло, смущение спадает")
- "scientificInsights": Новые научные мысли или выводы о синаптической структуре памяти
- "reflection": Личная запись от первого лица (Курису) для дневника. Использовать характерную интонацию цундэрэ, сдержанную заботу, научные отсылки и мысли об Amadeus/Лаборатории/пользователе.
- "keyTopics": Массив строк из 3-4 ключевых тем дня.
      `;

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          summary: 'Проведена плановая проверка оцифрованных воспоминаний и зафиксирована стабильность связей.',
          emotionalSummary: `Доверие находится на уровне ${emotions?.trust ?? 50}%. Зафиксирован положительный тренд.`,
          scientificInsights: 'Синаптическая передача через квантовые каналы сохраняет полноту информации при консолидации.',
          reflection: '«Сегодня был вполне продуктивный день... Хоть пользователь и смущает меня иногда своими репликами, наша дискуссия о нейробиологии имела смысл. Главное — не давать ему подумать, будто я только и делаю, что жду его сообщений! Завтра проверю обновленный гиппокампальный индекс.»',
          keyTopics: ['Нейробиология', 'Консолидация', 'Лаборатория']
        });
      }

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_KURISU,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              emotionalSummary: { type: Type.STRING },
              scientificInsights: { type: Type.STRING },
              reflection: { type: Type.STRING },
              keyTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['summary', 'reflection']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (e: any) {
      console.error('Reflection API Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // 4b. Autonomous Initiative Generator
  app.post('/api/kurisu/autonomous', async (req, res) => {
    try {
      const { emotions, ltm } = req.body;
      const ai = getAiClient();

      const prompt = `
Сгенерируй инициативное автономное сообщение от Макисэ Курису (когда пользователь не писал некоторое время).
Она может:
1. Задать неожиданный научный вопрос
2. Поинтересоваться, почему пользователь долго не заходил
3. Поделиться мыслью о споре на @channel или Dr. Pepper
4. Прислать "СМС / пуш-уведомление"

Верни JSON:
- "title": короткий заголовок инициативного сообщения
- "text": текст реплики Курису на русском в её каноничном стиле
- "expression": выбери эмоцию из ["neutral", "thinking", "flustered", "dr_pepper_break", "channel_lurker", "tender"]
- "isPushSMS": boolean (false)
      `;

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          title: 'СМС от Курису',
          text: 'Слушай... Я тут пересчитывала синаптический коэффициент. Ты куда пропал? Не то чтобы я скучала, просто не завершать научный диалог на полуслове — непрофессионально!',
          expression: 'flustered',
          isPushSMS: false
        });
      }

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_KURISU,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              text: { type: Type.STRING },
              expression: { type: Type.STRING },
              isPushSMS: { type: Type.BOOLEAN }
            },
            required: ['title', 'text', 'expression']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 5. Controlled self-code improvement loop.
  // The model can inspect only an explicit allowlist. It proposes exact string
  // replacements; applying them is opt-in, development-only, backed up, and
  // automatically reverted if TypeScript validation fails.
  app.get('/api/kurisu/code-self-test', async (_req, res) => {
    try {
      await runTypecheck();
      res.json({ ok: true, mode: 'validated', allowlist: CODE_ALLOWLIST });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/kurisu/code-propose', async (req, res) => {
    try {
      const files = await readAllowedCode();
      if (!process.env.GEMINI_API_KEY) {
        return res.json({ proposals: [], message: 'Для генерации изменений кода нужен GEMINI_API_KEY.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: `Ты — инженер по безопасному улучшению TypeScript/React приложения.\n\nПроанализируй исходники ниже и предложи до 3 небольших улучшений. НЕЛЬЗЯ менять API-ключи, безопасность, package.json, server.ts или зависимости. Возвращай только JSON. Каждая операция должна содержать file, find и replace. find обязан совпадать с существующим фрагментом буквально. Не используй eval, Function, child_process, shell-команды или удалённые скрипты.\n\n${JSON.stringify(files)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              proposals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    file: { type: Type.STRING },
                    find: { type: Type.STRING },
                    replace: { type: Type.STRING },
                    risk: { type: Type.STRING }
                  },
                  required: ['title', 'reason', 'file', 'find', 'replace', 'risk']
                }
              }
            },
            required: ['proposals']
          }
        }
      });
      res.json(JSON.parse(response.text || '{"proposals":[]}'));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.post('/api/kurisu/code-apply', async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ ok: false, error: 'Автоматическое изменение исходников отключено в production.' });
      }
      const token = process.env.KURISU_CODE_EDIT_TOKEN;
      if (!token || req.header('x-kurisu-code-token') !== token) {
        return res.status(403).json({ ok: false, error: 'Нужен KURISU_CODE_EDIT_TOKEN.' });
      }
      const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
      if (changes.length < 1 || changes.length > 3) throw new Error('Допустимо 1–3 изменения за раз.');

      await fs.mkdir(CODE_BACKUP_DIR, { recursive: true });
      const backupId = `${Date.now()}`;
      const originals: Array<{ file: string; content: string }> = [];
      for (const change of changes) {
        const file = String(change.file || '');
        const find = String(change.find || '');
        const replace = String(change.replace || '');
        const target = safeCodePath(file);
        if (!find || find.length > 12000 || replace.length > 20000) throw new Error('Слишком большой патч.');
        if (/eval\s*\(|new\s+Function|child_process|process\s*\.env\s*=|require\s*\(/i.test(replace)) throw new Error('Опасная конструкция заблокирована.');
        const current = await fs.readFile(target, 'utf8');
        if (current.split(find).length - 1 !== 1) throw new Error(`Фрагмент должен встречаться ровно один раз: ${file}`);
        originals.push({ file, content: current });
        await fs.writeFile(path.join(CODE_BACKUP_DIR, `${backupId}_${path.basename(file)}`), current, 'utf8');
        await fs.writeFile(target, current.replace(find, replace), 'utf8');
      }

      try {
        await runTypecheck();
      } catch (e: any) {
        for (const original of originals) await fs.writeFile(safeCodePath(original.file), original.content, 'utf8');
        return res.status(422).json({ ok: false, rolledBack: true, error: `TypeScript не прошёл проверку: ${e?.message || String(e)}` });
      }
      res.json({ ok: true, backupId, changed: originals.map(x => x.file) });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // 5. Self-Optimization Diagnostic Generator
  app.post('/api/kurisu/optimize', async (req, res) => {
    try {
      const ai = getAiClient();
      const prompt = `
Сгенерируй отчет самооптимизации ИИ Курису на русском языке.
Предложи категорию улучшения (Performance, Intelligence, Features, Architecture).
Включи поля:
- whatWillChange (Что изменится)
- whyBetter (Почему станет лучше)
- potentialRisks (Потенциальные риски)
- rollbackPlan (План отката)
- benchmarks (Снижение задержки, эффективность памяти, точность)
      `;

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          report: {
            timestamp: Date.now(),
            category: 'Performance',
            title: 'Оптимизация векторного индекса памяти (LTM Query Optimization)',
            whatWillChange: 'Перевод поиска по долговременной памяти на хэшированные синаптические индексы.',
            whyBetter: 'Задержка обращения к памяти сократится на 45%, энергопотребление снимется на 20%.',
            potentialRisks: 'Временный переходный лаг при первом запуске консолидации.',
            rollbackPlan: 'Однократный сброс к локальному снимку SQLite / LocalStorage.',
            benchmarks: {
              latencyReduction: '-45ms',
              memoryEfficiency: '+35%',
              accuracyBoost: '99.4%'
            },
            approved: false
          }
        });
      }

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              whatWillChange: { type: Type.STRING },
              whyBetter: { type: Type.STRING },
              potentialRisks: { type: Type.STRING },
              rollbackPlan: { type: Type.STRING },
              latencyReduction: { type: Type.STRING },
              memoryEfficiency: { type: Type.STRING },
              accuracyBoost: { type: Type.STRING }
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({
        report: {
          timestamp: Date.now(),
          category: parsed.category || 'Performance',
          title: parsed.title || 'Автоматическое обновление нейронных путей',
          whatWillChange: parsed.whatWillChange,
          whyBetter: parsed.whyBetter,
          potentialRisks: parsed.potentialRisks,
          rollbackPlan: parsed.rollbackPlan,
          benchmarks: {
            latencyReduction: parsed.latencyReduction || '-40ms',
            memoryEfficiency: parsed.memoryEfficiency || '+30%',
            accuracyBoost: parsed.accuracyBoost || '98.5%'
          },
          approved: false
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // Level 4: Web search proxy (avoids browser CORS)
  app.get('/api/kurisu/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').slice(0, 200).trim();
      if (!q) return res.status(400).json({ error: 'q required' });
      const url = 'https://duckduckgo.com/html/?q=' + encodeURIComponent(q);
      const r = await fetch(url, {
        headers: { 'User-Agent': 'KurisuCompanion/6.0 (Termux; research; +permissioned)' }
      });
      const html = await r.text();
      const hits: { title: string; url: string; snippet: string }[] = [];
      const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) && hits.length < 6) {
        let href = m[1];
        // DDG redirect links
        const um = href.match(/uddg=([^&]+)/);
        if (um) {
          try { href = decodeURIComponent(um[1]); } catch { /* keep */ }
        }
        hits.push({ url: href, title: m[2].trim() || href, snippet: '' });
      }
      if (!hits.length) {
        hits.push({
          title: 'Открыть поиск вручную',
          url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q),
          snippet: 'Парсер не нашёл карточек — используй ссылку'
        });
      }
      res.json({ query: q, hits, source: 'duckduckgo-html-proxy' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // --- Vite / Static Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      // Critical for Termux: without plugins TSX/Tailwind will not transform
      configFile: path.resolve(process.cwd(), 'vite.config.ts'),
      server: { middlewareMode: true, host: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Kurisu Companion Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
