// Collection rétro privée (admin) — données : retro/data.json, coches : table Supabase retro_state
const DATA=window.RETRO_DATA;const DL={save:async({filename,data})=>{ const blob=data instanceof Blob?data:new Blob([data],{type:/\.csv$/.test(filename)?"text/csv;charset=utf-8":/\.jpg$/.test(filename)?"image/jpeg":"text/plain;charset=utf-8"}); const u=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=u; a.download=filename; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); return {status:"saved"}; }};

const PHOTO=[];
const UNOWN=[];
const XLI={};
const PARTS={rel:[["b","Boîte"],["n","Notice"],["c","Jeu"]],oop:[["b","Jaquette"],["c","Jeu"]],sms:[["b","Boîte"],["n","Notice"],["c","Cartouche"]],ps3:[["b","Boîte"],["n","Notice"],["c","Disque"]],moto:[["b","Boîte"],["n","Notice"],["c","Jeu"]],col:[["b","Boîte"],["n","Notice"],["c","Jeu"]]};
let cons="all", hidden={}, custom=[], folded={}, state={}, tab="sms", filt="all", q="", store=null, timer=null; const GRP={moto:"plat",col:"series"};
try{const g=JSON.parse(localStorage.getItem("retro-grp2")||"{}"); Object.assign(GRP,g);}catch(e){}
try{folded=JSON.parse(localStorage.getItem("retro-fold")||"{}")||{};}catch(e){}
try{const c=JSON.parse(localStorage.getItem("retro-custom")||"[]"); if(Array.isArray(c))custom=c; const h=JSON.parse(localStorage.getItem("retro-hidden")||"{}"); if(h&&typeof h==="object")hidden=h;}catch(e){}
const fkey=n=>tab+"|"+(GRP[tab]||"")+"|"+n;
// double appui pour confirmer (les fenêtres de confirmation sont bloquées dans Claude)
function armed(btn,txt){ if(btn.dataset.armed){ return true; } btn.dataset.armed=1; btn.dataset.old=btn.textContent; btn.textContent=txt; btn.classList.add("armed");
  if(btn.classList.contains("del")) btn.style.width="auto";
  setTimeout(()=>{ if(btn.isConnected&&btn.dataset.armed){ delete btn.dataset.armed; btn.textContent=btn.dataset.old; btn.classList.remove("armed"); if(btn.classList.contains("del")) btn.style.width="40px"; } },3500); return false; }
function removeIds(ids){ const s=new Set(ids); custom=custom.filter(c=>{ if(s.has(c.id)){ delete state[c.id]; return false; } return true; });
  for(const i of DATA.col[0].items) if(s.has(i.id)) hidden[i.id]=1; }
function saveFold(){try{localStorage.setItem("retro-fold",JSON.stringify(folded))}catch(e){}}
const isPort=i=>(i.plat==="PSP"||i.plat==="PS Vita")?1:0;
const HOMEP=new Set(["PlayStation","PlayStation 2","PlayStation 3","PlayStation 4","PlayStation 5","PS4 / PS5"]);
const has=i=>state[i.id]&&Object.keys(state[i.id]).length>0;
// Liens Ma collection ↔ PS3 HD : une compilation PS3 cochée d'un côté l'est aussi de l'autre
const hdKey=t=>fold(t).replace(/\b(the|le|la|les|and|et|hd|edition|classics)\b/g," ").replace(/\s+/g," ").trim();
const HDRE=/\b(trilog(y|ie)|hd|collection|remaster(ed)?|classics|saga|anthology|anthologie)\b/i;
const PS3BOX=()=>DATA.ps3.filter(x=>!x.digital).flatMap(x=>x.items);
let LINK=new Map(), PS3X=[];
function buildLinks(){ const m=new Map(); for(const i of PS3BOX()) m.set(hdKey(i.t),[i.id]); PS3X=[];
  for(const i of DATA.col[0].items.concat(custom)){ if(i.plat!=="PlayStation 3") continue; const k=hdKey(i.t);
    if(m.has(k)) m.get(k).push(i.id); else if(String(i.id).startsWith("cus-")&&HDRE.test(i.t)) PS3X.push(i); }
  LINK=new Map(); for(const L of m.values()) if(L.length>1) for(const id of L) LINK.set(id,L); }
function setState(id,v){ const ids=LINK.get(id)||[id]; for(const x of ids){ if(v&&Object.keys(v).length) state[x]=Object.assign({},v); else delete state[x]; } }
function syncLinks(){ buildLinks(); let ch=false; const done=new Set();
  for(const L of LINK.values()){ if(done.has(L)) continue; done.add(L); const u={}; for(const x of L) Object.assign(u,state[x]||{}); if(!Object.keys(u).length) continue;
    for(const x of L){ const m2=Object.assign({},state[x]||{},u); if(JSON.stringify(m2)!==JSON.stringify(state[x]||{})){ state[x]=m2; ch=true; } } }
  return ch; }
// une seule version de salon par épisode : celle que tu as cochée, sinon la version d'origine
function pickVersions(all){ const grp=new Map(); for(const i of all) if(HOMEP.has(i.plat)){ const k=i.series+"|"+fold(i.t); if(!grp.has(k)) grp.set(k,[]); grp.get(k).push(i); }
  const drop=new Set(); for(const L of grp.values()){ if(L.length<2) continue; const mine=L.filter(has); const keep=mine.length?mine:L.filter(i=>!i.x).slice(0,1); const kk=keep.length?keep:[L[0]]; for(const i of L) if(!kk.includes(i)) drop.add(i); }
  return all.filter(i=>!drop.has(i)); }
