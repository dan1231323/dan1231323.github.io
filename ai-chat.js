/* ai-ultra-pro.js
   Продвинутый локальный чат-ИИ с контекстом, обучением и NLP.
   Подключение: <script src="ai-ultra-pro.js"></script>
   Если на странице есть элементы с id chat-form, chat-input, chat-box, regen-btn, clear-btn, learn-mode-btn —
   скрипт использует их. Иначе сам создаст рабочий UI поверх страницы.
   Автор: твой бот-ремиксер (в стиле дзэн поколения Z)
*/
(function () {
  'use strict';

  // -----------------------------
  // =======  CONFIG  ============
  // -----------------------------
  const CONFIG = {
    responseDelay: 350,
    memoryLimit: 500,
    contextWindow: 20,
    minSimilarity: 0.28,
    temperature: 0.72,
    verbose: false,
    enableVoice: true,
    voiceLang: 'ru-RU',
    maxMsgLengthToSpeak: 500,
    enableTypingEffect: true,
    typingCharsPerSec: 80,
    storageKeyMemory: 'ai_ultra_pro_memory_v2',
    storageKeyKB: 'ai_ultra_pro_kb_v2',
    defaultTheme: 'dark' // 'dark' or 'light'
  };

  // -----------------------------
  // =======  UTIL  ==============
  // -----------------------------
  const Util = {
    now() { return Date.now(); },
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    escapeHtml(str) {
      if (typeof str !== 'string') return str;
      return str.replace(/[&<>"']/g, function (m) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
      });
    },
    safeParseJSON(s, fallback) {
      try { return JSON.parse(s); } catch (e) { return fallback; }
    },
    downloadText(filename, text) {
      const a = document.createElement('a');
      const blob = new Blob([text], { type: 'text/plain' });
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    nowISO() {
      return (new Date()).toISOString().replace('T', ' ').split('.')[0];
    }
  };

  // -----------------------------
  // =======  NLP  ===============
  // -----------------------------
  const NLP = {
    stopWords: new Set([
      'и','в','на','с','по','для','к','от','о','у','из','за','до','при','же','ли','бы',
      'the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did',
      'это','то','все','всё','так','вот','быть','как','его','но','да','ты','я','мы','они','его'
    ]),

    normalize(text) {
      if (!text) return '';
      return String(text)
        .normalize('NFKD')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    tokenize(text, removeStopWords = true) {
      const n = this.normalize(text);
      if (!n) return [];
      const tokens = n.split(' ').filter(Boolean);
      if (!removeStopWords) return tokens;
      return tokens.filter(t => t.length > 1 && !this.stopWords.has(t));
    },

    // Простая реализация стемминга (рус/англ)
    stem(word) {
      if (!word || word.length < 4) return word;
      let w = word;
      // рус
      w = w.replace(/(ова|ев|ение|ание|ость|ость|ение|иями|ями|ими|ами|его|ого|ому|ему|ами|ями|ать|ять|ить|еть|ся|ся)$/i, '');
      // англ
      w = w.replace(/(ational|tional|izing|ising|ization|isation|ization|ization|ing|ed|es|s|ly|ment|ness)$/i, '');
      return w;
    },

    // Jaccard similarity between token sets
    jaccard(a, b) {
      const sa = new Set(this.tokenize(a).map(t => this.stem(t)));
      const sb = new Set(this.tokenize(b).map(t => this.stem(t)));
      if (sa.size === 0 && sb.size === 0) return 0;
      let inter = 0;
      for (const x of sa) if (sb.has(x)) inter++;
      const uni = new Set([...sa, ...sb]).size;
      return uni === 0 ? 0 : inter / uni;
    },

    // Cosine similarity (bag of words)
    cosine(a, b) {
      const ta = this.tokenize(a).map(t => this.stem(t));
      const tb = this.tokenize(b).map(t => this.stem(t));
      const tokens = Array.from(new Set([...ta, ...tb]));
      const va = tokens.map(tok => ta.filter(x => x === tok).length);
      const vb = tokens.map(tok => tb.filter(x => x === tok).length);
      const dot = va.reduce((s, v, i) => s + v * vb[i], 0);
      const ma = Math.sqrt(va.reduce((s, v) => s + v * v, 0));
      const mb = Math.sqrt(vb.reduce((s, v) => s + v * v, 0));
      if (!ma || !mb) return 0;
      return dot / (ma * mb);
    },

    // Levenshtein distance turned into similarity [0..1]
    levenshteinSimilarity(a, b) {
      if (!a || !b) return 0;
      if (a === b) return 1;
      const na = this.normalize(a);
      const nb = this.normalize(b);
      const m = na.length, n = nb.length;
      if (m === 0 || n === 0) return 0;
      // optimize memory
      const prev = new Array(n + 1).fill(0);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        let cur = i;
        for (let j = 1; j <= n; j++) {
          const insert = prev[j] + 1;
          const remove = cur + 1;
          const replace = prev[j - 1] + (na[i - 1] === nb[j - 1] ? 0 : 1);
          const tmp = Math.min(insert, remove, replace);
          prev[j - 1] = cur;
          cur = tmp;
        }
        prev[n] = cur;
      }
      const dist = prev[n];
      const maxLen = Math.max(m, n);
      return 1 - (dist / maxLen);
    },

    // Ensemble similarity (weighted)
    similarity(a, b) {
      if (!a || !b) return 0;
      const na = this.normalize(a);
      const nb = this.normalize(b);
      if (!na || !nb) return 0;
      if (na === nb) return 1;
      if (na.includes(nb) || nb.includes(na)) return 0.95;
      const j = this.jaccard(a, b);
      const c = this.cosine(a, b);
      const l = this.levenshteinSimilarity(a, b);
      // weights tuned: cosine - 0.45, jaccard - 0.3, levenshtein - 0.25
      return Math.max(0.45 * c + 0.3 * j + 0.25 * l, c * 0.9, j * 0.9, l * 0.9);
    },

    // TF-IDF scoring of a query across documents
    tfidf(query, documents) {
      // documents: [{ id, text, entry }]
      const queryTokens = this.tokenize(query).map(t => this.stem(t));
      if (queryTokens.length === 0) return documents.map(d => ({ doc: d, score: 0 }));
      const N = documents.length;
      const df = {};
      const docsTokens = documents.map(d => {
        const toks = this.tokenize(d.text).map(t => this.stem(t));
        const uniq = new Set(toks);
        uniq.forEach(t => df[t] = (df[t] || 0) + 1);
        return toks;
      });
      const scores = documents.map((d, i) => {
        const toks = docsTokens[i];
        let score = 0;
        for (const t of queryTokens) {
          const tf = toks.filter(x => x === t).length / (toks.length || 1);
          const idf = Math.log((N + 1) / (1 + (df[t] || 0))) + 1;
          score += tf * idf;
        }
        return { doc: d, score };
      });
      scores.sort((a, b) => b.score - a.score);
      return scores;
    },

    extractEntities(text) {
      const normalized = String(text || '');
      const numbers = normalized.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
      const urls = normalized.match(/https?:\/\/[^\s]+/g) || [];
      const emails = normalized.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,6}/g) || [];
      return {
        numbers: numbers.map(n => parseFloat(n.replace(',', '.'))),
        urls,
        emails
      };
    },

    getSentiment(text) {
      // very naive
      const pos = ['хорошо','отлично','круто','люблю','нрав','рад','супер','счастлив','great','good','awesome','nice'];
      const neg = ['плохо','ужасно','грустно','ненавижу','не нравится','bad','terrible','sad','awful'];
      const toks = this.tokenize(text, true);
      let score = 0;
      for (const t of toks) {
        if (pos.some(p => t.includes(p))) score++;
        if (neg.some(n => t.includes(n))) score--;
      }
      return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    },

    classifyIntent(text) {
      const q = /\b(что|как|почему|зачем|когда|где|кто|какой|сколько|what|how|why|when|where|who|which)\b/i;
      const g = /\b(привет|здравствуй|hi|hello|hey|yo|доброе утро)\b/i;
      const f = /\b(пока|до свидания|bye|goodbye|увидимся)\b/i;
      const c = /\b(сделай|создай|покажи|напиши|найди|make|create|show|write|find)\b/i;
      if (g.test(text)) return 'greeting';
      if (f.test(text)) return 'farewell';
      if (c.test(text)) return 'command';
      if (q.test(text)) return 'question';
      return 'statement';
    }
  };

  // -----------------------------
  // ===== Context Manager =======
  // -----------------------------
  class ContextManager {
    constructor() {
      this.conversation = []; // {author, text, ts, intent, sentiment}
      this.userProfile = {
        name: null,
        interests: new Set(),
        topics: new Map(),
        sentiment: { positive: 0, neutral: 0, negative: 0 }
      };
    }
    addMessage(author, text) {
      const intent = NLP.classifyIntent(text);
      const sentiment = NLP.getSentiment(text);
      const entry = {
        author,
        text,
        ts: Util.now(),
        intent,
        sentiment,
        entities: NLP.extractEntities(text)
      };
      this.conversation.push(entry);
      if (this.conversation.length > CONFIG.contextWindow) this.conversation.shift();
      if (author === 'Ты') this.updateProfile(text, intent, sentiment);
    }
    updateProfile(text, intent, sentiment) {
      if (sentiment && this.userProfile.sentiment[sentiment] !== undefined) this.userProfile.sentiment[sentiment]++;
      const keys = ['программирование','футбол','игры','музыка','кино','учеба','школа','математика','python','javascript','roblox','minecraft'];
      for (const k of keys) {
        if (text.toLowerCase().includes(k)) {
          this.userProfile.interests.add(k);
          this.userProfile.topics.set(k, (this.userProfile.topics.get(k) || 0) + 1);
        }
      }
    }
    getContext(depth = 8) {
      return this.conversation.slice(-depth);
    }
    getRelevantContext(query) {
      const recent = this.getContext(CONFIG.contextWindow);
      return recent.filter(m => NLP.similarity(m.text, query) > 0.25).slice(-5);
    }
    getUserInterests() {
      return Array.from(this.userProfile.interests);
    }
  }

  // -----------------------------
  // ===== Knowledge Base ========
  // -----------------------------
  class KnowledgeBase {
    constructor() {
      this.entries = this.defaultEntries();
      this.customEntries = this.loadCustomKB();
      this.usage = new Map();
      this.buildIndexCache();
    }
    defaultEntries() {
      return [
        { id: 'greet', patterns: ['привет','здравствуй','hi','hello','хай'], responses: ['Привет! Чем закинуть?', 'Хай! Что надо?'], context: ['greeting'], weight: 1.0 },
        { id: 'howru', patterns: ['как дела','как ты','how are you'], responses: ['Всё ок! Готов к делу', 'Норм, давай кодить'], context: ['smalltalk'], weight: 1.0 },
        { id: 'about', patterns: ['кто ты','что ты','who are you','расскажи о себе'], responses: ['Я локальный чат-ИИ — учусь от тебя и храню контекст.'], context: ['about'], weight: 1.0 },
        { id: 'math', patterns: ['посчитай','сколько будет','вычисли'], responses: ['Введи выражение (например: 12 * 7 + 3)'], context: ['math'], weight: 1.0, responder: (msg) => {
          try {
            const expr = String(msg).replace(/[^0-9+\-*/()., \t]/g,'').replace(/,/g,'.');
            if (!/[0-9]/.test(expr)) return null;
            // eslint-disable-next-line no-new-func
            const val = Function('"use strict";return ('+expr+')')();
            if (typeof val === 'number' && isFinite(val)) return `Результат: ${Number(val.toFixed(6))}`;
          } catch(e) { /* ignore */ }
          return null;
        }},
        { id: 'time', patterns: ['который час','время','дата','today','time','date'], responses: [], context: ['utility'], weight: 1.0, responder: () => {
          const now = new Date();
          return `🕒 ${now.toLocaleTimeString('ru-RU')} — ${now.toLocaleDateString('ru-RU',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`;
        }},
        { id: 'thanks', patterns: ['спасибо','thx','thank you','благодарю'], responses: ['Не за что 🙂','Рад помочь!'], context:['thanks'], weight: 1.0 },
        { id: 'bye', patterns: ['пока','до свидания','bye','see ya'], responses: ['Пока! Возвращайся!','Удачи!'], context:['farewell'], weight:1.0 },
        { id: 'joke', patterns: ['шутка','анекдот','расскажи шутку','joke'], responses: ['Почему программисты любят тёмную тему? Потому что светлая — баги видны хуже 😅','— Сколько программистов нужно, чтобы вкрутить лампочку? — Ни одного, это аппаратная проблема!'] }
      ];
    }
    loadCustomKB() {
      try {
        const raw = localStorage.getItem(CONFIG.storageKeyKB);
        if (!raw) return [];
        return JSON.parse(raw);
      } catch (e) {
        return [];
      }
    }
    saveCustomKB() {
      try {
        localStorage.setItem(CONFIG.storageKeyKB, JSON.stringify(this.customEntries));
      } catch (e) {
        console.warn('KB save failed', e);
      }
    }
    addCustom(patterns, responses, meta = {}) {
      const id = 'custom_' + Util.now();
      const entry = Object.assign({ id, patterns, responses, context: ['custom'], weight: 0.9, learned: true }, meta);
      this.customEntries.unshift(entry);
      this.saveCustomKB();
      this.buildIndexCache();
      return entry;
    }
    allEntries() {
      return [...this.entries, ...this.customEntries];
    }
    recordUsage(id) {
      this.usage.set(id, (this.usage.get(id) || 0) + 1);
    }
    getPopular(limit=6) {
      return Array.from(this.usage.entries()).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([id]) => this.allEntries().find(e=>e.id===id)).filter(Boolean);
    }
    buildIndexCache() {
      // precompute a text string for each entry for TF-IDF and quick checks
      this._index = this.allEntries().map(e => ({ id: e.id, text: (e.patterns || []).join(' '), entry: e }));
    }
    queryTFIDF(q) {
      if (!this._index) this.buildIndexCache();
      return NLP.tfidf(q, this._index);
    }
  }

  // -----------------------------
  // ===== Response Generator ====
  // -----------------------------
  class ResponseGenerator {
    constructor(kb, ctx) {
      this.kb = kb;
      this.ctx = ctx;
      this.fallbacks = [
        "Интересно... можешь уточнить?",
        "Не уверен. Расскажи чуть подробнее.",
        "Хмм, это ново. Давай распишем задачу по шагам."
      ];
    }

    findBestByTFIDF(userMessage) {
      const docs = this.kb._index || (this.kb.buildIndexCache() && this.kb._index);
      const ranked = NLP.tfidf(userMessage, docs);
      if (ranked.length === 0) return null;
      const top = ranked[0];
      // boost threshold
      if (top.score > 0.12) {
        return { entry: top.doc.entry, score: top.score * 1.4, method: 'tfidf' };
      }
      return null;
    }

    findBestBySimilarity(userMessage) {
      const entries = this.kb.allEntries();
      let best = null;
      let bestScore = 0;
      for (const e of entries) {
        for (const p of e.patterns) {
          const s = NLP.similarity(userMessage, p) * (e.weight || 1.0);
          if (s > bestScore) {
            bestScore = s;
            best = e;
          }
        }
      }
      if (best) return { entry: best, score: bestScore, method: 'similarity' };
      return null;
    }

    selectResponse(entry, userMessage) {
      if (!entry) return null;
      // custom responder takes precedence
      if (entry.responder && typeof entry.responder === 'function') {
        try {
          const r = entry.responder(userMessage, this.ctx);
          if (r) return r;
        } catch (e) { /* ignore */ }
      }
      // temperature-based pick
      if (Math.random() < CONFIG.temperature && Array.isArray(entry.responses)) {
        return Util.randChoice(entry.responses);
      }
      // default first
      if (Array.isArray(entry.responses) && entry.responses.length > 0) return entry.responses[0];
      return null;
    }

    generate(userMessage) {
      if (!userMessage || userMessage.trim().length === 0) return Util.randChoice(this.fallbacks);

      // 1. TF-IDF attempt
      const tf = this.findBestByTFIDF(userMessage);
      if (tf && tf.score >= CONFIG.minSimilarity) {
        this.kb.recordUsage(tf.entry.id);
        return this.selectResponse(tf.entry, userMessage);
      }

      // 2. direct responder or similarity
      const sim = this.findBestBySimilarity(userMessage);
      if (sim && sim.score >= CONFIG.minSimilarity) {
        this.kb.recordUsage(sim.entry.id);
        return this.selectResponse(sim.entry, userMessage);
      }

      // 3. context-aware fallback
      const contextResp = this.contextualFallback(userMessage);
      if (contextResp) return contextResp;

      // 4. generic fallback
      return Util.randChoice(this.fallbacks);
    }

    contextualFallback(userMessage) {
      const relevant = this.ctx.getRelevantContext(userMessage);
      if (relevant && relevant.length > 0) {
        const last = relevant[relevant.length - 1];
        return `Продолжаем про "${this.extractTopic(last.text)}"? Или это новый вопрос?`;
      }
      const intent = NLP.classifyIntent(userMessage);
      if (intent === 'greeting') return Util.randChoice(['Привет! Чем закинуть?', 'Хай! Как делишки?']);
      if (intent === 'farewell') return Util.randChoice(['Пока! Возвращайся', 'До! Удачи']);
      if (intent === 'question') return 'Классный вопрос — дай контекст, я помогу точнее';
      return null;
    }

    extractTopic(text) {
      const topics = ['программирование','футбол','игры','математика','учёба','роблокс','майнкрафт'];
      for (const t of topics) if (text.toLowerCase().includes(t)) return t;
      const tok = NLP.tokenize(text).slice(0,3).join(' ');
      return tok || 'тему';
    }
  }

  // -----------------------------
  // ===== Learning Mode =========
  // -----------------------------
  class LearningMode {
    constructor(kb) {
      this.kb = kb;
      this.active = false;
      this.waitingFor = null; // 'pattern'|'response'
      this.bufferPattern = null;
    }
    toggle() {
      this.active = !this.active;
      this.waitingFor = null;
      this.bufferPattern = null;
      return this.active;
    }
    isActive() { return this.active; }

    process(message) {
      if (!this.active) return null;
      if (!this.waitingFor) {
        // expect pattern
        this.bufferPattern = message;
        this.waitingFor = 'response';
        return 'Ок, получил паттерн. Теперь пришли, как ИИ должен отвечать на это (одно сообщение).';
      } else if (this.waitingFor === 'response') {
        const pattern = this.bufferPattern;
        const response = message;
        this.kb.addCustom([pattern], [response], { learned: true });
        this.waitingFor = null;
        this.bufferPattern = null;
        return `Запомнил: на "${pattern}" отвечать "${response}" ✅`;
      }
      return null;
    }
  }

  // -----------------------------
  // ====== AI Core ==============
  // -----------------------------
  class AIUltraPro {
    constructor() {
      this.kb = new KnowledgeBase();
      this.ctx = new ContextManager();
      this.generator = new ResponseGenerator(this.kb, this.ctx);
      this.learning = new LearningMode(this.kb);
      this.memory = this.loadMemory();
      this.isGenerating = false;
      this._speechUtterance = null;
    }

    loadMemory() {
      try {
        const raw = localStorage.getItem(CONFIG.storageKeyMemory);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
    saveMemory() {
      try {
        localStorage.setItem(CONFIG.storageKeyMemory, JSON.stringify(this.memory.slice(-CONFIG.memoryLimit)));
      } catch (e) {
        console.warn('saveMemory failed', e);
      }
    }
    addToMemory(author, text) {
      const entry = { author, text, ts: Util.now() };
      this.memory.push(entry);
      if (this.memory.length > CONFIG.memoryLimit) this.memory = this.memory.slice(-CONFIG.memoryLimit);
      this.ctx.addMessage(author, text);
      this.saveMemory();
    }
    clearMemory() {
      this.memory = [];
      this.ctx.conversation = [];
      this.saveMemory();
    }

    stopSpeech() {
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {}
    }

    maybeSpeak(text) {
      if (!CONFIG.enableVoice) return;
      if (!window.speechSynthesis) return;
      if (typeof text !== 'string') return;
      if (text.length > CONFIG.maxMsgLengthToSpeak) return;
      try {
        this.stopSpeech();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = CONFIG.voiceLang || 'ru-RU';
        // choose voice roughly matching lang
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          const v = voices.find(v => v.lang && v.lang.startsWith(utter.lang)) || voices[0];
          if (v) utter.voice = v;
        }
        window.speechSynthesis.speak(utter);
        this._speechUtterance = utter;
      } catch (e) {
        if (CONFIG.verbose) console.warn('Speech failed', e);
      }
    }

    async generateResponse(userMessage) {
      if (this.isGenerating) return null;
      this.isGenerating = true;
      try {
        // learning mode intercept
        if (this.learning.isActive()) {
          const lr = this.learning.process(userMessage);
          if (lr !== null) {
            this.addToMemory('ИИ', lr);
            return lr;
          }
        }
        this.addToMemory('Ты', userMessage);

        // realistic delay
        await new Promise(r => setTimeout(r, Util.clamp(CONFIG.responseDelay + Math.random() * 200, 50, 2000)));

        // generate
        const raw = this.generator.generate(userMessage) || Util.randChoice(this.generator.fallbacks);
        const response = String(raw);

        this.addToMemory('ИИ', response);

        // optionally speak
        if (CONFIG.enableVoice) this.maybeSpeak(response);

        return response;
      } finally {
        this.isGenerating = false;
      }
    }

    getStats() {
      const total = this.memory.length;
      const users = this.memory.filter(m => m.author === 'Ты').length;
      const ais = this.memory.filter(m => m.author === 'ИИ').length;
      return {
        total, users, ais, interests: this.ctx.getUserInterests(), customKB: this.kb.customEntries.length
      };
    }
  }

  // -----------------------------
  // ===== UI helpers ============
  // -----------------------------
  function createElement(tag, opts = {}) {
    const el = document.createElement(tag);
    if (opts.className) el.className = opts.className;
    if (opts.id) el.id = opts.id;
    if (opts.html) el.innerHTML = opts.html;
    if (opts.text) el.textContent = opts.text;
    if (opts.attrs) {
      for (const [k, v] of Object.entries(opts.attrs)) el.setAttribute(k, v);
    }
    return el;
  }

  function applyTheme(root, theme) {
    if (theme === 'light') {
      root.style.setProperty('--bg', '#f6f7fb');
      root.style.setProperty('--card', '#ffffff');
      root.style.setProperty('--text', '#0b1220');
      root.style.setProperty('--muted', '#6b7280');
      root.style.setProperty('--accent', '#06b6d4');
    } else {
      root.style.setProperty('--bg', '#071029');
      root.style.setProperty('--card', '#0b1220');
      root.style.setProperty('--text', '#e6eef8');
      root.style.setProperty('--muted', '#9ca3af');
      root.style.setProperty('--accent', '#10b981');
    }
  }

  // -----------------------------
  // ====== Auto UI builder ======
  // -----------------------------
  function buildUIIfMissing() {
    // If minimal anchors exist, don't create full UI.
    const hasChatBox = !!document.getElementById('chat-box');
    const hasForm = !!document.getElementById('chat-form');
    if (hasChatBox && hasForm) {
      return {
        chatBox: document.getElementById('chat-box'),
        chatForm: document.getElementById('chat-form'),
        chatInput: document.getElementById('chat-input'),
        regenBtn: document.getElementById('regen-btn'),
        clearBtn: document.getElementById('clear-btn'),
        learnBtn: document.getElementById('learn-mode-btn')
      };
    }

    // else create a floating pane
    const root = createElement('div', { id: 'ai-ultra-root', className: 'ai-ultra-root' });
    const style = createElement('style');
    style.textContent = `
      :root{--bg:#071029;--card:#0b1220;--text:#e6eef8;--muted:#9ca3af;--accent:#10b981}
      .ai-ultra-root{position:fixed;right:18px;bottom:18px;width:420px;max-width:95vw;height:620px;z-index:2147483000;font-family:Inter,Roboto,Arial,sans-serif}
      .ai-card{display:flex;flex-direction:column;height:100%;background:linear-gradient(180deg,var(--card),#061022);border-radius:12px;padding:12px;box-shadow:0 12px 40px rgba(2,6,23,.6);color:var(--text);border:1px solid rgba(255,255,255,0.03)}
      .ai-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
      .ai-title{font-weight:700;font-size:14px}
      .ai-controls{display:flex;gap:8px}
      .ai-btn{background:transparent;border:1px solid rgba(255,255,255,0.06);padding:6px 8px;border-radius:8px;color:var(--text);cursor:pointer;font-size:13px}
      .ai-btn.primary{background:var(--accent);border-color:transparent;color:#061022}
      .ai-chat{flex:1;overflow:auto;padding:10px;border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);border:1px solid rgba(255,255,255,0.02)}
      .ai-msg{margin:8px 0;padding:8px;border-radius:10px;max-width:86%;white-space:pre-wrap}
      .ai-msg-user{margin-left:auto;background:linear-gradient(90deg,rgba(255,255,255,0.02),transparent);border:1px solid rgba(255,255,255,0.02)}
      .ai-msg-bot{background:linear-gradient(90deg,rgba(255,255,255,0.01),transparent)}
      .ai-form{display:flex;gap:8px;margin-top:8px}
      .ai-input{flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:var(--text)}
      .ai-meta{font-size:12px;color:var(--muted);margin-top:8px}
      .ai-side{display:flex;flex-direction:column;gap:8px}
      .ai-small{font-size:12px;color:var(--muted)}
    `;
    document.head.appendChild(style);

    const card = createElement('div', { className: 'ai-card' });
    const header = createElement('div', { className: 'ai-header' });
    const title = createElement('div', { className: 'ai-title', text: '🤖 AI Ultra Pro' });
    const controls = createElement('div', { className: 'ai-controls' });
    const regenBtn = createElement('button', { className: 'ai-btn', text: '🔁' });
    regenBtn.title = 'Регенерировать';
    const learnBtn = createElement('button', { className: 'ai-btn', text: '🎓' });
    learnBtn.title = 'Режим обучения';
    const clearBtn = createElement('button', { className: 'ai-btn', text: '🧹' });
    clearBtn.title = 'Очистить';
    const themeBtn = createElement('button', { className: 'ai-btn', text: '🌓' });
    themeBtn.title = 'Тема';

    controls.appendChild(regenBtn);
    controls.appendChild(learnBtn);
    controls.appendChild(themeBtn);
    controls.appendChild(clearBtn);

    header.appendChild(title);
    header.appendChild(controls);
    card.appendChild(header);

    const chatBox = createElement('div', { id: 'chat-box', className: 'ai-chat' });
    card.appendChild(chatBox);

    const form = createElement('form', { id: 'chat-form', className: 'ai-form' });
    const input = createElement('input', { id: 'chat-input', className: 'ai-input', attrs: { placeholder: 'Напиши сообщение и нажми Enter' } });
    input.setAttribute('autocomplete', 'off');
    const sendBtn = createElement('button', { className: 'ai-btn primary', text: 'Отправить' });
    sendBtn.type = 'submit';
    form.appendChild(input);
    form.appendChild(sendBtn);
    card.appendChild(form);

    const meta = createElement('div', { className: 'ai-meta', html: `Локально. <span class="ai-small">Приватно в browser storage</span>` });
    card.appendChild(meta);

    root.appendChild(card);
    document.body.appendChild(root);

    // theme
    applyTheme(root, CONFIG.defaultTheme || 'dark');

    // return elements
    return {
      chatBox: chatBox,
      chatForm: form,
      chatInput: input,
      regenBtn: regenBtn,
      clearBtn: clearBtn,
      learnBtn: learnBtn,
      themeBtn: themeBtn,
      root: root
    };
  }

  // -----------------------------
  // ====== UI Wire-up ===========
  // -----------------------------
  function init() {
    const elements = buildUIIfMissing();
    const ai = new AIUltraPro();

    // bad-ass helper for message display with typing effect
    function renderMessage(author, text, opts = {}) {
      const wrapper = createElement('div', { className: 'ai-msg ' + (author === 'ИИ' ? 'ai-msg-bot' : 'ai-msg-user') });
      const header = createElement('div', { className: 'ai-small', text: `${author} • ${Util.nowISO()}` });
      const content = createElement('div');
      content.className = 'ai-msg-content';
      wrapper.appendChild(header);
      wrapper.appendChild(content);
      elements.chatBox.appendChild(wrapper);
      elements.chatBox.scrollTop = elements.chatBox.scrollHeight;

      // typing effect for bot
      if (CONFIG.enableTypingEffect && author === 'ИИ') {
        content.textContent = '';
        const speed = Math.max(5, Math.floor(1000 / CONFIG.typingCharsPerSec));
        let i = 0;
        const txt = String(text);
        return new Promise(resolve => {
          const iv = setInterval(() => {
            i++;
            content.textContent = txt.slice(0, i);
            elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
            if (i >= txt.length) {
              clearInterval(iv);
              resolve();
            }
          }, speed);
        });
      } else {
        content.innerHTML = Util.escapeHtml(String(text));
        elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
        return Promise.resolve();
      }
    }

    // restore memory
    if (ai.memory.length === 0) {
      const welcome = `Привет! Я AI Ultra Pro — локальный чат-ИИ. Могу помочь с кодом, математикой, школьными задачами и багами.\nНапиши что-нибудь, чтобы начать.`;
      renderMessage('ИИ', welcome);
      ai.addToMemory('ИИ', welcome);
    } else {
      // display last 40 messages
      ai.memory.slice(-40).forEach(m => {
        renderMessage(m.author, m.text);
      });
    }

    // submit
    elements.chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const txt = elements.chatInput.value.trim();
      if (!txt) return;
      elements.chatInput.value = '';
      // render user immediately
      await renderMessage('Ты', txt);
      // show interim typing dot
      const thinking = createElement('div', { className: 'ai-msg ai-msg-bot' });
      thinking.innerHTML = `<div class="ai-small">🤖 ИИ • ${Util.nowISO()}</div><div class="ai-msg-content"><em>Думаю...</em></div>`;
      elements.chatBox.appendChild(thinking);
      elements.chatBox.scrollTop = elements.chatBox.scrollHeight;

      const resp = await ai.generateResponse(txt);
      // remove thinking
      thinking.remove();
      await renderMessage('ИИ', resp || '...');
    });

    // regen button
    if (elements.regenBtn) {
      elements.regenBtn.addEventListener('click', async () => {
        if (ai.isGenerating) return;
        // find last user message
        const lastUser = ai.memory.slice().reverse().find(m => m.author === 'Ты');
        if (!lastUser) {
          alert('Нет пользовательских сообщений для регенерации.');
          return;
        }
        const resp = await ai.generateResponse(lastUser.text);
        await renderMessage('ИИ', resp);
      });
    }

    // clear button
    if (elements.clearBtn) {
      elements.clearBtn.addEventListener('click', () => {
        if (!confirm('Очистить историю? Это удалит локально сохранённые сообщения.')) return;
        ai.clearMemory();
        elements.chatBox.innerHTML = '';
        const welcome = 'История очищена. Готов начать заново!';
        renderMessage('ИИ', welcome);
        ai.addToMemory('ИИ', welcome);
      });
    }

    // learning
    if (elements.learnBtn) {
      elements.learnBtn.addEventListener('click', () => {
        const on = ai.learning.toggle();
        elements.learnBtn.textContent = on ? '🎓 ON' : '🎓';
        const m = on ? 'Режим обучения активирован — пришли паттерн (фразу), затем ответ.' : 'Режим обучения выключен.';
        renderMessage('ИИ', m);
      });
    }

    // theme
    if (elements.themeBtn) {
      elements.themeBtn.addEventListener('click', () => {
        const root = elements.root;
        const cur = root.dataset.theme || CONFIG.defaultTheme || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        applyTheme(root, next);
        root.dataset.theme = next;
      });
    }

    // keyboard shortcut: Ctrl+K focus input
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        elements.chatInput.focus();
      }
    });

    // expose to window
    window.AI_ULTRA_PRO = ai;
    window.AI_ULTRA_UI = elements;
    window.AI_ULTRA_NLP = NLP;

    if (CONFIG.verbose) {
      console.log('AI Ultra Pro initiated', ai.getStats());
    }
  }

  // auto init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

ller
