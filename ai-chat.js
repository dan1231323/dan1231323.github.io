/* ai-ultra.js
   Ультра локальный чат-ИИ (NLP-подобный, автономный).
   Подключение: в index.html перед </body> добавить:
   <script src="ai-ultra.js"></script>
   Элементы на странице (id): chat-form, chat-input, chat-box, regen-btn (опц.), clear-btn (опц.)
*/

(function(){
  // ---------------------------
  // Настройка (можешь менять)
  // ---------------------------
  const CONFIG = {
    responseDelay: 350,      // ms: задержка перед ответом (имитирует "думание")
    memoryLimit: 40,         // сколько последних сообщений хранить
    minSimilarity: 0.35,     // порог схожести для ответа
    verbose: false           // если true — логируем внутрь console.log
  };

  // ---------------------------
  // Помощники: нормализация, токенизация, метрики
  // ---------------------------
  function normText(s){
    if(!s) return "";
    return s.toLowerCase()
            .replace(/ё/g,'е')
            .replace(/[^\p{L}\p{N}\s]/gu,' ') // убрать пунктуацию, оставить буквы/цифры
            .replace(/\s+/g,' ')
            .trim();
  }

  function tokenize(s){
    return normText(s).split(' ').filter(Boolean);
  }

  // простая стемминг-подобная правка — удаляем частые русские окончания и английские suffixes
  function stem(word){
    return word.replace(/(ing|ed|s|es|ly|tion|ment|ness|ый|ая|ое|ие|ого|ему|ами|ями|ами|ого|ая|ий|ью|ью|ия)$/i,'');
  }

  function wordsSet(s){
    return Array.from(new Set(tokenize(s).map(stem)));
  }

  // Levenshtein distance normalized (0..1 similarity)
  function levenshtein(a,b){
    if(a===b) return 1;
    a = a||""; b = b||"";
    const m = a.length, n = b.length;
    if(m===0) return 0;
    if(n===0) return 0;
    const dp = Array.from({length:m+1},(_,i)=>Array(n+1).fill(0));
    for(let i=0;i<=m;i++) dp[i][0]=i;
    for(let j=0;j<=n;j++) dp[0][j]=j;
    for(let i=1;i<=m;i++){
      for(let j=1;j<=n;j++){
        dp[i][j] = Math.min(
          dp[i-1][j]+1,
          dp[i][j-1]+1,
          dp[i-1][j-1] + (a[i-1]===b[j-1]?0:1)
        );
      }
    }
    const dist = dp[m][n];
    const max = Math.max(m,n);
    return 1 - (dist / max); // similarity
  }

  // Jaro-Winkler quick impl for fuzzy
  function jaroWinkler(s1, s2){
    if(!s1 || !s2) return 0;
    s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
    if (s1 === s2) return 1;
    const m = 0;
    const matchDistance = Math.floor(Math.max(s1.length, s2.length)/2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);
    let matches = 0;
    for(let i=0;i<s1.length;i++){
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, s2.length);
      for(let j=start;j<end;j++){
        if(s2Matches[j]) continue;
        if(s1[i] !== s2[j]) continue;
        s1Matches[i] = s2Matches[j] = true;
        matches++;
        break;
      }
    }
    if(matches === 0) return 0;
    let t = 0;
    let k = 0;
    for(let i=0;i<s1.length;i++){
      if(!s1Matches[i]) continue;
      while(!s2Matches[k]) k++;
      if(s1[i] !== s2[k]) t++;
      k++;
    }
    t = t/2;
    const mRatio = matches / s1.length;
    const mRatio2 = matches / s2.length;
    const jaro = ( (matches/s1.length) + (matches/s2.length) + ((matches - t)/matches) ) / 3;
    // winkler boost
    let l = 0;
    const prefixLimit = 4;
    for(let i=0;i<Math.min(prefixLimit, s1.length, s2.length);i++){
      if(s1[i] === s2[i]) l++; else break;
    }
    const p = 0.1;
    return jaro + l * p * (1 - jaro);
  }

  // similarity between texts using tokens + levenshtein averages
  function similarity(a,b){
    if(!a || !b) return 0;
    const na = normText(a), nb = normText(b);
    // exact substring
    if(na === nb) return 1;
    if(na.includes(nb) || nb.includes(na)) return 0.9;
    const ta = tokenize(na), tb = tokenize(nb);
    // token overlap score
    const setA = new Set(ta.map(stem)), setB = new Set(tb.map(stem));
    let common = 0;
    for(const w of setA) if(setB.has(w)) common++;
    const overlap = common / Math.max(setA.size, setB.size, 1);
    // average levenshtein on joined
    const lev = levenshtein(na, nb);
    const jw = jaroWinkler(na, nb);
    const score = Math.max(overlap, 0.25*lev + 0.35*jw + 0.4*overlap);
    return Math.min(1, Math.max(0, score));
  }

  // ---------------------------
  // База знаний / паттерны (обширно)
  // Можно дополнять/редактировать
  // ---------------------------
  const KB = [
    // greetings
    { tags:['greeting'], patterns: ['привет','здравствуй','hi','hello','hii','hey','yo'], replies:[
      "Привет! 😊 Чем займёмся?", "Хай! Как день идёт?", "Здорова! Что нового?"
    ]},
    // how are you
    { tags:['smalltalk'], patterns: ['как дела','how are you','как ты','как поживаешь'], replies:[
      "Всё норм — готов помогать с кодом и школьными задачами!", "Отлично, спасибо — а у тебя как?",
      "Норм, заряжен на создание сайтов и игр 💻⚽"
    ]},
    // about me
    { tags:['about'], patterns: ['кто ты','что ты','who are you','ты кто'], replies:[
      "Я локальный чат-ИИ — лёгкий, автономный и обучаемый. Я могу отвечать на простые вопросы.",
      "Я твоё школьное ИИ-приложение: отвечает на вопросы, болтает про футбол и код."
    ]},
    // programming
    { tags:['prog'], patterns: ['программирован','code','javascript','js','python','node','html','css','programming'], replies:[
      "Программирование — круто. На чём хочешь работать: JS/HTML/CSS или Python?",
      "Если нужна помощь с кодом — пришли фрагмент кода или опиши задачу.",
      "HTML/CSS/JS — это фронт, Node.js — бэкенд на JS, Python — для скриптов и ML."
    ]},
    // football
    { tags:['football'], patterns: ['футбол','football','гол','пасы','дриблинг'], replies:[
      "Футбол — топ. Тренируй дриблинг, пас и позиционную игру.",
      "У тебя любимая позиция? Я предпочитаю защитника, но люблю нападение тоже."
    ]},
    // games
    { tags:['games'], patterns: ['игры','game','minecraft','fifa','fortnite','roblox'], replies:[
      "Игры классные. Пишу простые мини-игры на JS.",
      "Какие жанры любишь? Платформеры, шутеры или стратегии?"
    ]},
    // maths simple eval
    { tags:['math'], patterns: ['+', '-', '*', '/', 'сколько будет', 'calculate','посчитай'], replies:[
      "Могу посчитать простые выражения: введи, например: 2+2*3"
    ], responder: function(user){
      // try to evaluate simple math safely
      try{
        const expr = user.replace(/[^0-9+\-*/()., ]/g,'').replace(/,/g,'.');
        if(expr.length>0 && /[0-9]/.test(expr)){
          // disallow long strings
          if(expr.length>200) return "Слишком длинное выражение.";
          // eslint-disable-next-line no-eval
          const val = Function('"use strict";return ('+expr+')')();
          if(typeof val === 'number' && isFinite(val)) return 'Результат: ' + val;
        }
      }catch(e){ /* ignore */ }
      return null;
    }},
    // time/date
    { tags:['time'], patterns: ['текущее время','который час','time','date','дата'], replies: [], responder: function(){
      const now = new Date();
      return 'Сейчас ' + now.toLocaleString();
    }},
    // jokes
    { tags:['joke'], patterns: ['шутка','joke','расскажи анекдот'], replies:[
      "Почему программисты путают Хэллоуин и Рождество? Потому что OCT 31 == DEC 25 😅",
      "— Как называется программист без девушки? — Запятая."
    ]},
    // school help
    { tags:['school'], patterns: ['школа','урок','контрольная','домашн','дз','homework'], replies:[
      "Школьные задачи? Опиши вопрос — постараюсь помочь шаг за шагом.",
      "Могу подсказывать логику решения, но не делать всю работу за тебя."
    ]},
    // greetings variations fallback via synonyms
    { tags:['thanks'], patterns: ['спасибо','thanks','thank you'], replies:[
      "Пожалуйста!", "Рад помочь!", "Обращайся в любое время."
    ]},
    // fallback small answers
    { tags:['misc'], patterns: ['любишь','интересно','помоги','почему','как'], replies:[
      "Могу попытаться объяснить. Спроси точнее пожалуйста.",
      "Интересный вопрос — опиши подробнее!"
    ]}
  ];

  // добавим ещё разнообразных шаблонов чтобы было много вариантов (расширяем KB)
  (function expandKB(){
    const extras = [
      ["ты робот","я робот","робот ли ты"], ["я тебя люблю","люблю тебя"], ["что нового","новости"], ["помощь","help me"],
      ["что такое html","что такое css","что такое javascript"], ["где скачать","скачать","download"]
    ];
    extras.forEach(arr => {
      KB.push({ patterns: arr, replies: [
        "Хороший вопрос — могу дать краткое объяснение.",
        "Смотри: могу подсказать ресурс и краткую суть.",
        "Объясню простыми словами: спроси конкретнее."
      ]});
    });
    // pad with synonyms / small talk variants to reach ~50+ blocks (simple replication with variations)
    for(let i=0;i<20;i++){
      KB.push({ patterns: ['вопрос'+i, 'вопросик'+i], replies:[
        `Это одна из моих заготовок ответов #${i}`, `Я могу говорить об этом спокойно (#${i})`
      ]});
    }
  })();

  // ---------------------------
  // Core: поиск ответа
  // ---------------------------
  function findBestMatch(user){
    const normUser = normText(user);
    let best = {score:0, entry:null, computed:null};
    for(const entry of KB){
      // if entry defines custom responder and quick keyword found, try responder
      const patterns = Array.isArray(entry.patterns) ? entry.patterns : [entry.patterns];
      // compute pattern similarity: check token overlap and string similarity
      for(const p of patterns){
        const pat = typeof p === 'string' ? p : (p.source || '');
        const sim = Math.max(
          similarity(normUser, pat),
          tokenOverlapScore(normUser, pat)
        );
        // if direct regex and matches, boost
        let matched = false;
        try{
          if(p instanceof RegExp && p.test(normUser)) matched = true;
          if(typeof p === 'string' && normUser.includes(p)) matched = true;
        }catch(e){}
        const score = matched ? Math.max(sim, 0.8) : sim;
        if(score > best.score){
          best.score = score;
          best.entry = entry;
          best.computed = {pattern: p, score};
        }
      }
      // if entry has responder and we already have decent match, try to compute
      if(best.entry === entry && typeof entry.responder === 'function'){
        const custom = entry.responder(user);
        if(custom) return {entry, reply: custom, score: best.score};
      }
    }
    return best;
  }

  function tokenOverlapScore(a,b){
    const wa = wordsSet(a);
    const wb = wordsSet(b);
    if(wa.length===0 || wb.length===0) return 0;
    let common = 0;
    for(const w of wa) if(wb.includes(w)) common++;
    return common / Math.max(wa.length, wb.length);
  }

  // main reply generator
  function generateReply(user){
    // 1) direct math or command handled in responders (done in KB)
    // 2) find best KB match
    const best = findBestMatch(user);
    if(CONFIG.verbose) console.log('BEST', best && best.score, best && best.entry);
    if(best && best.entry && best.score >= CONFIG.minSimilarity){
      if(best.reply) return best.reply;
      const entry = best.entry;
      // if responder present, call
      if(typeof entry.responder === 'function'){
        const out = entry.responder(user);
        if(out) return out;
      }
      // else pick random from replies
      const rep = entry.replies[Math.floor(Math.random()*entry.replies.length)];
      return rep;
    }
    // 3) fallback: use heuristic compositional answer
    return cleverFallback(user);
  }

  // fallback builder: tries to answer with templates + keyword search across KB
  function cleverFallback(user){
    const n = normText(user);
    // small heuristics: if question contains "что", "как", "почему", try templates
    if(/\b(что|как|почему|зачем|поясни|объясни)\b/.test(n)){
      // try to find article in KB with token overlap
      let best = {score:0, text:null};
      for(const entry of KB){
        for(const p of entry.patterns || []){
          const score = tokenOverlapScore(n, typeof p==='string' ? p : (p.source||''));
          if(score > best.score){ best.score = score; best.text = entry.replies[0]; }
        }
      }
      if(best.score > 0.1) return `Похоже, ты спрашиваешь про это: ${best.text} Если нужно точнее — задай подробнее.`;
      return "Хороший вопрос — можешь переформулировать или добавить деталей? Я постараюсь помочь.";
    }
    // short question — try proximity by similarity across KB replies
    let best = {score:0, reply:null};
    for(const entry of KB){
      for(const r of entry.replies || []){
        const s = similarity(n, r);
        if(s > best.score){ best.score = s; best.reply = r; }
      }
    }
    if(best.score > 0.25) return best.reply;
    // default
    return "Извини, пока не знаю точного ответа. Можешь спросить по-другому или дать больше контекста.";
  }

  // ---------------------------
  // UI glue: подключение к DOM
  // ---------------------------
  function uiInit(){
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const regenBtn = document.getElementById('regen-btn');
    const clearBtn = document.getElementById('clear-btn');

    if(!chatForm || !chatInput || !chatBox) {
      console.warn('ai-ultra.js: элементы chat-form/chat-input/chat-box не найдены в DOM');
      return;
    }

    function appendMsg(author, text, meta){
      const wrap = document.createElement('div');
      wrap.className = 'ai-msg';
      const time = new Date().toLocaleTimeString();
      wrap.innerHTML = `<div style="font-size:13px;color:#444"><strong>${author}:</strong> <span style="color:#111">${escapeHtml(text)}</span></div><div style="font-size:11px;color:#888;margin-top:3px">${time}</div>`;
      chatBox.appendChild(wrap);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    // escape for safety
    function escapeHtml(s){ return (s+'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

    // load memory from localStorage (profile)
    let memory = JSON.parse(localStorage.getItem('ai_ultra_memory') || '[]');

    function pushHistory(author, text){
      memory.push({author, text, t:Date.now()});
      if(memory.length > CONFIG.memoryLimit) memory = memory.slice(-CONFIG.memoryLimit);
      localStorage.setItem('ai_ultra_memory', JSON.stringify(memory));
    }

    // prefill with a friendly system message once
    if(memory.length === 0){
      const intro = "Привет! Я локальный ИИ. Спрашивай про код, футбол, игры, школу. Напиши 'помощь' для подсказок.";
      appendMsg('ИИ', intro);
      pushHistory('ИИ', intro);
    } else {
      // replay last few into UI
      for(const m of memory.slice(-10)){
        appendMsg(m.author, m.text);
      }
    }

    // handle submit
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userMsg = chatInput.value.trim();
      if(!userMsg) return;
      appendMsg('Ты', userMsg);
      pushHistory('Ты', userMsg);
      chatInput.value = '';
      appendMsg('ИИ', '...загрузка');
      // compute reply
      await sleep(CONFIG.responseDelay);
      const reply = generateReply(userMsg);
      // replace last '...загрузка' with actual reply (simple logic: last appended by ИИ)
      // remove last appended ИИ placeholder
      const nodes = chatBox.querySelectorAll('.ai-msg');
      for(let i=nodes.length-1;i>=0;i--){
        if(nodes[i].innerText.includes('...загрузка')){ nodes[i].remove(); break; }
      }
      appendMsg('ИИ', reply);
      pushHistory('ИИ', reply);
    });

    if(regenBtn){
      regenBtn.addEventListener('click', ()=>{
        // find last user message
        const lastUser = memory.slice().reverse().find(m => m.author === 'Ты');
        if(!lastUser){ alert('Нет пользовательского сообщения для регенерации'); return; }
        appendMsg('ИИ', '...загрузка');
        setTimeout(()=> {
          // simply generate new reply for same message
          const newR = generateReply(lastUser.text + ' ' + 'еще раз'); // small hint for variation
          // remove placeholder
          const nodes = chatBox.querySelectorAll('.ai-msg');
          for(let i=nodes.length-1;i>=0;i--){
            if(nodes[i].innerText.includes('...загрузка')){ nodes[i].remove(); break; }
          }
          appendMsg('ИИ', newR);
          pushHistory('ИИ', newR);
        }, CONFIG.responseDelay);
      });
    }

    if(clearBtn){
      clearBtn.addEventListener('click', ()=>{
        if(confirm('Очистить историю чата?')) {
          localStorage.removeItem('ai_ultra_memory');
          memory = [];
          chatBox.innerHTML = '';
        }
      });
    }

    // simple helper
    function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }
  }

  // ---------------------------
  // Авто-инициализация при загрузке DOM
  // ---------------------------
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', uiInit);
  } else uiInit();

  // ---------------------------
  // Экспорт (в window) — если хочешь вызывать вручную
  // ---------------------------
  window.AI_ULTRA = {
    generateReply, similarity, KB, CONFIG
  };

})();