// tri alphabétique partout (numéros dans l'ordre : 2 avant 10)
const COLL=new Intl.Collator("fr",{numeric:true,sensitivity:"base"}); const cmpT=(a,b)=>COLL.compare(a,b);
for(const k of ["sms","ps3","oop"]) for(const sc of DATA[k]) sc.items.sort((a,b)=>cmpT(a.t,b.t));
DATA.cards.sort((a,b)=>cmpT(a.name,b.name)); for(const a of DATA.cards) if(a.pop) a.items.sort((x,y)=>cmpT(x.t+" "+x.n,y.t+" "+y.n));
// ---------- Sorties : jeux récents et à venir des séries suivies (alimentés par la mise à jour automatique) ----------
let REL=[];
const TODAY=new Date().toISOString().slice(0,10);
const MOIS=["janv.","févr.","mars","avril","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function fmtD(d){ if(!d||d==="TBA") return "date à venir"; const m=String(d).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/); if(!m) return String(d); return (m[3]?(+m[3])+" ":"")+(m[2]?MOIS[+m[2]-1]+" ":"")+m[1]; }
function relItems(){ return REL.map(r=>{ const full=/^\d{4}-\d{2}-\d{2}$/.test(r.date||""); const soon=!(r.status==="sorti"||(full&&r.date<=TODAY));
  const plat=["PlayStation 4","PlayStation 5","PS4 / PS5"].includes(r.plat)?r.plat:"PlayStation 5"; const SH={"PlayStation 4":"PS4","PlayStation 5":"PS5","PS4 / PS5":"PS4/PS5"}[plat];
  return {id:r.id,t:String(r.t||"").slice(0,140),plat,series:String(r.series||"Jeux seuls"),y:+(String(r.date||"").slice(0,4))||0,n:SH+" · "+(soon?"sortie ":"sorti le ")+fmtD(r.date)+(r.note?" · "+r.note:""),tag:soon?"À venir":"Nouveau",soon,date:r.date||"9999",rel:1,added:r.added||""}; }); }
function relSeen(){ try{ return localStorage.getItem("retro-relseen")||""; }catch(e){ return ""; } }
// Ma collection : deux groupes, PS4 (avec les jeux PS4/PS5) et PS5 (jeux sortis seulement sur PS5)
const PS45=new Set(["PlayStation 4","PS4 / PS5"]);
const pk=i=>(tab==="col"&&PS45.has(i.plat))?"PlayStation 4":i.plat;
// jeux moto pas encore dans Ma collection : une série apparaît dès que tu en as un jeu
let _mx=null;
function motoX(){ if(_mx) return _mx; const ids=new Set(DATA.col[0].items.flatMap(i=>[i.id,i.alt].filter(Boolean))); const S={"PlayStation":"PS1","PlayStation 2":"PS2","PlayStation 3":"PS3","PlayStation 4":"PS4","PlayStation 5":"PS5","PS Vita":"Vita","PSP":"PSP"};
  _mx=DATA.moto.flatMap(x=>x.items).filter(i=>!ids.has(i.id)).map(i=>{ const y=+((i.n.match(/\d{4}/)||[0])[0]); return {id:i.id,t:i.t,plat:i.plat,ms:i.series,series:i.series==="Autres"?"Jeux seuls":i.series,y,n:(S[i.plat]||i.plat)+(y?" · "+y:""),tag:"",img:i.img}; }); return _mx; }
function motoDyn(){ const L=motoX(); const own=new Set(L.filter(has).map(i=>i.ms)); return L.filter(i=>i.ms==="Autres"?has(i):own.has(i.ms)); }
function sections(){ if(tab==="rel"){ const L=relItems().map(r=>Object.assign({},r,{n:r.series+" · "+r.n})); const soon=L.filter(r=>r.soon).sort((a,b)=>cmpT(String(a.date),String(b.date))), out=L.filter(r=>!r.soon).sort((a,b)=>cmpT(String(b.date),String(a.date)));
    return [{name:"À venir",digital:false,items:soon},{name:"Sortis récemment",digital:false,items:out}].filter(x=>x.items.length); }
  if(tab==="ps3"){ buildLinks(); return PS3X.length?DATA.ps3.concat([{name:"Ajoutés depuis Ma collection",digital:false,items:PS3X.map(c=>({id:c.id,t:c.t,n:c.n||"PS3",tag:"",mine:1}))}]):DATA.ps3; } if(tab!=="moto"&&tab!=="col") return DATA[tab]; const g=GRP[tab]; let all=DATA[tab].flatMap(s=>s.items).concat(tab==="col"?motoDyn():[]).concat(tab==="col"?custom.map(c=>Object.assign({mine:1},c)):[]).filter(i=>tab!=="col"||((cons==="all"||pk(i)===cons)&&!hidden[i.id])); if(tab==="col"){ const ser=new Set(all.map(i=>i.series)); const ix=new Set(all.map(i=>keyOf(i.t,i.plat))); for(const r of relItems()) if(ser.has(r.series)&&!ix.has(keyOf(r.t,r.plat))&&!hidden[r.id]&&(cons==="all"||pk(r)===cons)) all.push(r); all=pickVersions(all); }
  let order=g==="series"?(tab==="moto"?DATA.series:DATA.colseries):(tab==="col"?DATA.colplats:DATA.plats);
  const extra=[...new Set(all.map(i=>g==="series"?i.series:pk(i)))].filter(n=>!order.includes(n)); if(extra.length){order=order.slice(); const js=order.indexOf("Jeux seuls"); if(js>=0) order.splice(js,0,...extra); else order.push(...extra);} if(g==="series") order=order.slice().sort((a,b)=>(a==="Jeux seuls")-(b==="Jeux seuls")||cmpT(a,b)); const yr=i=>i.y||+((i.n.match(/\d{4}/)||[0])[0]);
  return order.map(n=>({name:n,digital:false,items:all.filter(i=>(g==="series"?i.series:pk(i))===n).sort((a,b)=>(tab==="col"&&g==="series"?isPort(a)-isPort(b):0)||cmpT(a.t,b.t)).map(i=>(tab==="moto"&&g==="series")?Object.assign({},i,{n:i.plat+" · "+i.n}):(tab==="col"&&g==="plat"?Object.assign({},i,{n:(i.plat==="PS4 / PS5"?"PS4/PS5 · ":"")+i.series+(i.y?" · "+i.y:"")}):i))})).filter(s=>s.items.length); }
function norm(v){if(v===2)return{b:1,n:1,c:1};if(v===1)return{c:1};return(v&&typeof v==="object")?v:{};}
function fixAll(o){const r={};for(const k in o){const v=norm(o[k]);if(Object.keys(v).length)r[k]=v;}return r;}
tab="col"; try{const t=localStorage.getItem("retro-tab2"); if(["sms","ps3","col","oop","cards","rel"].includes(t))tab=t; const c=localStorage.getItem("retro-cons"); if(c)cons=c==="PS4 / PS5"?"PlayStation 4":c; const s=JSON.parse(localStorage.getItem("retro-state")||"{}"); if(s&&typeof s==="object")state=fixAll(s);}catch(e){}
const $=s=>document.querySelector(s);
const shH=()=>{ const t=document.getElementById("top"); return t?t.getBoundingClientRect().height:0; };
(()=>{ const t=document.getElementById("top"); const set=()=>document.documentElement.style.setProperty("--sh",Math.ceil(shH())+"px"); set(); try{ new ResizeObserver(set).observe(t); }catch(e){ addEventListener("resize",set); } })();
const fold=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

function slugJS(s){return s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
function migrate(){ const valid=new Set(DATA.moto.flatMap(s=>s.items.map(i=>i.id))); let changed=false;
  for(const k of Object.keys(state)){ if(!k.startsWith("moto-")||valid.has(k)) continue;
    const old=k.slice(5); const hit=DATA.moto.flatMap(s=>s.items).find(i=>slugJS(i.t)===old);
    if(hit&&!state[hit.id]) state[hit.id]=state[k]; delete state[k]; changed=true; }
  for(const i of DATA.col[0].items){ if(i.alt&&state[i.alt]&&!state[i.id]){ state[i.id]=state[i.alt]; changed=true; } }
  if(syncLinks()) changed=true;
  if(!state.__xl1){ for(const k in XLI){ state[k]=Object.assign({},state[k]||{},XLI[k]); } state.__xl1={x:1}; changed=true; }
  if(!state.__ps1){ const k="col-playstation-4-assassin-s-creed-mirage"; state[k]=Object.assign({},state[k]||{},{c:1}); state.__ps1={x:1}; changed=true; }
  if(!state.__m2){ for(const k of UNOWN){ const v=state[k]; if(v&&v.c&&!v.b&&!v.n){ delete state[k]; } } state.__m2={x:1}; changed=true; }
  return changed; }
function status(v,dig){if(dig)return v.a?2:0; if(tab==="oop") return v.c&&v.b?2:v.c?1:v.b?3:0; if(v.c&&v.b&&v.n)return 2; if(v.c)return 1; return (v.b||v.n)?3:0;}
function render(){
  document.body.dataset.tab=tab;
  { const seen=relSeen(); if(tab==="rel"&&REL.length){ const mx=REL.reduce((a,r)=>r.added>a?r.added:a,""); if(mx&&mx>seen){ try{localStorage.setItem("retro-relseen",mx)}catch(e){} } }
    const nb=REL.filter(r=>(r.added||"")>relSeen()).length; const tb=$("#tab-rel"); tb.textContent="Sorties"; if(nb&&tab!=="rel"){ const b=document.createElement("span"); b.className="badge"; b.textContent=nb; tb.append(b); } } $("#q").placeholder=tab==="cards"?"Chercher un album ou un numéro…":"Chercher un jeu…";
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===tab)); { const at=document.querySelector('.tab[aria-selected="true"]'); if(at){ const tb=at.parentElement; const l=at.offsetLeft-tb.offsetLeft, r=l+at.offsetWidth; if(l<tb.scrollLeft||r>tb.scrollLeft+tb.clientWidth) tb.scrollLeft=Math.max(0,r-tb.clientWidth+8); } }
  document.querySelectorAll(".chip[data-f]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.f===filt));
  if(tab==="cards"){ renderCards(); return; }
  buildLinks(); const secs=sections(); let tot=0,own=0,cib=0,loose=0,plat=0; { const anyOpen=secs.some(x=>!folded[fkey(x.name)]); $("#foldAll").hidden=!anyOpen; $("#openAll").hidden=anyOpen; } $("#addBtn").hidden=tab!=="col"; const nh=Object.keys(hidden).length; $("#restBtn").hidden=tab!=="col"||!nh; $("#restBtn").textContent="↺ Remettre les "+nh+" jeu"+(nh>1?"x":"")+" retiré"+(nh>1?"s":""); $("#cons").hidden=tab!=="col";
  if(!$("#cons").childElementCount){ const L={"PS4 / PS5":"PS4/PS5","Master System":"Master System","PlayStation":"PS1","PlayStation 2":"PS2","PSP":"PSP","PlayStation 3":"PS3","PS Vita":"Vita","PlayStation 4":"PS4","PlayStation 5":"PS5"};
    for(const [v,t] of [["all","Toutes"]].concat(DATA.colplats.filter(p=>p!=="PS4 / PS5").map(p=>[p,L[p]||p]))){ const b=document.createElement("button"); b.className="chip"; b.dataset.c=v; b.textContent=t;
      b.onclick=()=>{cons=v; try{localStorage.setItem("retro-cons",v)}catch(e){} render();}; $("#cons").append(b);} }
  document.querySelectorAll("#cons .chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.c===cons));
  $("#grp").hidden=!(tab==="moto"||tab==="col"); $("#photoBtn").hidden=tab!=="col"||PHOTO.every(i=>state[i]&&state[i].c); $("#starChip").hidden=tab!=="sms"; if(tab!=="sms"&&filt==="star") filt="all"; const PLT=tab==="col"||tab==="ps3"||tab==="oop"; $("#platChip").hidden=!PLT; if(!PLT&&filt==="plat") filt="all"; const WT=tab!=="rel"; $("#wishChip").hidden=!WT; if(!WT&&filt==="wish") filt="all"; document.querySelectorAll("#grp .chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.g===GRP[tab]));
  const list=$("#list"); list.textContent="";
  if(tab==="rel"&&!secs.length){ const e=document.createElement("p"); e.className="empty"; e.textContent=REL.length?"Rien à afficher avec ce filtre.":"Les sorties se chargent… Elles sont mises à jour automatiquement chaque lundi."; list.append(e); }
  for(const sec of secs){
    let st=0,so=0; const rows=[];
    for(const it of sec.items){
      const v=state[it.id]||{}; const s=status(v,sec.digital); const has=s===1||s===2; if(it.soon&&!has){ if(filt==="own"||filt==="plat"||(q&&!fold(it.t+" "+it.n).includes(q))) continue; rows.push([it,v,s,sec.digital]); continue; } st++; tot++;
      if(has){so++;own++; if(s===2)cib++; else loose++;} if(v.pl) plat++;
      if(filt==="miss"&&has) continue; if(filt==="own"&&!has) continue; if(filt==="star"&&!it.star) continue; if(filt==="plat"&&!v.pl) continue; if(filt==="wish"&&!v.w) continue;
      if(q&&!fold(it.t+" "+it.n+" "+(it.tag||"")).includes(q)) continue;
      rows.push([it,v,s,sec.digital]);
    }
    if(!rows.length&&(filt!=="all"||q)) continue; // filtre actif : on cache les séries sans jeu à montrer
    const el=document.createElement("section"); el.className="sec"; const fk=fkey(sec.name); const closed=!!folded[fk]&&!q; if(closed) el.classList.add("closed");
    const h=document.createElement("div"); h.className="sech"; h.setAttribute("role","button"); h.tabIndex=0; h.setAttribute("aria-expanded",!closed);
    const h2=document.createElement("h2"); const ch=document.createElement("span"); ch.className="chev"; ch.textContent="▾"; h2.append(ch,document.createTextNode(sec.name));
    const sp=document.createElement("span"); sp.textContent=(!st&&sec.items.length)?sec.items.length+" jeu"+(sec.items.length>1?"x":""):so+" / "+st; const mini=document.createElement("span"); mini.className="mini"; mini.innerHTML=`<i style="width:${st?so/st*100:0}%"></i>`; sp.append(mini);
    const tg=()=>{ const stuck=!folded[fk]&&el.getBoundingClientRect().top<shH()-1; if(folded[fk]) delete folded[fk]; else folded[fk]=1; saveFold(); render();
      if(stuck){ const s2=[...document.querySelectorAll(".sec")].find(e=>e.dataset.name===sec.name); if(s2) s2.scrollIntoView({block:"start"}); } };
    h.onclick=tg; h.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tg();}};
    let delSer=null; if(tab==="col"&&GRP.col==="series"&&sec.name!=="Jeux seuls"){ const x=delSer=document.createElement("button"); x.className="chip"; x.textContent="Supprimer la série"; x.style.margin="8px 0 0 auto"; x.style.display="block"; x.style.fontSize="12px";
      x.setAttribute("aria-label","Supprimer la série "+sec.name);
      x.onclick=ev=>{ ev.stopPropagation(); if(!armed(x,"Confirmer : supprimer "+st+" jeux ?")) return; removeIds(sec.items.map(i=>i.id)); render(); persist(); $("#save").textContent="Série « "+sec.name+" » supprimée."; };
      }
    h.append(h2,sp); el.append(h); el.dataset.name=sec.name;
    if(closed){ list.append(el); continue; }
    if(!rows.length){const e=document.createElement("div"); e.className="empty"; e.textContent="Aucun jeu à afficher ici."; el.append(e);}
    for(const [it,v,s,dig] of rows){
      if(tab==="col"&&GRP.col==="series"&&isPort(it)&&!el.querySelector(".porth")&&sec.name!=="Jeux seuls"&&sec.items.some(x=>!isPort(x))){ const ph=document.createElement("div"); ph.className="porth"; ph.textContent="🎮 Versions portables · PSP / Vita"; el.append(ph); }
      const r=document.createElement("div"); r.className="row"+(tab==="col"&&isPort(it)?" port":""); r.dataset.s=s===3?0:s; if(it.soon) r.classList.add("soonrow");
      const tx=document.createElement("div"); tx.className="txt";
      const t=document.createElement("div"); t.className="t"; if(it.star){const st=document.createElement("span"); st.className="star"; st.textContent="★ "; st.title="Incontournable"; t.append(st);} t.append(document.createTextNode(it.t));
      if(it.tag){const g=document.createElement("span"); g.className="tag"+(it.rel?(it.soon?" soon":" new"):""); g.textContent=it.tag; t.append(g);}
      if(it.mine){const g=document.createElement("span"); g.className="mine"; g.textContent="ajouté"; t.append(g);}
      if(tab==="col"&&LINK.has(it.id)){const g=document.createElement("span"); g.className="tag hd"; g.textContent="PS3 HD"; g.title="Coché aussi dans l'onglet PS3 HD"; t.append(g);}
      const n=document.createElement("div"); n.className="n"; n.textContent=it.n; tx.append(t,n);
      const parts=document.createElement("div"); parts.className="parts";
      for(const [k,lab] of (dig?[["a","Acheté"]]:PARTS[tab].map(p=>p[0]==="c"&&it.card?["c","Carte"]:p))){
        const b=document.createElement("button"); b.className="st"; b.id="st-"+it.id+"-"+k; b.textContent=lab;
        b.setAttribute("aria-pressed",!!v[k]); b.setAttribute("aria-label",it.t+" : "+lab);
        b.onclick=()=>{const cur=Object.assign({},state[it.id]||{}); if(cur[k])delete cur[k]; else cur[k]=1; if(cur.c||cur.a) delete cur.w; setState(it.id,cur); render(); persist();};
        parts.append(b);
      }
      let cv; if(it.img){cv=document.createElement("img"); cv.src=it.img; cv.alt=""; cv.loading="lazy";} else {cv=document.createElement("div"); cv.textContent=dig?"PSN":"—"; cv.classList.add("none");}
      cv.classList.add("cov"); if(it.img||tab!=="oop") r.append(cv); r.append(tx,parts);
      if(tab!=="cards"&&tab!=="rel"&&!(s===1||s===2)){ const gb=document.createElement("button"); gb.className="st gift"; gb.textContent="🎁"; gb.title="Liste d'envies"; gb.setAttribute("aria-pressed",!!v.w); gb.setAttribute("aria-label",it.t+" : liste d'envies");
        gb.onclick=()=>{ const cur=Object.assign({},state[it.id]||{}); if(cur.w) delete cur.w; else cur.w=1; setState(it.id,cur); render(); persist(); }; parts.append(gb); }
      if(tab==="col"||tab==="ps3"||tab==="oop"){ const pb=document.createElement("button"); pb.className="st pl"; pb.textContent="🏆"; pb.title="Platiné / 100 %"; pb.setAttribute("aria-pressed",!!v.pl); pb.setAttribute("aria-label",it.t+" : platiné / 100 %");
        pb.onclick=()=>{ const cur=Object.assign({},state[it.id]||{}); if(cur.pl) delete cur.pl; else { cur.pl=1; if(!cur.c) cur.c=1; } setState(it.id,cur); render(); persist(); }; parts.append(pb); }
      if(tab==="col"){const d=document.createElement("button"); d.className="st del"; d.textContent="✕"; d.title="Retirer ce jeu"; d.setAttribute("aria-label","Retirer "+it.t); d.style.width="40px"; d.style.flex="none";
        d.onclick=()=>{ if(!armed(d,"Retirer ?")) return; removeIds([it.id]); render(); persist(); $("#save").textContent="« "+it.t+" » retiré."; }; parts.append(d);}
      el.append(r);
    }
    if(delSer&&rows.length) el.append(delSer);
    list.append(el);
  }
  const pc=v=>tot?(v/tot*100).toFixed(1)+"%":"0%";
  $("#sum").innerHTML="";
  const a=document.createElement("div"); a.className="sumrow";
  const big=document.createElement("div"); big.className="big"; big.innerHTML=`${own}<small> / ${tot} possédés</small>`;
  const p=document.createElement("div"); p.className="big"; p.innerHTML=`${tot?Math.round(own/tot*100):0}<small>%</small>`; a.append(big,p);
  const bar=document.createElement("div"); bar.className="bar"; bar.innerHTML=`<i style="width:${pc(cib)};background:var(--cib)"></i><i style="width:${pc(loose)};background:var(--loose)"></i>`;
  const lg=document.createElement("div"); lg.className="legend";
  lg.innerHTML=`<span><span class="dot" style="background:var(--cib)"></span>Complets${tab==="ps3"?" ou achetés":""} <b>${cib}</b></span><span><span class="dot" style="background:var(--loose)"></span>Incomplets <b>${loose}</b></span><span><span class="dot" style="background:var(--line)"></span>À trouver <b>${tot-own}</b></span>${(tab==="col"||tab==="ps3"||tab==="oop")?`<span>🏆 Platinés <b>${plat}</b></span>`:""}`;
  $("#sum").append(a,bar,lg);
  if(typeof upCur==="function") requestAnimationFrame(upCur);
}
// ---------- Cartes & Pop : une grille de numéros par album ----------
const albVar={};
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
function renderCards(){
  const albs=DATA.cards;
  if(!folded["cards|init"]){ for(const a of albs) folded[fkey(a.name)]=1; folded["cards|init"]=1; saveFold(); }
  { const anyOpen=albs.some(a=>!folded[fkey(a.name)]); $("#foldAll").hidden=!anyOpen; $("#openAll").hidden=anyOpen; }
  for(const sel of ["#addBtn","#restBtn","#cons","#grp","#photoBtn","#starChip"]) $(sel).hidden=true; if(filt==="star") filt="all";
  const list=$("#list"); list.textContent=""; let tot=0,own=0;
  for(const al of albs){
    const vi=al.pop?0:(albVar[al.name]||0), vk=al.pop?"c":(vi?"p"+vi:"v");
    const nameHit=!q||fold(al.name).includes(q);
    const has=(id,k)=>!!(state[id]&&state[id][k]);
    // totaux de l'album (version de base) et de la variante choisie
    let at=0,ao=0,st=0,so=0; const groups=[];
    if(al.pop){ const cards=[]; for(const it of al.items){ at++; const h=has(it.id,"c"); if(h)ao++; st++; if(h)so++;
        if(filt==="miss"&&h) continue; if(filt==="own"&&!h) continue; if(filt==="wish"&&!(state[it.id]&&state[it.id].w)) continue; if(!nameHit&&!fold(it.t+" "+it.n).includes(q)) continue; cards.push(it); }
      groups.push({g:null,cards}); }
    else for(const g of al.groups){ const cards=[]; let gt=0,go=0;
      for(const [id,code,vs] of g.cards){ at++; if(has(id,"v")) ao++;
        if(vi&&!vs) continue; const h=has(id,vk); st++; if(h)so++; gt++; if(h)go++;
        if(filt==="miss"&&h) continue; if(filt==="own"&&!h) continue; if(filt==="wish"&&(h||!albWished(al))) continue; if(!nameHit&&!fold(code).includes(q)) continue; cards.push([id,code]); }
      if(gt) groups.push({g:g.g,cards,gt,go}); }
    tot+=at; own+=ao;
    if((q||filt!=="all")&&!groups.some(g=>g.cards.length)) continue;
    const el=document.createElement("section"); el.className="sec"; const fk=fkey(al.name); const closed=!!folded[fk]&&!q; if(closed) el.classList.add("closed"); el.dataset.name=al.name;
    const h=document.createElement("div"); h.className="sech"; h.setAttribute("role","button"); h.tabIndex=0; h.setAttribute("aria-expanded",!closed);
    const h2=document.createElement("h2"); const ch=document.createElement("span"); ch.className="chev"; ch.textContent="▾"; h2.append(ch,document.createTextNode(al.name));
    const sp=document.createElement("span"); sp.textContent=so+" / "+st; const mini=document.createElement("span"); mini.className="mini"; mini.innerHTML=`<i style="width:${st?so/st*100:0}%"></i>`; sp.append(mini);
    const tg=()=>{ const stuck=!folded[fk]&&el.getBoundingClientRect().top<shH()-1; if(folded[fk]) delete folded[fk]; else folded[fk]=1; saveFold(); render();
      if(stuck){ const s2=[...document.querySelectorAll(".sec")].find(e=>e.dataset.name===al.name); if(s2) s2.scrollIntoView({block:"start"}); } };
    h.onclick=tg; h.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tg();}};
    h.append(h2,sp); el.append(h); list.append(el);
    if(!closed&&!al.pop&&st>so){ const wb=document.createElement("button"); wb.className="chip"; const on=albWished(al); wb.setAttribute("aria-pressed",on); wb.style.margin="10px 0 0"; wb.textContent=on?"🎁 Cartes manquantes dans ma liste d'envies ✓":"🎁 Mettre les cartes manquantes dans ma liste d'envies";
      wb.onclick=()=>{ const k="wa:"+al.name; if(albWished(al)) delete state[k]; else state[k]={w:1}; render(); persist(); }; el.append(wb); }
    if(closed) continue;
    if(!al.pop&&al.vars.length>1){ const vs=document.createElement("div"); vs.className="vsel"; vs.setAttribute("role","group"); vs.setAttribute("aria-label","Version");
      al.vars.forEach((nm,k)=>{ const key=k?"p"+k:"v"; let n=0,t=0; for(const g of al.groups) for(const [id,,v] of g.cards){ if(k&&!v) continue; t++; if(has(id,key)) n++; }
        const b=document.createElement("button"); b.className="chip"; b.setAttribute("aria-pressed",k===vi); b.innerHTML=""; b.append(document.createTextNode(cap(nm))); const bb=document.createElement("b"); bb.textContent=n+"/"+t; b.append(bb);
        b.onclick=()=>{ albVar[al.name]=k; render(); }; vs.append(b); }); el.append(vs); }
    let shown=0;
    for(const g of groups){ if(!g.cards.length) continue; shown+=g.cards.length;
      if(al.pop){ for(const it of g.cards){ const v=state[it.id]||{};
          const r=document.createElement("div"); r.className="row"; r.dataset.s=v.c?2:0;
          const tx=document.createElement("div"); tx.className="txt"; const t=document.createElement("div"); t.className="t"; t.textContent=it.t; const n=document.createElement("div"); n.className="n"; n.textContent=it.n; tx.append(t,n);
          const parts=document.createElement("div"); parts.className="parts"; const b=document.createElement("button"); b.className="st"; b.textContent="Possédée"; b.setAttribute("aria-pressed",!!v.c); b.setAttribute("aria-label",it.t+" "+it.n+" : possédée");
          b.onclick=()=>{ const cur=Object.assign({},state[it.id]||{}); if(cur.c) delete cur.c; else { cur.c=1; delete cur.w; } setState(it.id,cur); render(); persist(); }; parts.append(b);
          if(!v.c){ const gb=document.createElement("button"); gb.className="st gift"; gb.textContent="🎁"; gb.title="Liste d'envies"; gb.setAttribute("aria-pressed",!!v.w); gb.setAttribute("aria-label",it.t+" "+it.n+" : liste d'envies");
            gb.onclick=()=>{ const cur=Object.assign({},state[it.id]||{}); if(cur.w) delete cur.w; else cur.w=1; setState(it.id,cur); render(); persist(); }; parts.append(gb); }
          r.append(tx,parts); el.append(r); }
        continue; }
      const gw=document.createElement("div"); gw.className="cgrp";
      const gl=document.createElement("div"); gl.className="cgl"; const gn=document.createElement("b"); gn.textContent=g.g; const gc=document.createElement("span"); gc.textContent=g.go+" / "+g.gt; gl.append(gn,gc);
      const grid=document.createElement("div"); grid.className="cgrid";
      for(const [id,code] of g.cards){ const b=document.createElement("button"); b.className="cd"+(String(code).length>6?" wide":""); b.textContent=code; const on=has(id,vk);
        b.setAttribute("aria-pressed",on); b.setAttribute("aria-label",al.name+" n° "+code+(vi?" "+al.vars[vi]:"")); b.title=String(code);
        b.onclick=()=>{ const cur=Object.assign({},state[id]||{}); if(cur[vk]) delete cur[vk]; else cur[vk]=1; setState(id,cur); render(); persist(); };
        grid.append(b); }
      gw.append(gl,grid); el.append(gw); }
    if(!shown){ const e=document.createElement("div"); e.className="empty"; e.textContent=filt==="miss"?"Rien ne manque ici 🎉":"Rien à afficher ici."; el.append(e); }
  }
  $("#sum").innerHTML="";
  const a=document.createElement("div"); a.className="sumrow";
  const big=document.createElement("div"); big.className="big"; big.innerHTML=`${own}<small> / ${tot} possédées</small>`;
  const p=document.createElement("div"); p.className="big"; p.innerHTML=`${tot?Math.round(own/tot*100):0}<small>%</small>`; a.append(big,p);
  const bar=document.createElement("div"); bar.className="bar"; bar.innerHTML=`<i style="width:${tot?(own/tot*100).toFixed(1):0}%;background:var(--cib)"></i>`;
  const lg=document.createElement("div"); lg.className="legend"; lg.innerHTML=`<span><span class="dot" style="background:var(--cib)"></span>Possédées <b>${own}</b></span><span><span class="dot" style="background:var(--line)"></span>Manquantes <b>${tot-own}</b></span><span>Version de base, hors variantes</span>`;
  $("#sum").append(a,bar,lg);
  if(typeof upCur==="function") requestAnimationFrame(upCur);
}
// ---------- Liste d'envies partageable (🎁) ----------
let WISH={sb:null,uid:null,token:null,title:"Ma liste d'envies"};
function albWished(al){ return !!(state["wa:"+al.name]&&state["wa:"+al.name].w); }
function albMissing(al){ const out=[]; for(const g of al.groups) for(const [id,code] of g.cards){ if(!(state[id]&&state[id].v)) out.push(String(code)); } return out; }
function wishItems(){ const idx=new Map(); const SH={"PlayStation":"PS1","PlayStation 2":"PS2","PlayStation 3":"PS3","PlayStation 4":"PS4","PlayStation 5":"PS5","PS4 / PS5":"PS4/PS5","PS Vita":"Vita","PSP":"PSP","Master System":"Master System"};
  const put=(i,grp,plat)=>{ if(!idx.has(i.id)) idx.set(i.id,{t:i.t,g:grp,p:SH[plat]||plat||"",y:i.y||+((String(i.n||"").match(/\d{4}/)||[0])[0])||0,img:i.img||""}); };
  for(const i of DATA.col[0].items) put(i,i.series,i.plat); for(const i of custom) put(i,i.series,i.plat);
  for(const sc of DATA.moto) for(const i of sc.items) put(i,i.series,i.plat);
  for(const sc of DATA.sms) for(const i of sc.items) put(i,"Master System","Master System");
  for(const sc of DATA.ps3) for(const i of sc.items) put(i,"Compilations HD PS3","PlayStation 3");
  for(const sc of DATA.oop) for(const i of sc.items) put(i,"Only on PlayStation","PlayStation 4");
  for(const r of relItems()) put(r,r.series,r.plat);
  for(const al of DATA.cards) if(al.pop) for(const i of al.items) put(i,"Pop! "+al.name.replace(/^Pop! /,""),"");
  const out=[]; for(const [k,v] of Object.entries(state)){ if(v&&v.w&&idx.has(k)){ const o=Object.assign({id:k},idx.get(k)); if(k.startsWith("pop-")){ o.p=String(DATA.cards.find(a=>a.pop).items.find(i=>i.id===k).n||""); o.y=0; } out.push(o); } }
  for(const al of DATA.cards){ if(al.pop||!albWished(al)) continue; const m=albMissing(al); if(!m.length) continue; out.push({id:"wa:"+al.name,t:al.name,g:"Cartes à collectionner",p:m.length+" carte"+(m.length>1?"s":"")+" manquante"+(m.length>1?"s":""),y:0,img:"",m:m.join(", ")}); }
  return out.sort((a,b)=>cmpT(a.g,b.g)||cmpT(a.t,b.t)); }
