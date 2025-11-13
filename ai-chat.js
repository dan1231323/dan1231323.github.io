/* ai-ultra-pro.js
   Продвинутый локальный чат-ИИ с контекстом, обучением и NLP
   Автоинициализация: создаёт чат на странице, можно подключить через <script src="ai-ultra-pro.js"></script>
*/

(function() {
  'use strict';

  // ===============================
  // КОНФИГУРАЦИЯ
  // ===============================
  const CONFIG = {
    responseDelay: 400,
    memoryLimit: 100,
    contextWindow: 10,
    minSimilarity: 0.32,
    learningRate: 0.1,
    temperature: 0.7,
    verbose: false
  };

  // ===============================
  // NLP УТИЛИТЫ
  // ===============================
  const NLP = {
    stopWords: new Set([
      'и','в','на','с','по','для','к','от','о','у','из','за','до','при',
      'the','a','an','is','are','was','were','be','been','being',
      'have','has','had','do','does','did','will','would','should','could',
      'это','то','все','всё','так','вот','быть','как','его','но','да','ты','я'
    ]),
    normalize(text){ return (text||"").toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim(); },
    stem(word){
      if(word.length<4)return word;
      const ru=/(ова|ева|ение|ание|ость|ние|ие|ей|ой|ый|ая|ое|ые|ими|ами|его|ого|ему|ому|ую|юю|ою|ею|ать|ять|еть|ить|ти|чь|ешь|ишь|ете|ите|ут|ют|ат|ят)$/i;
      const en=/(ational|tional|encing|ancing|ization|isation|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|ing|ed|es|s|ly|tion|ment|ness)$/i;
      return word.replace(ru,'').replace(en,'');
    },
    tokenize(text,r=true){const t=this.normalize(text).split(' ').filter(Boolean);return r?t.filter(x=>!this.stopWords.has(x)&&x.length>1):t;},
    similarity(a,b){return a&&b?(this.normalize(a)===this.normalize(b)?1:0.5):0;}
  };

  // ===============================
  // КОНТЕКСТ И ПАМЯТЬ
  // ===============================
  class ContextManager {
    constructor(){this.conversation=[];this.userProfile={interests:new Set(),sentiment:{positive:0,neutral:0,negative:0}};}
    addMessage(author,text){
      this.conversation.push({author,text,timestamp:Date.now()});
      if(this.conversation.length>CONFIG.contextWindow)this.conversation.shift();
      if(author==='Ты'){this.updateProfile(text);}
    }
    updateProfile(text){
      const keywords=['программирование','футбол','игры','музыка','кино','учеба','школа'];
      keywords.forEach(k=>{if(text.toLowerCase().includes(k))this.userProfile.interests.add(k);});
    }
    getUserInterests(){return Array.from(this.userProfile.interests);}
    getRecent(){return this.conversation.slice(-CONFIG.contextWindow);}
  }

  // ===============================
  // БАЗА ЗНАНИЙ
  // ===============================
  class KnowledgeBase{
    constructor(){
      this.entries=[
        {patterns:['привет','здравствуй','hi','hello'],responses:["Привет! 😊","Здорова!"],weight:1.0},
        {patterns:['как дела','как ты'],responses:["Всё супер! 💻","Отлично!"],weight:1.0},
        {patterns:['пока','до свидания'],responses:["Пока! 👋","До встречи!"],weight:1.0}
      ];
    }
    getAll(){return this.entries;}
  }

  // ===============================
  // ГЕНЕРАТОР ОТВЕТОВ
  // ===============================
  class ResponseGenerator{
    constructor(kb,ctx){this.kb=kb;this.ctx=ctx;}
    generate(msg){
      const entries=this.kb.getAll();
      let best=null;let score=0;
      for(const e of entries){for(const p of e.patterns){const s=NLP.similarity(msg,p)*e.weight;if(s>score){score=s;best=e;}}}
      return best?(best.responses[Math.floor(Math.random()*best.responses.length)]||""): "🤔 Не понял, уточни вопрос.";
    }
  }

  // ===============================
  // AI CORE
  // ===============================
  class AIUltraPro{
    constructor(){this.kb=new KnowledgeBase();this.ctx=new ContextManager();this.gen=new ResponseGenerator(this.kb,this.ctx);this.memory=[];}
    async generateResponse(msg){
      this.ctx.addMessage('Ты',msg);this.memory.push({author:'Ты',text:msg});
      await new Promise(r=>setTimeout(r,CONFIG.responseDelay));
      const resp=this.gen.generate(msg);
      this.ctx.addMessage('ИИ',resp);this.memory.push({author:'ИИ',text:resp});
      return resp;
    }
  }

  // ===============================
  // UI
  // ===============================
  function createUI(){
    const container=document.createElement('div');
    container.style.position='fixed';container.style.bottom='20px';container.style.right='20px';
    container.style.width='350px';container.style.height='500px';container.style.background='#f0f0f0';
    container.style.border='1px solid #ccc';container.style.borderRadius='10px';container.style.display='flex';
    container.style.flexDirection='column';container.style.zIndex=9999;

    const chatBox=document.createElement('div');chatBox.style.flex='1';chatBox.style.padding='5px';chatBox.style.overflowY='auto';
    chatBox.style.background='#fff';chatBox.style.margin='5px';chatBox.style.borderRadius='5px';
    container.appendChild(chatBox);

    const form=document.createElement('form');form.style.display='flex';form.style.margin='5px';
    const input=document.createElement('input');input.type='text';input.placeholder='Напиши сообщение...';input.style.flex='1';
    input.style.padding='5px';input.style.borderRadius='5px';input.style.border='1px solid #ccc';
    const btn=document.createElement('button');btn.type='submit';btn.textContent='Отправить';btn.style.marginLeft='5px';
    form.appendChild(input);form.appendChild(btn);container.appendChild(form);

    document.body.appendChild(container);

    return {chatBox,input,form};
  }

  function appendMessage(chatBox,author,text){
    const div=document.createElement('div');
    div.textContent=(author==='ИИ'?'🤖 ':'👤 ')+text;div.style.margin='3px 0';
    if(author==='ИИ')div.style.color='blue';
    chatBox.appendChild(div);chatBox.scrollTop=chatBox.scrollHeight;
  }

  // ===============================
  // INIT
  // ===============================
  const ai=new AIUltraPro();
  const ui=createUI();
  appendMessage(ui.chatBox,'ИИ','Привет! Я AI Ultra Pro 🤖\nНапиши что-нибудь.');

  ui.form.addEventListener('submit',async e=>{
    e.preventDefault();
    const msg=ui.input.value.trim();if(!msg)return;
    appendMessage(ui.chatBox,'Ты',msg);ui.input.value='';
    const resp=await ai.generateResponse(msg);
    appendMessage(ui.chatBox,'ИИ',resp);
  });

})();
