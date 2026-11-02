/* Ratchet Legacy — tutoriel interactif (visite guidée)
   Moteur commun au site et au tracker : met en lumière un élément,
   affiche une bulle d'explication, et avance étape par étape.
   Les étapes du site sont en bas de ce fichier ; celles du tracker sont dans son index.html.
   Lancement automatique à la première visite de la page, puis via le bouton 🎓. */
(function(){
  if(window.RLTour) return;

  const css=`
  .rlt-hole{position:fixed;z-index:99990;border-radius:12px;pointer-events:none;
    box-shadow:0 0 0 9999px rgba(5,6,14,.78),0 0 0 2px rgba(255,200,90,.9),0 0 26px 4px rgba(255,107,26,.45);
    transition:top .28s cubic-bezier(.2,.7,.3,1),left .28s cubic-bezier(.2,.7,.3,1),width .28s,height .28s}
  .rlt-hole.rlt-center{box-shadow:0 0 0 9999px rgba(5,6,14,.78)}
  .rlt-catch{position:fixed;inset:0;z-index:99989}
  .rlt-tip{position:fixed;z-index:99991;width:min(340px,calc(100vw - 24px));background:#151827;color:#EEF0F8;
    border:1px solid rgba(123,79,212,.55);border-radius:16px;padding:16px 16px 12px;box-shadow:0 18px 50px -10px rgba(0,0,0,.7);
    font-family:Inter,system-ui,sans-serif;transition:top .28s cubic-bezier(.2,.7,.3,1),left .28s cubic-bezier(.2,.7,.3,1);animation:rltIn .25s ease}
  @keyframes rltIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .rlt-step{font-family:Orbitron,sans-serif;font-size:.6rem;letter-spacing:.16em;color:#FFC85A;margin-bottom:6px}
  .rlt-t{font-weight:800;font-size:1rem;margin-bottom:6px;line-height:1.25}
  .rlt-x{font-size:.86rem;line-height:1.5;color:#C5C9DA}
  .rlt-x b{color:#fff}
  .rlt-bar{display:flex;align-items:center;gap:8px;margin-top:14px}
  .rlt-dots{display:flex;gap:4px;flex:1;flex-wrap:wrap}
  .rlt-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18)}
  .rlt-dot.on{background:#FF6B1A;width:16px;border-radius:4px}
  .rlt-b{border:none;border-radius:9px;padding:8px 13px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit}
  .rlt-skip{background:none;color:#8A90A8;padding:8px 6px}
  .rlt-prev{background:rgba(255,255,255,.07);color:#EEF0F8}
  .rlt-next{background:linear-gradient(135deg,#7B4FD4,#FF6B1A);color:#fff}
  .rlt-launch{position:fixed;left:14px;bottom:14px;z-index:9000;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,200,90,.4);
    background:#151827;color:#fff;font-size:1.25rem;cursor:pointer;box-shadow:0 8px 22px -6px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
  .rlt-launch:hover{transform:translateY(-2px)}
  @media(prefers-reduced-motion:reduce){.rlt-hole,.rlt-tip{transition:none}.rlt-tip{animation:none}}`;
  function injectCss(){ if(document.getElementById('rlt-css')) return; const s=document.createElement('style'); s.id='rlt-css'; s.textContent=css; document.head.appendChild(s); }

  const store={ get(k){ try{return localStorage.getItem(k);}catch(e){return null;} }, set(k,v){ try{localStorage.setItem(k,v);}catch(e){} } };
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function lang(){
    try{ if(typeof window.currentLang==='string') return window.currentLang==='fr'?'fr':'en'; }catch(e){}
    return /^fr/i.test(navigator.language||'')?'fr':'en';
  }
  const L=(v)=> (v && typeof v==='object') ? (v[lang()]||v.en||v.fr||'') : (v||'');
  const UI={ next:{fr:'Suivant',en:'Next'}, prev:{fr:'Retour',en:'Back'}, skip:{fr:'Passer',en:'Skip'}, done:{fr:'Terminé 🎉',en:'Done 🎉'}, step:{fr:'ÉTAPE',en:'STEP'}, launch:{fr:'Visite guidée',en:'Guided tour'} };

  function visible(el){
    if(!el) return false;
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) return false;
    // l'opacité n'est pas testée : les sections « reveal » sont transparentes tant qu'on n'a pas défilé jusqu'à elles
    const cs=getComputedStyle(el); return cs.visibility!=='hidden' && cs.display!=='none';
  }
  function find(sel){
    if(!sel) return null;
    const list=Array.isArray(sel)?sel:[sel];
    for(const s of list){ try{ const els=[...document.querySelectorAll(s)]; const v=els.find(visible); if(v) return v; }catch(e){} }
    return null;
  }
  async function waitFor(sel,ms){ const t0=Date.now(); let el=find(sel); while(!el && Date.now()-t0<ms){ await sleep(120); el=find(sel); } return el; }

  let state=null;

  function close(markDone){
    if(!state) return;
    if(markDone && state.id) store.set('rl_tour_done_'+state.id,'1');
    ['hole','tip','catch'].forEach(k=>state[k]&&state[k].remove());
    window.removeEventListener('resize',state.onMove); window.removeEventListener('scroll',state.onMove,true);
    document.removeEventListener('keydown',state.onKey);
    const after=state.onEnd; state=null; if(after) try{after();}catch(e){}
  }

  function place(){
    if(!state) return;
    const {hole,tip,target}=state; const pad=8, vw=innerWidth, vh=innerHeight;
    let r;
    if(target && visible(target)){
      const b=target.getBoundingClientRect();
      r={top:b.top-pad,left:b.left-pad,width:b.width+pad*2,height:b.height+pad*2};
      hole.classList.remove('rlt-center');
    } else {
      r={top:vh/2,left:vw/2,width:0,height:0}; hole.classList.add('rlt-center');
    }
    Object.assign(hole.style,{top:r.top+'px',left:r.left+'px',width:r.width+'px',height:r.height+'px'});
    const tw=tip.offsetWidth, th=tip.offsetHeight, m=12;
    let top,left;
    if(!r.width){ top=(vh-th)/2; left=(vw-tw)/2; }
    else {
      const below=vh-(r.top+r.height), above=r.top;
      if(below>=th+m*2 || below>=above) top=Math.min(r.top+r.height+m, vh-th-m);
      else top=Math.max(m, r.top-th-m);
      left=r.left+r.width/2-tw/2;
      // élément très haut : bulle par-dessus, en bas de l'écran
      if(r.height>vh*0.6) top=vh-th-m;
    }
    left=Math.max(m,Math.min(left,vw-tw-m)); top=Math.max(m,Math.min(top,vh-th-m));
    tip.style.top=top+'px'; tip.style.left=left+'px';
  }

  async function show(i,dir){
    if(!state) return;
    const my=++state.token;                       // un seul affichage à la fois : un clic rapide annule le précédent
    const steps=state.steps;
    if(i<0) i=0;
    if(i>=steps.length){ close(true); return; }
    const st=steps[i];
    if(st.before){ try{ await st.before(); }catch(e){} }
    if(!state||my!==state.token) return;
    let el=null;
    if(st.el){
      el=await waitFor(st.el, st.wait||600);
      if(!state||my!==state.token) return;
      if(!el && !st.optionalCenter){ return show(i+(dir<0?-1:1),dir); }   // élément absent sur cet écran : on saute
    }
    if(!state||my!==state.token) return;
    state.i=i; state.target=el;
    if(el){ el.scrollIntoView({block:el.offsetHeight>innerHeight*0.7?'start':'center',inline:'nearest',behavior:'smooth'}); await sleep(380); if(!state||my!==state.token) return; }
    const n=steps.length, last=i===n-1;
    state.tip.innerHTML=
      '<div class="rlt-step">'+L(UI.step)+' '+(i+1)+' / '+n+'</div>'+
      '<div class="rlt-t">'+L(st.title)+'</div>'+
      '<div class="rlt-x">'+L(st.text)+'</div>'+
      '<div class="rlt-bar"><div class="rlt-dots">'+steps.map((_,k)=>'<span class="rlt-dot'+(k===i?' on':'')+'"></span>').join('')+'</div>'+
      (last?'':'<button class="rlt-b rlt-skip" data-a="skip">'+L(UI.skip)+'</button>')+
      (i>0?'<button class="rlt-b rlt-prev" data-a="prev">'+L(UI.prev)+'</button>':'')+
      '<button class="rlt-b rlt-next" data-a="next">'+L(last?UI.done:UI.next)+'</button></div>';
    place();
    // recalage après les animations (panneau qui glisse, section qui apparaît)
    [250,600,1100].forEach(ms=>setTimeout(()=>{ if(state&&my===state.token) place(); },ms));
    const nb=state.tip.querySelector('.rlt-next'); if(nb) nb.focus({preventScroll:true});
  }

  function start(steps,opts){
    opts=opts||{};
    if(state) close(false);
    if(!steps||!steps.length) return;
    injectCss();
    const catchEl=document.createElement('div'); catchEl.className='rlt-catch';
    const hole=document.createElement('div'); hole.className='rlt-hole';
    const tip=document.createElement('div'); tip.className='rlt-tip'; tip.setAttribute('role','dialog'); tip.setAttribute('aria-live','polite');
    document.body.append(catchEl,hole,tip);
    state={steps,i:0,token:0,hole,tip,catch:catchEl,target:null,id:opts.id||'',onEnd:opts.onEnd};
    // Pendant qu'une étape se prépare (défilement, attente de l'élément), les clics suivants sont ignorés
    const go=async d=>{ if(!state||state.busy) return; state.busy=true; state.tip.style.opacity='.6';
      try{ await show(state.i+d,d); } finally { if(state){ state.busy=false; state.tip.style.opacity=''; } } };
    state.go=go;
    tip.addEventListener('click',e=>{ const a=e.target.closest('[data-a]'); if(!a||!state) return;
      const act=a.dataset.a; if(act==='next') go(1); else if(act==='prev') go(-1); else close(true); });
    let raf=0; state.onMove=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(place); };
    state.onKey=e=>{ if(!state) return; if(e.key==='Escape') close(true); else if(e.key==='ArrowRight') state.go(1); else if(e.key==='ArrowLeft') state.go(-1); };
    window.addEventListener('resize',state.onMove); window.addEventListener('scroll',state.onMove,true);
    document.addEventListener('keydown',state.onKey);
    state.busy=true; show(0,1).finally(()=>{ if(state) state.busy=false; });
  }

  function launcher(onClick){
    injectCss();
    if(document.querySelector('.rlt-launch')) return;
    const b=document.createElement('button'); b.className='rlt-launch'; b.type='button';
    b.title=L(UI.launch); b.setAttribute('aria-label',L(UI.launch)); b.textContent='🎓';
    b.onclick=onClick; document.body.appendChild(b);
  }

  window.RLTour={ start, close:()=>close(true), launcher, isDone:id=>store.get('rl_tour_done_'+id)==='1', lang };

  /* ───────── Étapes du site ratchetlegacy.com (ignorées dans le tracker) ───────── */
  if(window.RL_TOUR_NO_SITE || /(^|\.)tracker\./.test(location.hostname)) return;
  const NAV=['.nav-links','.rl-burger'];
  const page=(location.pathname.split('/').pop()||'index.html').replace(/\.html$/,'')||'index';
  const T={
    welcome:{ title:{fr:'Bienvenue sur Ratchet Legacy 👋',en:'Welcome to Ratchet Legacy 👋'},
      text:{fr:'Une visite rapide pour te montrer où tout se trouve. Tu peux la relancer à tout moment avec le bouton <b>🎓</b> en bas à gauche.',en:'A quick tour to show you around. You can replay it any time with the <b>🎓</b> button, bottom left.'} },
    nav:{ el:NAV, title:{fr:'Le menu',en:'The menu'},
      text:{fr:'Toutes les rubriques : <b>Wiki</b>, <b>Map</b>, <b>Arcade</b>, <b>Story</b>, <b>News</b>, le <b>Megacorp Vault</b>, les <b>Guides</b> et les <b>Trades</b>.',en:'Every section: <b>Wiki</b>, <b>Map</b>, <b>Arcade</b>, <b>Story</b>, <b>News</b>, the <b>Megacorp Vault</b>, <b>Guides</b> and <b>Trades</b>.'} },
    tracker:{ el:['.nav-cta','.rl-burger'], title:{fr:'Le tracker de collection',en:'The collection tracker'},
      text:{fr:'Ton appli pour suivre ta collection : ce que tu possèdes, ce qu’il te manque, ce que tu as dépensé et ce que ça vaut.',en:'Your app to track your collection: what you own, what you miss, what you spent and what it’s worth.'} },
  };
  const PAGES={
    index:[ T.welcome, T.nav,
      { el:'#vault', title:{fr:'Le Megacorp Vault',en:'The Megacorp Vault'}, text:{fr:'Le catalogue de <b>tous les objets Ratchet &amp; Clank</b> connus — jeux, figurines, peluches, goodies… avec leur <b>cote</b> calculée sur des ventes réelles.',en:'The catalogue of <b>every known Ratchet &amp; Clank collectible</b> — games, figures, plush, goodies… with a <b>market rating</b> based on real sales.'} },
      { el:'#universe', title:{fr:'L’univers R&amp;C',en:'The R&amp;C universe'}, text:{fr:'Jeux, personnages, armes, planètes, boss : le wiki complet de la saga.',en:'Games, characters, weapons, planets, bosses: the full wiki of the saga.'} },
      { el:'#latest', title:{fr:'Les actus',en:'Latest news'}, text:{fr:'Les dernières nouvelles de la série, avec le lien vers l’article d’origine.',en:'The latest news from the series, linking to the original article.'} },
      { el:'#guides', title:{fr:'Les guides',en:'The guides'}, text:{fr:'Les guides collector Ratchet Legacy à lire ou télécharger gratuitement.',en:'Ratchet Legacy collector guides, free to read or download.'} },
      { el:'#app', title:{fr:'Suis ta collection',en:'Track your collection'}, text:{fr:'Le tracker en images : il est gratuit et s’installe comme une appli sur ton téléphone.',en:'The tracker at a glance: it’s free and installs like an app on your phone.'} },
      T.tracker ],
    database:[
      { title:{fr:'Le Megacorp Vault 🏛️',en:'The Megacorp Vault 🏛️'}, text:{fr:'Le catalogue de référence des objets Ratchet &amp; Clank. Voici comment t’en servir.',en:'The reference catalogue of Ratchet &amp; Clank collectibles. Here’s how to use it.'} },
      { el:'#vsearch', title:{fr:'Recherche globale',en:'Search everything'}, text:{fr:'Tape un nom, une console, une région, une édition ou même un <b>code-barres</b>.',en:'Type a name, a platform, a region, an edition or even a <b>barcode</b>.'} },
      { el:'.px-btn', title:{fr:'Comment sont calculées les cotes',en:'How prices are calculated'}, text:{fr:'La cote est la <b>médiane</b> des prix réels (ventes conclues et achats des collectionneurs). En <b style="color:#3DD68C">vert</b> : prix réels ; en <b style="color:#F5B941">orange</b> : estimation d’après les annonces.',en:'The rating is the <b>median</b> of real prices (completed sales and collectors’ purchases). <b style="color:#3DD68C">Green</b>: real prices; <b style="color:#F5B941">amber</b>: estimate from listings.'} },
      { el:'#cat-tabs', title:{fr:'Les catégories',en:'Categories'}, text:{fr:'Choisis une catégorie, puis une sous-catégorie, pour parcourir les fiches.',en:'Pick a category, then a sub-category, to browse the items.'} },
      { el:['#grid .card','#grid'], title:{fr:'Une fiche',en:'An item'}, text:{fr:'Clique sur une fiche pour voir les photos, la cote neuf et occasion, l’évolution des prix, et <b>signaler une vente</b> ou une erreur.',en:'Click an item to see photos, new and pre-owned ratings, the price trend, and to <b>report a sale</b> or a mistake.'} },
      T.tracker ],
    wiki:[ { el:'.page-hero, header', optionalCenter:true, title:{fr:'Le wiki R&amp;C 📚',en:'The R&amp;C wiki 📚'}, text:{fr:'Tout l’univers Ratchet &amp; Clank, rangé par thème.',en:'The whole Ratchet &amp; Clank universe, sorted by topic.'} },
      { el:['.wiki-hub','main'], title:{fr:'Les rubriques',en:'Topics'}, text:{fr:'Jeux, personnages, armes, créatures, ennemis, planètes, boss, anecdotes… Clique sur une rubrique pour l’ouvrir.',en:'Games, characters, weapons, creatures, enemies, planets, bosses, fun facts… Click a topic to open it.'} }, T.nav ],
    map:[ { title:{fr:'La carte de la galaxie 🌌',en:'The galaxy map 🌌'}, text:{fr:'Choisis une galaxie, puis touche une planète : ses lieux et sa fiche complète s’affichent sous la carte.',en:'Pick a galaxy, then tap a planet: its places and full file appear below the map.'} }, T.nav ],
    arcade:[ { title:{fr:'L’arcade 🕹️',en:'The arcade 🕹️'}, text:{fr:'Des mini-jeux faits maison : quiz Lombax, attrape-boulons, memory… Bats le classement !',en:'Home-made mini-games: Lombax quiz, Bolt Catcher, Memory… Beat the leaderboard!'} }, T.nav ],
    story:[ { title:{fr:'L’histoire complète 📖',en:'The full story 📖'}, text:{fr:'Toute l’histoire de la saga, jeu par jeu. Utilise la liste des chapitres pour sauter directement à un jeu.',en:'The whole story of the saga, game by game. Use the chapter list to jump straight to a game.'} }, T.nav ],
    news:[ { title:{fr:'Les actus 📰',en:'The news 📰'}, text:{fr:'Les nouvelles de la série. Touche une carte pour lire l’article complet sur le site d’origine.',en:'News from the series. Tap a card to read the full article on its original site.'} }, T.nav ],
    guides:[ { title:{fr:'Les guides 📗',en:'The guides 📗'}, text:{fr:'Filtre par jeu en haut, puis ouvre un guide pour le lire ou le télécharger.',en:'Filter by game at the top, then open a guide to read or download it.'} }, T.nav ],
    trades:[ { title:{fr:'Les échanges 🤝',en:'Trades 🤝'}, text:{fr:'Publie ce que tu échanges, vends ou recherches, et contacte d’autres collectionneurs.',en:'Post what you trade, sell or look for, and contact other collectors.'} }, T.nav ],
  };
  const steps=PAGES[page];
  if(!steps) return;
  const run=()=>RLTour.start(steps,{id:'site_'+page});
  const boot=()=>{ launcher(run); if(!RLTour.isDone('site_'+page) && (page==='index'||page==='database')) setTimeout(run, 1600); };
  if(document.readyState==='complete') boot(); else window.addEventListener('load',boot);
})();