let wishTimer=null;
function wishSync(){ if(!WISH.sb||!WISH.token) return; clearTimeout(wishTimer); wishTimer=setTimeout(async()=>{ try{ await WISH.sb.from("retro_wishlist").update({items:wishItems(),title:WISH.title,updated_at:new Date().toISOString()}).eq("user_id",WISH.uid); }catch(e){} },400); }
function wishUrl(){ return location.origin+location.pathname.replace(/[^/]*$/,"")+"envies.html?t="+WISH.token; }
function wishDlgRender(){ const n=wishItems().length; $("#wCount").textContent=n?n+" envie"+(n>1?"s":"")+" dans ta liste.":"Ta liste d'envies est vide : touche 🎁 sur ce que tu aimerais qu'on t'offre.";
  $("#wTitle").value=WISH.title; $("#wLinkBox").hidden=!WISH.token; if(WISH.token) $("#wLink").value=wishUrl();
  $("#wCreate").hidden=!!WISH.token; $("#wSee").hidden=!WISH.token; $("#wStop").hidden=!WISH.token; $("#wShare").hidden=!WISH.token||!navigator.share; $("#wCopy").hidden=!WISH.token; }
async function wishCreate(){ if(!WISH.sb){ $("#wMsg").textContent="Connexion au tracker indisponible."; return; }
  const a=new Uint8Array(18); crypto.getRandomValues(a); const tok=[...a].map(x=>x.toString(16).padStart(2,"0")).join("");
  WISH.title=($("#wTitle").value||"").trim().slice(0,80)||"Ma liste d'envies";
  const {error}=await WISH.sb.from("retro_wishlist").upsert({user_id:WISH.uid,token:tok,title:WISH.title,items:wishItems(),updated_at:new Date().toISOString()});
  if(error){ $("#wMsg").textContent="Impossible de créer le lien : "+error.message; return; } WISH.token=tok; $("#wMsg").textContent="Lien créé. Il se met à jour tout seul quand tu modifies ta liste."; wishDlgRender(); }
