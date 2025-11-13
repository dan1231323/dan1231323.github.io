/* ai-ultra-pro.js
   Продвинутый локальный чат-ИИ с контекстом, обучением и NLP
   Подключение: <script src="ai-ultra-pro.js"></script>
   Элементы: chat-form, chat-input, chat-box, regen-btn, clear-btn, learn-mode-btn
*/

(function() {
  'use strict';

  // ============================================
  // КОНФИГУРАЦИЯ
  // ============================================
  const CONFIG = {
    responseDelay: 400,
    memoryLimit: 100,
    contextWindow: 10,
    minSimilarity: 0.32,
    learningRate: 0.1,
    temperature: 0.7,
    verbose: false,
    useTFIDF: true,
    useContextAwareness: true
  };

  // ============================================
  // NLP УТИЛИТЫ (улучшенные)
  // ============================================
  
  const NLP = {
    // Стоп-слова для русского и английского
    stopWords: new Set([
      'и', 'в', 'на', 'с', 'по', 'для', 'к', 'от', 'о', 'у', 'из', 'за', 'до', 'при',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
      'это', 'то', 'все', 'всё', 'так', 'вот', 'быть', 'как', 'его', 'но', 'да', 'ты', 'я'
    ]),

    // Улучшенная нормализация
    normalize(text) {
      if (!text) return "";
      return text.toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    // Продвинутый стемминг
    stem(word) {
      if (word.length < 4) return word;
      
      // Русские окончания (более полный список)
      const ruSuffixes = /(ова|ева|ение|ание|ость|ость|ние|ие|ей|ой|ый|ая|ое|ые|ими|ами|его|ого|ему|ому|ую|юю|ою|ею|ать|ять|еть|ить|ти|чь|ешь|ишь|ете|ите|ут|ют|ат|ят)$/i;
      // Английские окончания
      const enSuffixes = /(ational|tional|encing|ancing|ization|isation|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|ing|ed|es|s|ly|tion|ment|ness)$/i;
      
      return word.replace(ruSuffixes, '').replace(enSuffixes, '');
    },

    // Токенизация с фильтрацией стоп-слов
    tokenize(text, removeStopWords = true) {
      const tokens = this.normalize(text).split(' ').filter(Boolean);
      if (!removeStopWords) return tokens;
      return tokens.filter(t => !this.stopWords.has(t) && t.length > 1);
    },

    // TF-IDF scoring
    tfidf(query, documents) {
      const queryTokens = this.tokenize(query).map(t => this.stem(t));
      const scores = [];

      for (const doc of documents) {
        const docTokens = this.tokenize(doc.text).map(t => this.stem(t));
        let score = 0;

        for (const qToken of queryTokens) {
          const tf = docTokens.filter(t => t === qToken).length / docTokens.length;
          const idf = Math.log(documents.length / (1 + documents.filter(d => 
            this.tokenize(d.text).map(t => this.stem(t)).includes(qToken)
          ).length));
          score += tf * idf;
        }

        scores.push({ doc, score });
      }

      return scores.sort((a, b) => b.score - a.score);
    },

    // Улучшенный Levenshtein с оптимизацией
    levenshtein(a, b) {
      if (a === b) return 1;
      if (!a || !b) return 0;
      
      const m = a.length, n = b.length;
      if (m === 0 || n === 0) return 0;
      if (Math.abs(m - n) > Math.max(m, n) * 0.5) return 0; // быстрый выход
      
      const prev = Array(n + 1).fill(0);
      const curr = Array(n + 1).fill(0);
      
      for (let j = 0; j <= n; j++) prev[j] = j;
      
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          curr[j] = Math.min(
            prev[j] + 1,
            curr[j - 1] + 1,
            prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }
        prev.splice(0, prev.length, ...curr);
      }
      
      return 1 - (curr[n] / Math.max(m, n));
    },

    // Jaccard similarity для токенов
    jaccard(a, b) {
      const setA = new Set(this.tokenize(a).map(t => this.stem(t)));
      const setB = new Set(this.tokenize(b).map(t => this.stem(t)));
      
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      
      return union.size === 0 ? 0 : intersection.size / union.size;
    },

    // Cosine similarity с векторизацией
    cosine(a, b) {
      const tokensA = this.tokenize(a).map(t => this.stem(t));
      const tokensB = this.tokenize(b).map(t => this.stem(t));
      
      const allTokens = [...new Set([...tokensA, ...tokensB])];
      const vecA = allTokens.map(t => tokensA.filter(x => x === t).length);
      const vecB = allTokens.map(t => tokensB.filter(x => x === t).length);
      
      const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
      const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
      const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
      
      return magA && magB ? dotProduct / (magA * magB) : 0;
    },

    // Комбинированная метрика сходства (ensemble)
    similarity(a, b) {
      if (!a || !b) return 0;
      
      const na = this.normalize(a);
      const nb = this.normalize(b);
      
      if (na === nb) return 1;
      if (na.includes(nb) || nb.includes(na)) return 0.92;
      
      const jaccard = this.jaccard(a, b);
      const cosine = this.cosine(a, b);
      const lev = this.levenshtein(na, nb);
      
      // Взвешенная комбинация метрик
      return Math.max(
        0.4 * cosine + 0.35 * jaccard + 0.25 * lev,
        jaccard * 0.9,
        cosine * 0.9
      );
    },

    // Извлечение именованных сущностей (простая версия)
    extractEntities(text) {
      const entities = {
        numbers: [],
        urls: [],
        emails: [],
        mentions: []
      };
      
      // Числа
      const numbers = text.match(/\b\d+(?:\.\d+)?\b/g);
      if (numbers) entities.numbers = numbers.map(n => parseFloat(n));
      
      // URLs
      const urls = text.match(/https?:\/\/[^\s]+/g);
      if (urls) entities.urls = urls;
      
      // Email
      const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
      if (emails) entities.emails = emails;
      
      return entities;
    },

    // Определение тональности (sentiment analysis)
    getSentiment(text) {
      const positive = ['хорошо', 'отлично', 'супер', 'круто', 'классно', 'здорово', 'люблю', 'нравится', 'рад', 'счастлив', 'good', 'great', 'awesome', 'excellent', 'love', 'like', 'happy'];
      const negative = ['плохо', 'ужасно', 'грустно', 'не нравится', 'ненавижу', 'отвратительно', 'bad', 'terrible', 'awful', 'hate', 'sad', 'angry'];
      
      const tokens = this.tokenize(text.toLowerCase());
      let score = 0;
      
      tokens.forEach(t => {
        if (positive.some(p => t.includes(p))) score++;
        if (negative.some(n => t.includes(n))) score--;
      });
      
      return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    },

    // Определение намерения (intent classification)
    classifyIntent(text) {
      const intents = {
        question: /\b(что|как|почему|зачем|когда|где|кто|какой|сколько|what|how|why|when|where|who|which)\b/i,
        greeting: /\b(привет|здравствуй|hi|hello|hey|yo|доброе утро|добрый день)\b/i,
        farewell: /\b(пока|до свидания|bye|goodbye|увидимся|до встречи)\b/i,
        command: /\b(сделай|создай|покажи|напиши|найди|make|create|show|write|find)\b/i,
        thanks: /\b(спасибо|благодарю|thanks|thank you)\b/i
      };
      
      for (const [intent, pattern] of Object.entries(intents)) {
        if (pattern.test(text)) return intent;
      }
      
      return 'statement';
    }
  };

  // ============================================
  // КОНТЕКСТНЫЙ МЕНЕДЖЕР
  // ============================================
  
  class ContextManager {
    constructor() {
      this.conversation = [];
      this.userProfile = {
        name: null,
        interests: new Set(),
        topics: new Map(),
        sentiment: { positive: 0, neutral: 0, negative: 0 }
      };
    }

    addMessage(author, text) {
      this.conversation.push({
        author,
        text,
        timestamp: Date.now(),
        intent: NLP.classifyIntent(text),
        sentiment: NLP.getSentiment(text),
        entities: NLP.extractEntities(text)
      });

      if (this.conversation.length > CONFIG.contextWindow) {
        this.conversation.shift();
      }

      // Обновление профиля
      if (author === 'Ты') {
        this.updateProfile(text);
      }
    }

    updateProfile(text) {
      const sentiment = NLP.getSentiment(text);
      this.userProfile.sentiment[sentiment]++;

      // Извлечение интересов из ключевых слов
      const keywords = ['программирование', 'футбол', 'игры', 'музыка', 'кино', 'учеба', 'школа'];
      keywords.forEach(kw => {
        if (text.toLowerCase().includes(kw)) {
          this.userProfile.interests.add(kw);
          const count = this.userProfile.topics.get(kw) || 0;
          this.userProfile.topics.set(kw, count + 1);
        }
      });
    }

    getContext(depth = 5) {
      return this.conversation.slice(-depth);
    }

    getRelevantContext(query) {
      const recent = this.conversation.slice(-CONFIG.contextWindow);
      return recent
        .filter(msg => NLP.similarity(msg.text, query) > 0.3)
        .slice(-3);
    }

    hasPattern(pattern, lookback = 5) {
      const recent = this.conversation.slice(-lookback);
      return recent.some(msg => 
        msg.text.toLowerCase().includes(pattern.toLowerCase())
      );
    }

    getUserInterests() {
      return Array.from(this.userProfile.interests);
    }
  }

  // ============================================
  // ОБУЧАЕМАЯ БАЗА ЗНАНИЙ
  // ============================================
  
  class KnowledgeBase {
    constructor() {
      this.entries = this.getDefaultKB();
      this.customEntries = this.loadCustomKB();
      this.entryUsage = new Map();
    }

    getDefaultKB() {
      return [
        // Приветствия
        {
          id: 'greet_1',
          patterns: ['привет', 'здравствуй', 'hi', 'hello', 'hey', 'доброе утро', 'добрый день'],
          responses: [
            "Привет! 😊 Чем могу помочь?",
            "Здорова! Что интересного сегодня будем делать?",
            "Хай! Готов поболтать или помочь с задачами!",
            "Приветик! Расскажи, что у тебя нового?"
          ],
          context: ['greeting'],
          weight: 1.0
        },

        // Вопросы о состоянии
        {
          id: 'howru_1',
          patterns: ['как дела', 'как ты', 'how are you', 'как поживаешь'],
          responses: [
            "Отлично работаю! 💻 А у тебя как день проходит?",
            "Всё супер, готов помогать! Что нового у тебя?",
            "Заряжен энергией и готов к интересным задачам! Чем займёмся?"
          ],
          context: ['smalltalk'],
          weight: 1.0
        },

        // О себе
        {
          id: 'about_1',
          patterns: ['кто ты', 'что ты', 'who are you', 'расскажи о себе'],
          responses: [
            "Я продвинутый локальный чат-бот! 🤖 Могу помогать с учёбой, кодом, отвечать на вопросы и учиться от тебя.",
            "Я твой персональный ИИ-помощник — работаю полностью локально, сохраняю контекст и становлюсь умнее с каждым разговором!",
            "Я автономный чат-бот с NLP и машинным обучением. Программирование, школьные задачи, общие вопросы — всё по мне!"
          ],
          context: ['about'],
          weight: 1.0
        },

        // Программирование
        {
          id: 'prog_1',
          patterns: ['программирование', 'код', 'javascript', 'python', 'html', 'css', 'coding', 'разработка'],
          responses: [
            "Программирование — это круто! 💻 JavaScript, Python, HTML/CSS — что тебя интересует?",
            "Я могу помочь с кодом! Опиши задачу или покажи фрагмент кода, если нужна помощь.",
            "Веб-разработка (HTML/CSS/JS), бэкенд (Node.js), скрипты (Python) — какое направление изучаешь?",
            "Давай поговорим о коде! Нужна помощь с алгоритмом, отладкой или объяснением концепции?"
          ],
          context: ['programming', 'technical'],
          weight: 1.2,
          responder: (msg, ctx) => {
            // Детектим конкретный язык программирования
            const langs = {
              'javascript': 'JavaScript — мощный язык для веба! Асинхронность, DOM, фреймворки — что разбираем?',
              'python': 'Python — универсальный язык! Скрипты, данные, ML — для чего используешь?',
              'html': 'HTML — структура веба. Семантика, доступность, SEO — что важно узнать?',
              'css': 'CSS — магия стилей! Flexbox, Grid, анимации — что интересует?'
            };
            
            const normalized = msg.toLowerCase();
            for (const [lang, response] of Object.entries(langs)) {
              if (normalized.includes(lang)) return response;
            }
            return null;
          }
        },

        // Математика с вычислениями
        {
          id: 'math_1',
          patterns: ['посчитай', 'сколько будет', 'вычисли', 'calculate', 'математика', '+', '-', '*', '/'],
          responses: ["Давай посчитаем! Введи выражение (например: 15 * 7 + 3)"],
          context: ['math'],
          weight: 1.0,
          responder: (msg) => {
            // Безопасное вычисление математических выражений
            try {
              const expr = msg.replace(/[^0-9+\-*/()., ]/g, '').replace(/,/g, '.');
              if (expr.length > 0 && expr.length < 200 && /[0-9]/.test(expr)) {
                const result = Function('"use strict"; return (' + expr + ')')();
                if (typeof result === 'number' && isFinite(result)) {
                  return `Результат: ${result.toFixed(4).replace(/\.?0+$/, '')} 🔢`;
                }
              }
            } catch (e) {
              return "Не могу вычислить это выражение. Проверь синтаксис!";
            }
            return null;
          }
        },

        // Время и дата
        {
          id: 'time_1',
          patterns: ['который час', 'текущее время', 'какое время', 'дата', 'сегодня', 'time', 'date'],
          responses: [],
          context: ['utility'],
          weight: 1.0,
          responder: () => {
            const now = new Date();
            const time = now.toLocaleTimeString('ru-RU');
            const date = now.toLocaleDateString('ru-RU', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            return `🕐 Сейчас ${time}\n📅 ${date}`;
          }
        },

        // Футбол
        {
          id: 'football_1',
          patterns: ['футбол', 'football', 'гол', 'пас', 'дриблинг', 'тренировка'],
          responses: [
            "⚽ Футбол — топ! Какая позиция твоя любимая?",
            "Тренируй технику: дриблинг, первый пас, позиционирование — основа всего!",
            "Я за Barcelona стиль — владение мячом и комбинации! А ты за какую команду?",
            "Футбольная физика интересна: траектории ударов, spin effect — это математика и физика!"
          ],
          context: ['sports', 'football'],
          weight: 1.0
        },

        // Игры
        {
          id: 'games_1',
          patterns: ['игры', 'game', 'minecraft', 'roblox', 'геймдев', 'gamedev'],
          responses: [
            "🎮 Игры — это круто! Какой жанр любишь? Платформеры, RPG, стратегии?",
            "Я могу помочь создать простую браузерную игру на JavaScript!",
            "Интересуешься геймдевом? Можно начать с HTML5 Canvas или Phaser.js",
            "Minecraft, Roblox — в них можно учиться программированию через моддинг!"
          ],
          context: ['games', 'entertainment'],
          weight: 1.0
        },

        // Школа и учёба
        {
          id: 'school_1',
          patterns: ['школа', 'учёба', 'урок', 'домашка', 'дз', 'контрольная', 'экзамен'],
          responses: [
            "📚 Школьные задачи? Опиши вопрос — помогу разобраться пошагово!",
            "Я не делаю домашку за тебя, но объясню логику решения. Какой предмет?",
            "Математика, физика, информатика — мои сильные стороны. Что нужно понять?",
            "Готовишься к контрольной? Могу помочь с повторением материала!"
          ],
          context: ['education', 'school'],
          weight: 1.0
        },

        // Шутки
        {
          id: 'jokes_1',
          patterns: ['шутка', 'joke', 'анекдот', 'рассмеши', 'расскажи смешное'],
          responses: [
            "Почему программисты путают Хэллоуин и Рождество? Потому что OCT 31 == DEC 25! 🎃🎄",
            "— Сколько программистов нужно, чтобы вкрутить лампочку?\n— Ни одного, это аппаратная проблема! 💡",
            "Программист застрял в душе, потому что на шампуне написано: 'Намылить, смыть, повторить' 🚿",
            "Bug — это не ошибка, это недокументированная фича! 🐛",
            "Array starts at 0, как и мотивация в понедельник утром ☕"
          ],
          context: ['entertainment', 'humor'],
          weight: 1.0
        },

        // Благодарность
        {
          id: 'thanks_1',
          patterns: ['спасибо', 'благодарю', 'thank', 'thx'],
          responses: [
            "Пожалуйста! 😊 Всегда рад помочь!",
            "Не за что! Обращайся, если что-то ещё нужно!",
            "Рад был помочь! 👍"
          ],
          context: ['thanks'],
          weight: 1.0
        },

        // Прощание
        {
          id: 'bye_1',
          patterns: ['пока', 'до свидания', 'bye', 'goodbye', 'увидимся'],
          responses: [
            "Пока! 👋 Возвращайся, если нужна помощь!",
            "До встречи! Хорошего дня! ☀️",
            "Увидимся! Буду рад новым вопросам! 😊"
          ],
          context: ['farewell'],
          weight: 1.0
        },

        // Помощь
        {
          id: 'help_1',
          patterns: ['помощь', 'help', 'что ты умеешь', 'команды', 'возможности'],
          responses: [
            "Я могу:\n• Отвечать на вопросы\n• Помогать с программированием\n• Решать математику\n• Болтать на разные темы\n• Учиться от тебя!\n\nПросто спрашивай — я постараюсь помочь! 💡"
          ],
          context: ['help'],
          weight: 1.0
        }
      ];
    }

    loadCustomKB() {
      try {
        const stored = localStorage.getItem('ai_ultra_custom_kb');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }

    saveCustomKB() {
      try {
        localStorage.setItem('ai_ultra_custom_kb', JSON.stringify(this.customEntries));
      } catch (e) {
        console.error('Failed to save custom KB');
      }
    }

    addCustomEntry(pattern, response) {
      const id = 'custom_' + Date.now();
      this.customEntries.push({
        id,
        patterns: [pattern],
        responses: [response],
        context: ['learned'],
        weight: 0.8,
        learned: true
      });
      this.saveCustomKB();
      return id;
    }

    getAllEntries() {
      return [...this.entries, ...this.customEntries];
    }

    recordUsage(entryId) {
      const count = this.entryUsage.get(entryId) || 0;
      this.entryUsage.set(entryId, count + 1);
    }

    getPopularEntries(limit = 5) {
      return Array.from(this.entryUsage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => this.getAllEntries().find(e => e.id === id))
        .filter(Boolean);
    }
  }

  // ============================================
  // ГЕНЕРАТОР ОТВЕТОВ (Ядро ИИ)
  // ============================================
  
  class ResponseGenerator {
    constructor(kb, contextManager) {
      this.kb = kb;
      this.ctx = contextManager;
      this.fallbackResponses = [
        "Интересный вопрос! 🤔 Можешь переформулировать или добавить деталей?",
        "Хм, пока не уверен в ответе. Расскажи подробнее, что тебя интересует?",
        "Это новая тема для меня! Помоги понять лучше — задай вопрос по-другому.",
        "Я учусь с каждым разговором! Давай разберём это вместе — объясни подробнее."
      ];
    }

    generate(userMessage) {
      // 1. Поиск лучшего совпадения
      const bestMatch = this.findBestMatch(userMessage);
      
      if (CONFIG.verbose) {
        console.log('Best match:', bestMatch);
      }

      // 2. Если есть custom responder
      if (bestMatch && bestMatch.entry.responder) {
        const customResponse = bestMatch.entry.responder(userMessage, this.ctx);
        if (customResponse) {
          this.kb.recordUsage(bestMatch.entry.id);
          return this.addPersonalization(customResponse);
        }
      }

      // 3. Если score выше порога
      if (bestMatch && bestMatch.score >= CONFIG.minSimilarity) {
        this.kb.recordUsage(bestMatch.entry.id);
        const response = this.selectResponse(bestMatch.entry);
        return this.addPersonalization(response);
      }

      // 4. Контекстный fallback
      const contextResponse = this.generateContextualFallback(userMessage);
      if (contextResponse) return contextResponse;

      // 5. Generic fallback
      return this.randomChoice(this.fallbackResponses);
    }

    findBestMatch(userMessage) {
      const allEntries = this.kb.getAllEntries();
      let bestScore = 0;
      let bestEntry = null;

      // Используем TF-IDF если включено
      if (CONFIG.useTFIDF) {
        const documents = allEntries.map(entry => ({
          text: entry.patterns.join(' '),
          entry
        }));
        
        const tfidfScores = NLP.tfidf(userMessage, documents);
        
        if (tfidfScores[0] && tfidfScores[0].score > 0.1) {
          return {
            entry: tfidfScores[0].doc.entry,
            score: tfidfScores[0].score * 2, // boost TF-IDF score
            method: 'tfidf'
          };
        }
      }

      // Обычный поиск по similarity
      for (const entry of allEntries) {
        for (const pattern of entry.patterns) {
          const similarity = NLP.similarity(userMessage, pattern);
          const weightedScore = similarity * (entry.weight || 1.0);
          
          if (weightedScore > bestScore) {
            bestScore = weightedScore;
            bestEntry = entry;
          }
        }
      }

      return bestEntry ? { entry: bestEntry, score: bestScore, method: 'similarity' } : null;
    }

    selectResponse(entry) {
      if (!entry.responses || entry.responses.length === 0) {
        return this.randomChoice(this.fallbackResponses);
      }

      // Temperature-based selection (более случайный выбор при высокой temperature)
      if (Math.random() < CONFIG.temperature) {
        return this.randomChoice(entry.responses);
      }
      
      // Иначе выбираем наименее использованный ответ
      return entry.responses[0];
    }

    generateContextualFallback(userMessage) {
      // Анализируем контекст разговора
      const recentContext = this.ctx.getRelevantContext(userMessage);
      
      if (recentContext.length > 0) {
        const lastTopic = recentContext[recentContext.length - 1];
        return `Продолжаем про ${this.extractTopic(lastTopic.text)}? Или это новый вопрос?`;
      }

      // Проверяем намерение
      const intent = NLP.classifyIntent(userMessage);
      
      const intentResponses = {
        question: "Хороший вопрос! 🤔 Дай мне больше контекста — что именно интересует?",
        command: "Понял задачу! Но нужны детали — опиши точнее, что нужно сделать.",
        greeting: "Привет! 👋 Чем могу помочь?",
        farewell: "Пока! 😊 Было приятно пообщаться!"
      };

      if (intentResponses[intent]) {
        return intentResponses[intent];
      }

      // Проверяем интересы пользователя
      const interests = this.ctx.getUserInterests();
      if (interests.length > 0) {
        const interest = this.randomChoice(interests);
        return `Кстати, ты интересуешься ${interest} — может, это связано с твоим вопросом?`;
      }

      return null;
    }

    extractTopic(text) {
      const topics = ['программирование', 'футбол', 'игры', 'учёба', 'математика'];
      for (const topic of topics) {
        if (text.toLowerCase().includes(topic)) return topic;
      }
      return 'это';
    }

    addPersonalization(response) {
      // Добавляем персонализацию на основе профиля
      const sentiment = this.ctx.userProfile.sentiment;
      const totalSentiment = sentiment.positive + sentiment.neutral + sentiment.negative;
      
      if (totalSentiment > 10) {
        const positiveRatio = sentiment.positive / totalSentiment;
        
        // Если пользователь в основном позитивный, добавляем энергичности
        if (positiveRatio > 0.6 && Math.random() < 0.3) {
          const energizers = ['💪', '🔥', '⚡', '🚀', '✨'];
          response += ' ' + this.randomChoice(energizers);
        }
      }

      return response;
    }

    randomChoice(array) {
      return array[Math.floor(Math.random() * array.length)];
    }
  }

  // ============================================
  // РЕЖИМ ОБУЧЕНИЯ
  // ============================================
  
  class LearningMode {
    constructor(kb) {
      this.kb = kb;
      this.active = false;
      this.awaitingPattern = false;
      this.pendingPattern = null;
    }

    toggle() {
      this.active = !this.active;
      return this.active;
    }

    isActive() {
      return this.active;
    }

    process(message) {
      if (!this.awaitingPattern) {
        // Ждём паттерн для обучения
        this.pendingPattern = message;
        this.awaitingPattern = true;
        return "Отлично! Теперь скажи, как мне отвечать на это?";
      } else {
        // Получили ответ, сохраняем
        const response = message;
        this.kb.addCustomEntry(this.pendingPattern, response);
        this.awaitingPattern = false;
        this.pendingPattern = null;
        return `Спасибо! Я запомнил: на "${this.pendingPattern}" отвечать "${response}" ✅`;
      }
    }

    cancel() {
      this.awaitingPattern = false;
      this.pendingPattern = null;
    }
  }

  // ============================================
  // ГЛАВНОЕ ПРИЛОЖЕНИЕ
  // ============================================
  
  class AIUltraPro {
    constructor() {
      this.kb = new KnowledgeBase();
      this.ctx = new ContextManager();
      this.generator = new ResponseGenerator(this.kb, this.ctx);
      this.learningMode = new LearningMode(this.kb);
      this.memory = this.loadMemory();
      this.isGenerating = false;
    }

    loadMemory() {
      try {
        const stored = localStorage.getItem('ai_ultra_pro_memory');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }

    saveMemory() {
      try {
        localStorage.setItem('ai_ultra_pro_memory', JSON.stringify(this.memory));
      } catch (e) {
        console.error('Failed to save memory');
      }
    }

    addToMemory(author, text) {
      this.memory.push({
        author,
        text,
        timestamp: Date.now()
      });

      if (this.memory.length > CONFIG.memoryLimit) {
        this.memory = this.memory.slice(-CONFIG.memoryLimit);
      }

      this.ctx.addMessage(author, text);
      this.saveMemory();
    }

    clearMemory() {
      this.memory = [];
      this.ctx.conversation = [];
      this.saveMemory();
    }

    async generateResponse(userMessage) {
      if (this.isGenerating) return null;
      
      this.isGenerating = true;
      
      try {
        // Проверяем режим обучения
        if (this.learningMode.isActive()) {
          return this.learningMode.process(userMessage);
        }

        // Добавляем в контекст
        this.addToMemory('Ты', userMessage);

        // Небольшая задержка для реалистичности
        await this.sleep(CONFIG.responseDelay);

        // Генерируем ответ
        const response = this.generator.generate(userMessage);
        
        // Сохраняем ответ
        this.addToMemory('ИИ', response);

        return response;
      } finally {
        this.isGenerating = false;
      }
    }

    getStats() {
      const totalMessages = this.memory.length;
      const userMessages = this.memory.filter(m => m.author === 'Ты').length;
      const aiMessages = this.memory.filter(m => m.author === 'ИИ').length;
      const interests = this.ctx.getUserInterests();
      const customEntries = this.kb.customEntries.length;

      return {
        totalMessages,
        userMessages,
        aiMessages,
        interests,
        customEntries,
        sentiment: this.ctx.userProfile.sentiment
      };
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // ============================================
  // UI INTEGRATION
  // ============================================
  
  function initUI() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const regenBtn = document.getElementById('regen-btn');
    const clearBtn = document.getElementById('clear-btn');
    const learnBtn = document.getElementById('learn-mode-btn');

    if (!chatForm || !chatInput || !chatBox) {
      console.warn('AI Ultra Pro: Required elements not found');
      return;
    }

    const ai = new AIUltraPro();

    // Утилиты UI
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function appendMessage(author, text, isLoading = false) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ai-msg ${author === 'ИИ' ? 'ai-msg-bot' : 'ai-msg-user'}`;
      
      const time = new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const authorLabel = author === 'ИИ' ? '🤖 AI Ultra Pro' : '👤 Ты';
      
      msgDiv.innerHTML = `
        <div class="msg-header">
          <strong>${authorLabel}</strong>
          <span class="msg-time">${time}</span>
        </div>
        <div class="msg-content">${isLoading ? text : escapeHtml(text)}</div>
      `;

      chatBox.appendChild(msgDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
      
      return msgDiv;
    }

    function removeLoadingMessage() {
      const loadingMsgs = chatBox.querySelectorAll('.ai-msg-bot');
      const lastMsg = loadingMsgs[loadingMsgs.length - 1];
      if (lastMsg && lastMsg.textContent.includes('...')) {
        lastMsg.remove();
      }
    }

    // Приветственное сообщение
    if (ai.memory.length === 0) {
      const welcome = "Привет! Я AI Ultra Pro — продвинутый локальный чат-бот! 🤖\n\nЯ могу:\n• Отвечать на вопросы\n• Помогать с программированием и учёбой\n• Вычислять математику\n• Болтать на разные темы\n• Обучаться от тебя!\n\nНапиши что-нибудь, чтобы начать! 💬";
      appendMessage('ИИ', welcome);
      ai.addToMemory('ИИ', welcome);
    } else {
      // Восстанавливаем последние сообщения
      ai.memory.slice(-15).forEach(msg => {
        appendMessage(msg.author, msg.text);
      });
    }

    // Обработка отправки сообщения
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const userMsg = chatInput.value.trim();
      if (!userMsg || ai.isGenerating) return;

      // Показываем сообщение пользователя
      appendMessage('Ты', userMsg);
      chatInput.value = '';

      // Показываем индикатор загрузки
      const loadingMsg = appendMessage('ИИ', '<span class="loading">Думаю...</span>', true);

      // Генерируем ответ
      const response = await ai.generateResponse(userMsg);
      
      if (response) {
        removeLoadingMessage();
        appendMessage('ИИ', response);
      }
    });

    // Кнопка регенерации
    if (regenBtn) {
      regenBtn.addEventListener('click', async () => {
        if (ai.isGenerating) return;

        const lastUserMsg = ai.memory.slice().reverse().find(m => m.author === 'Ты');
        if (!lastUserMsg) {
          alert('Нет сообщений для регенерации');
          return;
        }

        const loadingMsg = appendMessage('ИИ', '<span class="loading">Переосмысляю...</span>', true);
        
        // Удаляем последний ответ ИИ из памяти
        const lastAiIndex = ai.memory.map(m => m.author).lastIndexOf('ИИ');
        if (lastAiIndex !== -1) {
          ai.memory.splice(lastAiIndex, 1);
        }

        const response = await ai.generateResponse(lastUserMsg.text);
        
        if (response) {
          removeLoadingMessage();
          appendMessage('ИИ', response);
        }
      });
    }

    // Кнопка очистки
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Очистить всю историю чата? Это действие нельзя отменить.')) {
          ai.clearMemory();
          chatBox.innerHTML = '';
          
          const welcome = "История очищена! Начнём сначала? 😊";
          appendMessage('ИИ', welcome);
          ai.addToMemory('ИИ', welcome);
        }
      });
    }

    // Кнопка режима обучения
    if (learnBtn) {
      learnBtn.addEventListener('click', () => {
        const isActive = ai.learningMode.toggle();
        learnBtn.textContent = isActive ? '📚 Режим обучения ON' : '🎓 Режим обучения';
        learnBtn.style.background = isActive ? '#10b981' : '';
        
        if (isActive) {
          appendMessage('ИИ', "🎓 Режим обучения активирован! Напиши фразу, на которую я должен научиться отвечать.");
          ai.addToMemory('ИИ', "Режим обучения активирован");
        } else {
          ai.learningMode.cancel();
          appendMessage('ИИ', "Режим обучения выключен.");
          ai.addToMemory('ИИ', "Режим обучения выключен");
        }
      });
    }

    // Автофокус на input
    chatInput.focus();

    // Enter для отправки, Shift+Enter для новой строки
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
      }
    });

    // Экспорт в window для консоли
    window.AI_ULTRA_PRO = ai;
    window.AI_NLP = NLP;

    // Логируем готовность
    if (CONFIG.verbose) {
      console.log('🤖 AI Ultra Pro initialized');
      console.log('📊 Stats:', ai.getStats());
      console.log('💡 Use window.AI_ULTRA_PRO to interact via console');
    }
  }

  // ============================================
  // АВТОЗАПУСК
  // ============================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

})();