async function wishStop(){ if(!armed($("#wStop"),"Confirmer ?")) return; await WISH.sb.from("retro_wishlist").delete().eq("user_id",WISH.uid); WISH.token=null; $("#wMsg").textContent="Partage arrêté : l'ancien lien ne marche plus."; wishDlgRender(); }
let dirty=false;
function persist(){ if(!store) dirty=true;
  try{localStorage.setItem("retro-state",JSON.stringify(state));localStorage.setItem("retro-custom",JSON.stringify(custom));localStorage.setItem("retro-hidden",JSON.stringify(hidden));}catch(e){}
  if(!store) return; clearTimeout(timer);
  timer=setTimeout(async()=>{try{await store.set({state,custom,hidden}); wishSync();$("#save").textContent="Sauvegardé dans ton compte du tracker.";}catch(e){$("#save").textContent="Sauvegarde en ligne impossible : tes coches restent sur cet appareil.";}},600);
}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{tab=b.dataset.tab; if(tab!=="sms"&&filt==="star")filt="all";try{localStorage.setItem("retro-tab2",tab)}catch(e){}render();});
document.querySelectorAll(".chip[data-f]").forEach(b=>b.onclick=()=>{filt=b.dataset.f;render();});
$("#photoBtn").onclick=()=>{let n=0; for(const i of PHOTO){ if(!(state[i]&&state[i].c)){ setState(i,Object.assign({},state[i]||{},{c:1})); n++; } } render(); persist(); $("#save").textContent=n+" jeux cochés (case Jeu). Ajoute Boîte et Notice si tu les as.";};
document.querySelectorAll(".chip[data-g]").forEach(b=>b.onclick=()=>{GRP[tab]=b.dataset.g;try{localStorage.setItem("retro-grp2",JSON.stringify(GRP))}catch(e){}render();});
$("#restBtn").onclick=()=>{ if(!armed($("#restBtn"),"Confirmer ?")) return; hidden={}; render(); persist(); };
$("#foldAll").onclick=()=>{ for(const s of sections()) folded[fkey(s.name)]=1; saveFold(); render(); };
$("#openAll").onclick=()=>{ for(const s of sections()) delete folded[fkey(s.name)]; saveFold(); render(); };
const dlg=$("#addDlg");
function fillSel(){ const P=$("#fP"), S=$("#fS"); P.textContent=""; S.textContent="";
  for(const p of DATA.colplats.concat(["Master System","Nintendo Switch","Xbox","PC","Autre console"])){const o=document.createElement("option"); o.value=o.textContent=p; P.append(o);} P.value="PlayStation 5";
  const ser=[...new Set(DATA.colseries.filter(x=>x!=="Jeux seuls").concat(custom.map(c=>c.series).filter(x=>x!=="Jeux seuls")))];
  const add=(v,t)=>{const o=document.createElement("option"); o.value=v; o.textContent=t; S.append(o);};
  add("Jeux seuls","Jeux seuls (pas de série)"); add("__new","＋ Nouvelle série…"); for(const x of ser) add(x,x); }
$("#fS").onchange=()=>{ $("#fNwrap").hidden=$("#fS").value!=="__new"; };
$("#addBtn").onclick=()=>{ fillSel(); $("#addForm").reset(); $("#fO").value="c"; $("#fP").value="PlayStation 5"; $("#fNwrap").hidden=true; dlg.showModal(); $("#fT").focus(); };
const SHORT={"PS4 / PS5":"PS4/PS5","PlayStation":"PS1","PlayStation 2":"PS2","PlayStation 3":"PS3","PlayStation 4":"PS4","PlayStation 5":"PS5","PS Vita":"Vita","PSP":"PSP","Master System":"SMS"};
const PLAT_OF={"PS4/PS5":"PS4 / PS5",PS1:"PlayStation",PS2:"PlayStation 2",PS3:"PlayStation 3",PS4:"PlayStation 4",PS5:"PlayStation 5",VITA:"PS Vita",PSP:"PSP",SMS:"Master System","MASTER SYSTEM":"Master System"};
const keyOf=(t,p)=>fold(t).replace(/\b(the|le|la|les)\b/g,"").replace(/\s+/g," ").trim()+"|"+(/^(PlayStation [45]|PS4 \/ PS5)$/.test(p)?"ps45":p);
function colIndex(){ const m=new Map(); for(const i of DATA.col[0].items) m.set(keyOf(i.t,i.plat),i); for(const i of motoX()){ const k=keyOf(i.t,i.plat); if(!m.has(k)) m.set(k,i); } for(const c of custom) m.set(keyOf(c.t,c.plat),c); return m; }
function matchSeries(name){ const f=fold(name); const all=DATA.colseries.concat(custom.map(c=>c.series)); return all.find(x=>fold(x)===f||fold(x).replace(/ \(.*\)$/,"")===f)||name; }
function addOne(t,plat,ser,y,owned,idx,extra){ const ow=owned===true?{c:1}:owned; const ex=idx.get(keyOf(t,plat)); if(ex){ if(ow){ buildLinks(); setState(ex.id,Object.assign({},state[ex.id]||{},ow)); } return {id:ex.id,existing:true,series:ex.series,moto:!!ex.ms}; }
  const id="cus-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); const g=Object.assign({id,t,plat,series:ser,y,n:(SHORT[plat]||plat)+(y?" · "+y:""),tag:""},extra||{});
  custom.push(g); idx.set(keyOf(t,plat),g); if(ow){ buildLinks(); setState(id,Object.assign({},ow)); } return {id,existing:false,series:ser}; }
function showSec(name){ delete folded[fkey(name)]; saveFold(); render(); const sec=[...document.querySelectorAll(".sec")].find(e=>e.dataset.name===name); if(sec) sec.scrollIntoView({block:"start"}); }
dlg.addEventListener("close",()=>{ if(dlg.returnValue!=="ok") return; addFromForm().catch(e=>{ $("#save").textContent="Erreur pendant l'ajout : "+(e&&e.message||e); }); });
async function addFromForm(){ const t=$("#fT").value.trim(); if(!t){ $("#save").textContent="Ajout annulé : il manque le titre."; return; }
  let ser=$("#fS").value; if(ser==="__new") ser=$("#fN").value.trim()||"Jeux seuls"; let plat=$("#fP").value; const y=parseInt($("#fY").value)||0;
  const hdHit=PS3BOX().find(i=>hdKey(i.t)===hdKey(t)); let hdNote="";
  if(hdHit&&plat!=="PlayStation 3"&&plat!=="PS Vita"){ plat="PlayStation 3"; hdNote=" C'est une compilation PS3 : je l'ai mise sur PS3."; }
  const ownV={c:{c:1},cib:{b:1,n:1,c:1},no:false}[$("#fO").value]??{c:1};
  if(cons!=="all"&&cons!==plat&&!(PS45.has(plat)&&cons==="PlayStation 4")){cons="all"; try{localStorage.setItem("retro-cons",cons)}catch(e){}} if(filt!=="all") filt="all"; q=""; $("#q").value="";
  const idx=colIndex(); const r=addOne(t,plat,ser,y,ownV,idx); buildLinks(); if(r.existing) ser=r.series;
  render(); persist(); const where=GRP.col==="series"?ser:plat;
  const inHD=LINK.has(r.id)||PS3X.some(c=>c.id===r.id); const hdMsg=inHD?" Aussi coché dans l'onglet PS3 HD.":"";
  $("#save").textContent=(r.moto?"« "+t+" » coché dans "+ser+(ser!=="Jeux seuls"?" : les autres jeux de la série s'affichent maintenant.":"."):r.existing?"« "+t+" » était déjà dans ta liste ("+ser+") : je l'ai coché.":"« "+t+" » ajouté dans "+where+".")+hdNote+(ownV?hdMsg:(inHD?" Il apparaît aussi dans l'onglet PS3 HD.":"")); showSec(where);
  if(!$("#fR").checked) return;
  let sample=null;
  if(!sample){ $("#save").textContent+=" (Recherche des jeux liés indisponible ici.)"; return; }
  $("#save").textContent="Je cherche les autres jeux de la série de « "+t+" »…";
  try{
    const ans=await sample.json(`Tu es un expert des jeux vidéo et de leurs sorties en France. Un collectionneur ajoute le jeu « ${t} » (console : ${plat}${y?", "+y:""}) à sa liste.
Sa collection est centrée sur PlayStation. Donne la série ou franchise dont il fait partie (les suites, préquelles, remakes, compilations et spin-offs directs font partie de la même série) et TOUS les jeux de cette série sortis en boîte en France sur PlayStation : PS1, PS2, PSP, PS3, Vita, PS4, PS5.
Pour un jeu sorti sur PlayStation et sur d'autres consoles, ne donne QUE les versions PlayStation. Pour chaque jeu, mets dans plats TOUTES les consoles PlayStation où il est sorti (la page choisira la version).
Exception : un épisode de la série qui n'est JAMAIS sorti sur PlayStation peut être ajouté une seule fois, avec sa console d'origine (par exemple "Switch", "Xbox 360", "PC", "Master System"), pour que la série reste complète.
Utilise le titre français officiel. Un jeu sorti sur plusieurs consoles a une seule entrée avec toutes ses consoles. N'invente rien : en cas de doute, ne mets pas le jeu.
Si le jeu n'a ni suite ni série, réponds {"series":null,"games":[]}.
Réponds uniquement en JSON : {"series":"Nom de la série","games":[{"t":"Titre","plats":["PS2","PSP"],"y":2005}]}
Valeurs dans plats : "PS1","PS2","PSP","PS3","Vita","PS4","PS5", ou le nom court d'une autre console uniquement pour l'exception ci-dessus.`,{modelTier:"default"});
    if(!ans||!ans.series||!Array.isArray(ans.games)||!ans.games.length){ $("#save").textContent="« "+t+" » n'a pas de suite connue : il reste dans "+ser+"."; return; }
    let target=ser==="Jeux seuls"?matchSeries(String(ans.series)):ser;
    // le jeu ajouté rejoint la série trouvée s'il était en « Jeux seuls »
    const mine=custom.find(c=>c.id===r.id); if(mine&&mine.series==="Jeux seuls") mine.series=target;
    let n=0, seen=0; const GEN={PS1:0,PS2:1,PSP:1,PS3:2,VITA:2,"PS4/PS5":3}, HAND=["PSP","VITA"]; const addG=GEN[(SHORT[plat]||"").toUpperCase()]??3;

    for(const g of ans.games){ if(!g||typeof g.t!=="string") continue; const gy=parseInt(g.y)||0;
      let pl=(Array.isArray(g.plats)?g.plats:[]).map(x=>String(x).toUpperCase().trim()); if(pl.includes("PS4")||pl.includes("PS5")) pl=pl.filter(x=>x!=="PS4"&&x!=="PS5").concat(["PS4/PS5"]);
      // une seule version salon par jeu : celle la plus proche de la console du jeu ajouté (PS1 → PS2 → PS3 → PS4/PS5)
      const home=pl.filter(x=>x in GEN&&!HAND.includes(x)), hand=pl.filter(x=>HAND.includes(x)), other=pl.filter(x=>!(x in GEN));
      let keep=[], flag={};
      if(home.length){ keep=[home.sort((a,b)=>Math.abs(GEN[a]-addG)-Math.abs(GEN[b]-addG)||GEN[b]-GEN[a])[0]]; }
      else if(!hand.length) keep=other.slice(0,1);
      const todo=keep.map(p=>[p,{}]).concat(hand.map(p=>[p,home.length?{hand:1}:{}]));
      for(const [p,ex] of todo){ const P=PLAT_OF[p]||p.slice(0,30); if(!P) continue;
        const res=addOne(g.t.slice(0,120),P,target,gy,false,idx,ex); if(res.existing) seen++; else n++; } }
    render(); persist();
    const pre=r.existing?"« "+t+" » était déjà dans ta liste, je l'ai coché. ":"";
    $("#save").textContent=pre+(n?"Série « "+target+" » : "+n+" jeu"+(n>1?"x":"")+" lié"+(n>1?"s":"")+" ajouté"+(n>1?"s":"")+" (à vérifier, retire ceux qui sont faux avec ✕).":"Série « "+target+" » : tous les jeux liés étaient déjà dans ta liste.");
    if(GRP.col==="series") showSec(target);
  }catch(e){ $("#save").textContent=(e&&e.code==="not_granted")?"Recherche des jeux liés refusée : seul « "+t+" » a été ajouté.":"Impossible de trouver les jeux liés pour l'instant : seul « "+t+" » a été ajouté."; }
}
$("#q").addEventListener("input",e=>{q=fold(e.target.value.trim());render();});
// ---------- Export ----------
// ---------- Export en image : lignes réparties en colonnes, plusieurs images si la liste est très longue ----------
async function makeJpgs(ks,what,name){
  try{ await Promise.all(["600 26px Barlow","400 22px Barlow","700 34px 'Chakra Petch'","500 18px 'JetBrains Mono'"].map(f=>document.fonts.load(f))); }catch(e){}
  const C={bg:"#0b0c10",fg:"#e9ecf2",mu:"#8c94a7",line:"#252935",ok:"#3fc27f",half:"#e9b13c",miss:"#4a5060",acc:"#3fc2b5",gold:"#e9b13c"};
  const F={title:"700 46px 'Chakra Petch',system-ui,sans-serif",list:"700 34px 'Chakra Petch',system-ui,sans-serif",sec:"700 24px 'Chakra Petch',system-ui,sans-serif",item:"600 25px Barlow,system-ui,sans-serif",info:"400 21px Barlow,system-ui,sans-serif",chip:"500 18px 'JetBrains Mono',ui-monospace,monospace",small:"400 22px Barlow,system-ui,sans-serif"};
  const data=[]; let total=0, owned=0;
  for(const k of ks){ const rows=exportRows(k,what); if(!rows.length) continue; const secs=[]; let cur=null;
    for(const r of rows){ const o=r.st==="Complet"||r.st==="Possédée"||r.st==="Acheté"||r.st==="Incomplet"; total++; if(o) owned++;
      if(!cur||cur.name!==r.sec){ cur={name:r.sec,rows:[]}; secs.push(cur); } cur.rows.push(r); }
    data.push({k,label:name(k),secs}); }
  if(!data.length) return [];
  const cv=document.createElement("canvas"), cx=cv.getContext("2d");
  const fit=(t,w,font)=>{ cx.font=font; if(cx.measureText(t).width<=w) return t; let a=0,b=t.length; while(a<b){ const m=(a+b+1)>>1; if(cx.measureText(t.slice(0,m)+"…").width<=w) a=m; else b=m-1; } return t.slice(0,a)+"…"; };
  const dotCol=st=>st==="Complet"||st==="Possédée"||st==="Acheté"?C.ok:st==="Incomplet"?C.half:C.miss;
  function lines(colW){ const L=[];
    for(const d of data){ L.push({h:62,keep:2,draw:(x,y)=>{ cx.font=F.list; cx.fillStyle=C.acc; cx.fillText(fit(d.label.toUpperCase(),colW,F.list),x,y+42); cx.fillStyle=C.acc; cx.fillRect(x,y+54,colW,3); }});
      for(const sc of d.secs){ const own=sc.rows.filter(r=>dotCol(r.st)!==C.miss).length;
        L.push({h:50,keep:1,draw:(x,y)=>{ cx.font=F.sec; cx.fillStyle=C.fg; const cnt=own+" / "+sc.rows.length; cx.font="500 19px 'JetBrains Mono',monospace"; const cw=cx.measureText(cnt).width; cx.fillStyle=C.mu; cx.fillText(cnt,x+colW-cw,y+36); cx.font=F.sec; cx.fillStyle=C.fg; cx.fillText(fit(sc.name.toUpperCase(),colW-cw-16,F.sec),x,y+36); cx.fillStyle=C.line; cx.fillRect(x,y+46,colW,2); }});
        if(d.k==="cards"&&!sc.rows[0].plat&&sc.rows.every(r=>!/ · /.test(r.info)||true)&&sc.rows.length&&sc.rows[0].info&&!/^#/.test(sc.rows[0].info)){
          const cw=Math.max(64,Math.min(110,Math.max(...sc.rows.map(r=>r.t.length))*12+20)), per=Math.max(1,Math.floor((colW+8)/(cw+8)));
          for(let i=0;i<sc.rows.length;i+=per){ const chunk=sc.rows.slice(i,i+per);
            L.push({h:46,draw:(x,y)=>{ chunk.forEach((r,j)=>{ const cxp=x+j*(cw+8), on=dotCol(r.st)!==C.miss; cx.fillStyle=on?"rgba(63,194,127,.22)":"transparent"; cx.strokeStyle=on?C.ok:C.line; cx.lineWidth=2;
              cx.beginPath(); cx.roundRect?cx.roundRect(cxp,y+4,cw,36,7):cx.rect(cxp,y+4,cw,36); cx.fill(); cx.stroke(); cx.font=F.chip; cx.fillStyle=on?C.fg:C.mu; const t=fit(r.t,cw-8,F.chip); const tw=cx.measureText(t).width; cx.fillText(t,cxp+(cw-tw)/2,y+29); }); }}); }
          continue; }
        for(const r of sc.rows){ L.push({h:42,draw:(x,y)=>{ cx.fillStyle=dotCol(r.st); cx.beginPath(); cx.arc(x+10,y+22,8,0,7); cx.fill();
            let tx=x+30, room=colW-30; if(r.pl){ cx.font="24px system-ui"; cx.fillText("🏆",x+colW-28,y+30); room-=36; }
            cx.font=F.item; const tt=fit(r.t,room,F.item); cx.fillStyle=dotCol(r.st)===C.miss?"#c4c9d4":C.fg; cx.fillText(tt,tx,y+30);
            const used=cx.measureText(tt).width; const info=(r.info&&d.k!=="sms")?(r.info.replace(/^#/,"#")):""; if(info&&used+20<room){ cx.font=F.info; cx.fillStyle=C.mu; cx.fillText(fit("  "+info,room-used,F.info),tx+used,y+30); } }}); } } }
    return L; }
  const HEAD=212, PAD=48, GAP=48, MAXH=9000;
  let W=1080,N=1,L=lines(W-2*PAD), tot=L.reduce((a,l)=>a+l.h,0);
  for(const [w,n] of [[1080,1],[1080,2],[1500,3],[1920,4]]){ W=w; N=n; const colW=(W-2*PAD-(N-1)*GAP)/N; L=lines(colW); tot=L.reduce((a,l)=>a+l.h,0); if(tot/N<=Math.max(1.6*W,1400)) break; }
  const colW=(W-2*PAD-(N-1)*GAP)/N; const cap=Math.min(MAXH,Math.max(400,Math.ceil(tot/N)+60));
  // flow lines into columns (a heading never ends a column), columns into pages
  const cols=[]; let col=[], h=0;
  for(let i=0;i<L.length;i++){ const l=L[i]; let need=l.h; if(l.keep){ let j=i+1, k=0; while(j<L.length&&k<l.keep){ need+=L[j].h; j++; k++; } }
    if(h+need>cap&&col.length){ cols.push(col); col=[]; h=0; } col.push(l); h+=l.h; }
  if(col.length) cols.push(col);
  const pages=[]; for(let i=0;i<cols.length;i+=N) pages.push(cols.slice(i,i+N));
  const d=new Date(), date=d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
  const WHAT={all:"Toute la liste",own:"Ce que j'ai",miss:"Ce qui me manque",plat:"Mes platinés / 100 %"}[what];
  const out=[];
  for(let p=0;p<pages.length;p++){ const ph=Math.max(...pages[p].map(c=>c.reduce((a,l)=>a+l.h,0)));
    cv.width=W; cv.height=HEAD+ph+PAD+40; cx.fillStyle=C.bg; cx.fillRect(0,0,cv.width,cv.height); cx.textBaseline="alphabetic";
    cx.font=F.title; cx.fillStyle=C.fg; cx.fillText("Ma collection rétro",PAD,PAD+46);
    cx.font=F.small; cx.fillStyle=C.mu; cx.fillText(fit(data.map(x=>x.label).join(" · ")+" — "+WHAT+" — "+date+(pages.length>1?" — image "+(p+1)+"/"+pages.length:""),W-2*PAD,F.small),PAD,PAD+86);
    // légende
    let lx=PAD; const ly=PAD+122; const leg=what==="miss"?[[C.miss,"À trouver"]]:what==="all"?[[C.ok,"Complet / possédé"],[C.half,"Incomplet"],[C.miss,"À trouver"]]:[[C.ok,"Complet / possédé"],[C.half,"Incomplet"]];
    for(const [c,t] of leg){ cx.fillStyle=c; cx.beginPath(); cx.arc(lx+9,ly-8,8,0,7); cx.fill(); cx.font=F.small; cx.fillStyle=C.mu; cx.fillText(t,lx+24,ly); lx+=cx.measureText(t).width+60; }
    const cnt=(what==="all"?owned+" / "+total+" possédés":total+(what==="miss"?" à trouver":what==="plat"?" platinés":" possédés")); cx.font="500 24px 'JetBrains Mono',monospace"; cx.fillStyle=C.fg; const cw2=cx.measureText(cnt).width; cx.fillText(cnt,W-PAD-cw2,ly);
    cx.fillStyle=C.line; cx.fillRect(PAD,HEAD-18,W-2*PAD,2);
    pages[p].forEach((c,i)=>{ let y=HEAD-10; const x=PAD+i*(colW+GAP); for(const l of c){ l.draw(x,y); y+=l.h; } });
    cx.font="400 18px Barlow,system-ui"; cx.fillStyle=C.miss; cx.fillText("Ratchet Legacy · checklist de collection",PAD,cv.height-24);
    out.push(await new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error("image trop grande")),"image/jpeg",0.9))); }
  return out; }
const ELISTS=[["col","Ma collection"],["sms","Master System"],["ps3","PS3 HD"],["oop","Only on PS"],["cards","Cartes & Pop"]];
const eDlg=$("#eDlg");
$("#expBtn").onclick=()=>{ const box=$("#eLists"); box.textContent="";
  for(const [k,lab] of ELISTS){ const l=document.createElement("label"); l.className="ck"; l.style.marginTop="4px"; const c=document.createElement("input"); c.type="checkbox"; c.value=k; c.checked=k===tab; l.append(c,document.createTextNode(" "+lab)); box.append(l); }
  $("#eMsg").textContent=""; eDlg.showModal(); };
function exportRows(k,what){ const rows=[]; const keep=(h,v)=>what==="all"||(what==="plat"?!!(v&&v.pl):what==="wish"?!!(v&&v.w):what==="own"?h:!h);
  if(k==="cards"){ for(const al of DATA.cards){
      if(al.pop){ for(const it of al.items){ const h=!!(state[it.id]&&state[it.id].c); if(keep(h)) rows.push({sec:al.name,t:it.t,info:it.n,plat:"",parts:"",st:h?"Possédée":"Manquante"}); } continue; }
      for(const g of al.groups) for(const [id,code] of g.cards){ const v=state[id]||{}; const h=!!v.v; if(!keep(h)) continue;
        const vs=al.vars.slice(1).map((nm,i)=>v["p"+(i+1)]?nm:null).filter(Boolean).join(", ");
        rows.push({sec:al.name,t:String(code),info:g.g,plat:"",parts:vs?"Variantes : "+vs:"",st:h?"Possédée":"Manquante"}); } }
    return rows; }
  const sv={tab,cons,q,filt}; tab=k; cons="all"; q=""; filt="all"; let secs;
  try{ buildLinks(); secs=sections(); 
    for(const sc of secs) for(const it of sc.items){ const v=state[it.id]||{}; const s2=status(v,sc.digital); const h=s2===1||s2===2; if(!keep(h,v)) continue;
      const P=sc.digital?[["a","Acheté"]]:PARTS[k].map(p=>p[0]==="c"&&it.card?["c","Carte"]:p);
      rows.push({sec:sc.name,t:it.t,info:it.n||"",plat:it.plat||(k==="sms"?"Master System":k==="oop"?"PS4":k==="ps3"?"PS3":""),parts:P.filter(p=>v[p[0]]).map(p=>p[1]).join(" + "),st:s2===2?"Complet":s2===1?(sc.digital?"Acheté":"Incomplet"):"À trouver",pl:!!v.pl}); } }
  finally{ tab=sv.tab; cons=sv.cons; q=sv.q; filt=sv.filt; }
  return rows; }
$("#eGo").onclick=async()=>{ const ks=[...$("#eLists").querySelectorAll("input:checked")].map(c=>c.value); if(!ks.length){ $("#eMsg").textContent="Coche au moins une liste."; return; }
  const what=$("#eWhat").value, fmt=$("#eFmt").value; const name=k=>ELISTS.find(x=>x[0]===k)[1]; let out="", n=0;
  if(fmt==="jpg"){} else if(fmt==="csv"){ const esc=x=>{x=String(x??""); return /[";\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x;};
    const L=[["Liste","Section","Titre","Infos","Console","Ce que j'ai","Statut","Platine / 100 %"].join(";")];
    for(const k of ks) for(const r of exportRows(k,what)){ n++; L.push([name(k),r.sec,r.t,r.info,r.plat,r.parts,r.st,r.pl?"Oui":""].map(esc).join(";")); }
    out="\ufeff"+L.join("\r\n"); }
  else { const L=[]; for(const k of ks){ const rows=exportRows(k,what); if(!rows.length) continue; L.push("=== "+name(k).toUpperCase()+" ("+rows.length+") ==="); let cur=null;
      for(const r of rows){ n++; if(r.sec!==cur){ cur=r.sec; L.push("","# "+cur); } L.push((r.st==="Complet"||r.st==="Possédée"||r.st==="Acheté"?"[x] ":r.st==="Incomplet"?"[~] ":"[ ] ")+r.t+(r.info&&k!=="cards"?" ("+r.info+")":"")+(r.parts&&r.st!=="Complet"?" · "+r.parts:"")+(r.pl?" 🏆":"")); } L.push("",""); }
    out=L.join("\n"); }
  if(fmt==="jpg"){ let pages; $("#eMsg").textContent="Création de l'image…";
    try{ pages=await makeJpgs(ks,what,name); }catch(e){ $("#eMsg").textContent="Impossible de créer l'image : "+(e&&e.message||e); return; }
    if(!pages.length){ $("#eMsg").textContent="Rien à exporter avec ces choix."; return; }
    const d=new Date(), stamp=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const base="Collection"+(ks.length===1?"-"+name(ks[0]).replace(/[^\w]+/g,"-"):"")+(what==="miss"?"-a-trouver":what==="own"?"-possedes":what==="plat"?"-platines":what==="wish"?"-envies":"")+"-"+stamp;
    let dl=DL;
    if(!dl){ $("#eMsg").textContent="Téléchargement indisponible ici."; return; }
    for(let i=0;i<pages.length;i++){ const fn=base+(pages.length>1?"-"+(i+1)+"sur"+pages.length:"")+".jpg";
      $("#eMsg").textContent=pages.length>1?"Image "+(i+1)+" sur "+pages.length+" : confirme l'enregistrement.":"Confirme l'enregistrement de l'image.";
      try{ await dl.save({filename:fn,data:pages[i]}); }
      catch(e){ const c=e&&e.code; $("#eMsg").textContent=c==="declined"?"Export annulé.":c==="rate_limited"?"Une demande est déjà ouverte, réessaie dans un instant.":"Export impossible ici."; return; } }
    $("#eMsg").textContent=pages.length>1?pages.length+" images enregistrées (la liste était trop longue pour une seule).":"Image enregistrée."; return; }
  if(!n){ $("#eMsg").textContent="Rien à exporter avec ces choix."; return; }
  const d=new Date(), stamp=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const fname="Collection"+(ks.length===1?"-"+name(ks[0]).replace(/[^\w]+/g,"-"):"")+(what==="miss"?"-a-trouver":what==="own"?"-possedes":what==="plat"?"-platines":what==="wish"?"-envies":"")+"-"+stamp+"."+fmt;
  let dl=DL;
  if(!dl){ try{ await navigator.clipboard.writeText(out.replace(/^\ufeff/,"")); $("#eMsg").textContent="Téléchargement indisponible ici : "+n+" lignes copiées dans le presse-papiers."; }catch(e){ $("#eMsg").textContent="Téléchargement indisponible ici."; } return; }
  $("#eMsg").textContent="Préparation de "+n+" lignes…";
  try{ await dl.save({filename:fname,data:out}); $("#eMsg").textContent=n+" lignes exportées."; }
  catch(e){ const c=e&&e.code; $("#eMsg").textContent=c==="declined"?"Export annulé.":c==="rate_limited"?"Une demande est déjà ouverte, réessaie dans un instant.":"Export impossible ici."; } };
// transfert des coches entre deux pages (fichier téléchargé → page en ligne)
const xd=$("#xDlg");
$("#xBtn").onclick=()=>{ $("#xMsg").textContent=""; $("#xTxt").value=""; xd.showModal(); };
$("#xClose").onclick=()=>xd.close();
$("#xCopy").onclick=async()=>{ const st={}; for(const k in state) if(!k.startsWith("__")) st[k]=state[k];
  const txt="RCCHK1:"+JSON.stringify({state:st,custom,hidden}); const ta=$("#xTxt"); ta.value=txt; let ok=false;
  try{ await navigator.clipboard.writeText(txt); ok=true; }catch(e){ try{ ta.focus(); ta.select(); ok=document.execCommand("copy"); }catch(e2){} }
  $("#xMsg").textContent=Object.keys(st).length+" jeux cochés "+(ok?"copiés. Colle-les dans la page en ligne.":"prêts : copie tout le texte du cadre à la main.") };
$("#xImp").onclick=()=>{ let raw=$("#xTxt").value.trim(); if(raw.startsWith("RCCHK1:")) raw=raw.slice(7); let d;
  try{ d=JSON.parse(raw); }catch(e){ $("#xMsg").textContent="Ce texte n'est pas reconnu : recopie-le en entier depuis l'autre page."; return; }
  let n=0,c=0; const ids=new Set(custom.map(x=>x.id));
  if(Array.isArray(d.custom)) for(const g of d.custom){ if(g&&g.id&&g.t&&!ids.has(g.id)){ custom.push(g); ids.add(g.id); c++; } }
  if(d.hidden&&typeof d.hidden==="object") Object.assign(hidden,d.hidden);
  if(d.state&&typeof d.state==="object") for(const k in d.state){ if(k.startsWith("__")) continue; const v=norm(d.state[k]); if(!Object.keys(v).length) continue;
    const m=Object.assign({},state[k]||{},v); if(JSON.stringify(m)!==JSON.stringify(state[k]||{})) n++; state[k]=m; }
  syncLinks(); render(); persist();
  $("#xMsg").textContent=n+" jeu"+(n>1?"x":"")+" mis à jour"+(c?", "+c+" jeu"+(c>1?"x":"")+" ajouté"+(c>1?"s":"")+" à ta liste":"")+(store?". Sauvegardé dans ton compte.":". Attention : cette page n'est pas reliée à ton compte."); };
// bandeau de la série ouverte, collé sous l'en-tête
let curSec=null;
function upCur(){ const sh=shH(), c=$("#cur"); let hit=null;
  for(const el of document.querySelectorAll(".sec:not(.closed)")){ const r=el.getBoundingClientRect(), h=el.querySelector(".sech").getBoundingClientRect(); if(h.top<sh-2&&r.bottom>sh+50){ hit=el; break; } }
  curSec=hit; if(!hit){ c.hidden=true; return; }
  $("#curN").textContent=hit.dataset.name; $("#curC").textContent=hit.querySelector(".sech > span").firstChild.textContent; c.hidden=false; }
addEventListener("scroll",upCur,{passive:true}); document.addEventListener("scroll",upCur,{passive:true,capture:true}); addEventListener("resize",upCur);
const curGo=()=>{ if(curSec) curSec.querySelector(".sech").click(); setTimeout(upCur,30); };
$("#cur").onclick=curGo; $("#cur").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();curGo();}};
if(migrate()){try{localStorage.setItem("retro-state",JSON.stringify(state));}catch(e){}}
render();
(async()=>{
  try{
    const cfg=window.RETRO_SB; const sb=window.supabase.createClient(cfg.url,cfg.key);
    const {data:{session}}=await sb.auth.getSession(); const u=session&&session.user;
    if(!u){ window.retroLock("Connecte-toi d'abord au tracker avec ton compte admin."); return; }
    const {data:adm}=await sb.from("admins").select("user_id").eq("user_id",u.id).maybeSingle();
    if(!adm){ window.retroLock("Cette page est réservée à l'administrateur."); return; }
    document.body.classList.remove("locked");
    WISH.sb=sb; WISH.uid=u.id; try{ const {data:w}=await sb.from("retro_wishlist").select("token,title").eq("user_id",u.id).maybeSingle(); if(w){ WISH.token=w.token; WISH.title=w.title||WISH.title; } }catch(e){}
    store={ get:async()=>{ const {data,error}=await sb.from("retro_state").select("state,custom,hidden").eq("user_id",u.id).maybeSingle(); if(error) throw error; return {exists:!!data,data:()=>data}; },
            set:async(o)=>{ const {error}=await sb.from("retro_state").upsert({user_id:u.id,state:o.state,custom:o.custom,hidden:o.hidden,updated_at:new Date().toISOString()}); if(error) throw error; } };
    const snap=await store.get();
    if(snap.exists){const d=snap.data()||{};
      const locC=custom, locH=hidden, locS=state, wasDirty=dirty;
      const dbC=Array.isArray(d.custom)?d.custom:[]; const ids=new Set(dbC.map(c=>c.id)); custom=dbC.concat(wasDirty?locC.filter(c=>!ids.has(c.id)):[]);
      hidden=Object.assign({},(d.hidden&&typeof d.hidden==="object")?d.hidden:{},wasDirty?locH:{});
      state=fixAll(Object.assign({},(d.state&&typeof d.state==="object")?d.state:{},wasDirty?locS:{}));
      if(migrate()||wasDirty) persist(); render();}
    else if(Object.keys(state).length){persist();}
    $("#save").textContent="Tes coches sont sauvegardées dans ton compte du tracker.";
  }catch(e){ console.error(e); $("#save").textContent="Connexion au tracker impossible : tes coches restent sur cet appareil."; }
})();

// boutons de la liste d'envies
$("#wishBtn").onclick=()=>{ $("#wMsg").textContent=""; wishDlgRender(); $("#wDlg").showModal(); };
$("#wCreate").onclick=wishCreate; $("#wStop").onclick=wishStop;
$("#wTitle").onchange=()=>{ WISH.title=($("#wTitle").value||"").trim().slice(0,80)||"Ma liste d'envies"; wishSync(); };
$("#wCopy").onclick=async()=>{ try{ await navigator.clipboard.writeText(wishUrl()); $("#wMsg").textContent="Lien copié : colle-le dans un message."; }catch(e){ $("#wLink").select(); $("#wMsg").textContent="Sélectionne le lien et copie-le."; } };
$("#wShare").onclick=async()=>{ try{ await navigator.share({title:WISH.title,text:WISH.title+" 🎁",url:wishUrl()}); }catch(e){} };
$("#wSee").onclick=()=>{ if(WISH.token) window.open(wishUrl(),"_blank"); };
