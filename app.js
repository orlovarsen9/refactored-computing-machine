
(() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbyitEcLyl1VA4ZadbxoSfGMUIQAWxVwVf6wG7kn_A8xzdMiVRF9_mN24geYzgQTAJHzuA/exec";
  const CACHE_KEY = "project_crm_shared_cache_v22";
  const sessionKey = "project_crm_shared_session_v22";

  const seed = {
    users: [
      {id:"u_admin",name:"Главный администратор",login:"admin",password:"admin123",role:"admin",phone:"",active:true},
      {id:"u_mgr1",name:"Александр",login:"manager1",password:"manager123",role:"manager",phone:"",active:true},
      {id:"u_view",name:"Наблюдатель",login:"viewer",password:"viewer123",role:"viewer",phone:"",active:true}
    ],
    defaultStages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],
    blockOptions:["Блок 1","Блок 2","Блок 3","Блок 4","Блок 5"],
    clients:[
      {id:"c1",number:1,name:"Иван",gender:"male",block:"",blockReaction:"",blockRecords:[{block:"Блок 1",reaction:"Положительная",comments:[{ts:"2026-08-30T18:21:00",text:"Хорошо воспринял информацию по первому блоку.",authorName:"Александр"}]},{block:"Блок 2",reaction:"Негативная",comments:[{ts:"2026-08-31T10:15:00",text:"По второму блоку возникли возражения.",authorName:"Александр"}]}],discussion:"Познакомились, обсудили цели",notes:"Перезвонить после выходных",nick:"ivan",age:"34",managerId:"u_mgr1",profession:"Предприниматель",interests:"Путешествия",startDate:"2026-08-23",lastContact:"2026-08-30",nextContact:"2026-09-01",stageIndex:2,stages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],deleted:false,history:[
        {ts:"2026-08-30T18:21:00",text:"Добавлен комментарий: «Обсудили дополнительный доход»"},
        {ts:"2026-08-28T15:07:00",text:"Создан проект"}
      ]},
      {id:"c2",number:2,name:"Анна",gender:"female",block:"",blockReaction:"",blockRecords:[{block:"Блок 1",reaction:"Нейтральная",comments:[{ts:"2026-08-27T12:30:00",text:"Первичная реакция без явного интереса.",authorName:"Александр"}]}],discussion:"Обсудили текущую ситуацию",notes:"Вернуться к разговору позже",nick:"anna",age:"29",managerId:"u_mgr1",profession:"Маркетолог",interests:"Спорт",startDate:"2026-08-27",lastContact:"2026-08-30",nextContact:"2026-09-02",stageIndex:4,stages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],deleted:false,history:[{ts:"2026-08-27T12:00:00",text:"Создан проект"}]}
    ],
    audit:[]
  };


  let db = JSON.parse(JSON.stringify(seed));
  let session = loadSession();
  let syncing = false;

  function loadSession(){
    try{ return JSON.parse(localStorage.getItem(sessionKey)||"null") }catch(e){ return null }
  }
  function setSession(s){
    session=s;
    localStorage.setItem(sessionKey,JSON.stringify(s));
    render();
  }
  function logout(){
    session=null;
    localStorage.removeItem(sessionKey);
    render();
  }
  async function api(action,payload={}){
    const r=await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action,token:session?.token||"",...payload})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok || data.ok===false) throw new Error(data.error||"Ошибка сервера");
    return data;
  }
  async function fetchState(){
    if(!session?.token) return false;
    try{
      const data=await api("getState");
      db=data.state;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      return true;
    }catch(e){
      console.error(e);
      if(String(e.message||"").toLowerCase().includes("сесс")) logout();
      return false;
    }
  }
  async function syncRemote(renderAfter=false){
    if(!session?.token || syncing) {
      if(renderAfter) render();
      return;
    }
    syncing=true;
    try{
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      const data=await api("saveState",{state:db});
      if(data.state) db=data.state;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
    }catch(e){
      console.error("Sync error:",e);
      alert("Не удалось сохранить изменения в общей базе. Проверьте интернет.");
    }finally{
      syncing=false;
      if(renderAfter) render();
    }
  }
  function save(){ syncRemote(true); }


  const app = document.getElementById("app");
  const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const fmtDate = d => d ? new Date(d+"T00:00:00").toLocaleDateString("ru-RU") : "—";
  const daysBetween = d => {
    if(!d) return 0;
    const a = new Date(d+"T00:00:00"), b = new Date();
    return Math.max(0, Math.floor((b-a)/86400000)+1);
  };
  const uid = p => p + Math.random().toString(36).slice(2,10);
  const nowISO = () => new Date().toISOString();

  function pipeline(c, clickable=false){
    const n = c.stages.length;
    const idx = Math.max(0,Math.min(c.stageIndex,n-1));
    const pct = n<=1 ? 0 : (idx/(n-1))*94;
    return `<div class="pipeline"><div class="pipe-track" style="--count:${n};--progress:${pct}%">
      <div class="pipe-progress"></div>
      ${c.stages.map((s,i)=>`<div class="stage ${i<idx?"done":i===idx?"current":""}" ${clickable?`data-stage="${i}" style="cursor:pointer"`:""}>
        <div class="dot"></div><div class="stage-name">${esc(s)}</div>
      </div>`).join("")}
    </div></div>`;
  }

  function loginView(){
    app.innerHTML = `<div class="login-wrap"><div class="login-card">
      <div class="login-logo"><img class="login-sticker" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyNCIgZmlsbD0iIzI1MzI0NiIvPgo8Y2lyY2xlIGN4PSI1MCIgY3k9IjM3IiByPSIxNyIgZmlsbD0iI2Y1OWUwYiIvPgo8cGF0aCBkPSJNMjAgODVjNC0yMCAxNi0zMCAzMC0zMHMyNiAxMCAzMCAzMCIgZmlsbD0iI2Y1OWUwYiIvPgo8L3N2Zz4=" alt="">Про<span>ект</span></div>
      <div class="muted" style="margin-bottom:22px">Система управления проектами</div>
      <form id="loginForm">
        <div class="field" style="margin-bottom:12px"><label>Логин</label><input name="login" required autocomplete="username"></div>
        <div class="field" style="margin-bottom:16px"><label>Пароль</label><input type="password" name="password" required autocomplete="current-password"></div>
        <button class="btn primary" style="width:100%">Войти</button>
      </form>
      <div id="loginErr" class="small" style="color:#b91c1c;margin-top:12px"></div>
    </div></div>`;
    document.getElementById("loginForm").onsubmit = async e => {
      e.preventDefault();
      const fd=new FormData(e.target);
      const login=String(fd.get("login")||"").trim();
      const password=String(fd.get("password")||"");
      const err=document.getElementById("loginErr");
      err.textContent="Проверка...";
      try{
        const data=await api("login",{login,password});
        session={token:data.token,userId:(data.user&&data.user.id)||(data.state.users.find(u=>u.login===login)?.id)||"u_admin"};
        localStorage.setItem(sessionKey,JSON.stringify(session));
        db=data.state;
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));
        render();
      }catch(ex){
        err.textContent=ex.message||"Неверный логин или пароль.";
      }
    };
  }

  function shell(content){
    const me = db.users.find(u=>u.id===session.userId);
    if(!me){logout();return}
    const menu = (me.role==="admin" || me.role==="viewer")
      ? [["dashboard","⌂","Главная"],["managers","◉","Менеджеры"],["allclients","▦","Проекты"],["trash","⌫","Корзина"],...(me.role==="admin"?[["users","♙","Пользователи"]]:[])]
      : [["clients","⌂","Главная"],["clients","▦","Проекты"],["trash","⌫","Корзина"]];
    const theme = localStorage.getItem("project_theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
    app.innerHTML = `<div class="app-shell">
      <aside class="sidebar">
        <div class="side-brand"><img class="brand-sticker" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyNCIgZmlsbD0iIzI1MzI0NiIvPgo8Y2lyY2xlIGN4PSI1MCIgY3k9IjM3IiByPSIxNyIgZmlsbD0iI2Y1OWUwYiIvPgo8cGF0aCBkPSJNMjAgODVjNC0yMCAxNi0zMCAzMC0zMHMyNiAxMCAzMCAzMCIgZmlsbD0iI2Y1OWUwYiIvPgo8L3N2Zz4=" alt=""><span>Проект</span></div>
        <div class="side-user">
          <div class="avatar">${me.avatar?`<img src="${me.avatar}" alt="">`:esc((me.name||"П").charAt(0).toUpperCase())}</div>
          <div><b>${esc(me.name)}</b><span>${roleName(me.role)}</span></div>
        </div>
        <nav class="side-nav">
          ${menu.map(([id,ico,title])=>`<button class="side-link" data-nav="${id}"><span>${ico}</span>${title}</button>`).join("")}
        </nav>
        <div class="side-bottom">
          <button id="themeBtn" class="side-link"><span>${theme==="dark"?"☀":"☾"}</span>${theme==="dark"?"Светлая тема":"Тёмная тема"}</button>
          <button id="logoutBtn" class="side-link"><span>↪</span>Выйти</button>
        </div>
      </aside>
      <section class="content-shell">
        <header class="mobile-top">
          <div class="side-brand"><img class="brand-sticker" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyNCIgZmlsbD0iIzI1MzI0NiIvPgo8Y2lyY2xlIGN4PSI1MCIgY3k9IjM3IiByPSIxNyIgZmlsbD0iI2Y1OWUwYiIvPgo8cGF0aCBkPSJNMjAgODVjNC0yMCAxNi0zMCAzMC0zMHMyNiAxMCAzMCAzMCIgZmlsbD0iI2Y1OWUwYiIvPgo8L3N2Zz4=" alt=""><span>Проект</span></div>
          <div style="display:flex;gap:8px">
            <button id="mobileTheme" class="btn ghost">${theme==="dark"?"☀":"☾"}</button>
            <button id="mobileLogout" class="btn ghost">Выйти</button>
          </div>
        </header>
        <main class="main">${content}<footer class="footer">© 2026 Проект. Все права защищены.</footer></main>
      </section>
    </div>`;
    const toggleTheme=()=>{
      const cur=document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light";
      const next=cur==="dark"?"light":"dark";
      localStorage.setItem("project_theme",next);
      document.documentElement.setAttribute("data-theme",next);
      render();
    };
    document.getElementById("themeBtn").onclick=toggleTheme;
    document.getElementById("mobileTheme").onclick=toggleTheme;
    document.getElementById("logoutBtn").onclick=logout;
    document.getElementById("mobileLogout").onclick=logout;
  }
  function roleName(r){ return r==="admin"?"Администратор":r==="manager"?"Менеджер":"Наблюдатель"; }

  function nav(active, me){
    const tabs = me.role==="admin"
      ? [["dashboard","Обзор"],["managers","Менеджеры"],["allclients","Все проекты"],["users","Пользователи"]]
      : [["clients","Мои проекты"]];
    return `<div class="tabs">${tabs.map(([id,t])=>`<button class="tab ${active===id?"active":""}" data-nav="${id}">${t}</button>`).join("")}</div>`;
  }

  function wireNav(){
    document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>route(b.dataset.nav));
  }

  function projectCard(c, me){
    const manager = db.users.find(u=>u.id===c.managerId);
    const stage = c.stages[c.stageIndex] || "—";
    return `<div class="card client-card" data-project="${c.id}" style="cursor:pointer">
      <div class="client-head">
        <div><div class="client-title">Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</div>
        <div class="meta"><span>В общении: ${daysBetween(c.startDate)} дн.</span><span>Менеджер: ${esc(manager?.name||"—")}</span><span>${c.gender==="male"?"Мужчина":c.gender==="female"?"Женщина":"Пол не указан"}</span></div></div>
        <span class="pill orange">${esc(stage)}</span>
      </div>
      ${pipeline(c,false)}
      ${me.role==="admin"?`<div class="card-actions-inline"><button class="btn ghost" data-dialog-export="${c.id}">Последняя выгрузка диалога</button></div>`:""}
    </div>`;
  }

  function managerView(){
    const me = db.users.find(u=>u.id===session.userId);
    const clients = db.clients.filter(c=>c.managerId===me.id && !c.deleted);
    shell(`${nav("clients",me)}
      <div class="section-head"><div><h1>Мои проекты</h1><p class="muted">Всего проектов: ${clients.length}</p></div>
      ${me.role==="manager"?'<button id="addClient" class="btn primary">+ Добавить проект</button>':""}</div>
      <div class="toolbar"><input id="q" placeholder="Поиск по имени или номеру"><select id="stageFilter"><option value="">Все стадии</option>${db.defaultStages.map((s,i)=>`<option value="${i}">${esc(s)}</option>`).join("")}</select></div>
      <div id="clientList" class="list">${clients.length?clients.map(c=>projectCard(c,me)).join(""):'<div class="empty">Проектов пока нет</div>'}</div>`);
    wireNav();
    if(me.role==="manager") document.getElementById("addClient").onclick=()=>openClientEditor(null);
    wireProjectCards();
    const q=document.getElementById("q"), sf=document.getElementById("stageFilter");
    const filt=()=> {
      const term=q.value.toLowerCase().trim(), st=sf.value;
      const f=clients.filter(c=>(!term || c.name.toLowerCase().includes(term)||String(c.number).includes(term)) && (st===""||String(c.stageIndex)===st));
      document.getElementById("clientList").innerHTML=f.length?f.map(c=>projectCard(c,me)).join(""):'<div class="empty">Ничего не найдено</div>';
      wireProjectCards();
    };
    q.oninput=filt; sf.onchange=filt;
  }

  function adminDashboard(){
    const me = db.users.find(u=>u.id===session.userId);
    const managers=db.users.filter(u=>u.role==="manager");
    const liveProjects=db.clients.filter(c=>!c.deleted); const active=liveProjects.filter(c=>c.stageIndex<c.stages.length-1).length;
    shell(`${nav("dashboard",me)}
      <div class="section-head"><div><h1>Обзор</h1><p class="muted">Общая картина по команде</p></div></div>
      <div class="stats">
        <div class="stat"><span class="muted">Менеджеры</span><b>${managers.length}</b></div>
        <div class="stat"><span class="muted">Все проекты</span><b>${liveProjects.length}</b></div>
        <div class="stat"><span class="muted">В работе</span><b>${active}</b></div>
        <div class="stat"><span class="muted">Завершено</span><b>${liveProjects.length-active}</b></div>
      </div>
      <div class="card"><h2 style="margin-top:0">Стадии воронки</h2>
        <div class="stage-editor" id="stageEditor">${db.defaultStages.map((s,i)=>`<span class="stage-chip">${i+1}. ${esc(s)}</span>`).join("")}</div>
        <div class="small muted" style="margin-top:10px">Менеджер может задать свои стадии отдельно внутри карточки проекта.</div>
      </div>
      <div class="card" style="margin-top:16px">
        <h2 style="margin-top:0">Список блоков</h2>
        <p class="muted">Эти варианты появляются в раскрывающемся поле «Блок» внутри проекта.</p>
        <div class="stage-editor" id="blockList">
          ${(db.blockOptions||[]).map((s,i)=>`<span class="stage-chip">${esc(s)} <button data-remove-block="${i}" title="Удалить">×</button></span>`).join("")}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <input id="newBlockName" placeholder="Название нового блока" style="max-width:320px">
          <button class="btn primary" id="addBlockOption">+ Добавить блок</button>
        </div>
      </div>`);
    wireNav();
    const addBlockBtn=document.getElementById("addBlockOption");
    if(addBlockBtn){
      addBlockBtn.onclick=()=>{
        const inp=document.getElementById("newBlockName");
        const name=(inp.value||"").trim();
        if(!name)return;
        db.blockOptions=db.blockOptions||[];
        if(db.blockOptions.includes(name)){ alert("Такой блок уже есть"); return; }
        db.blockOptions.push(name);
        syncRemote(false);
        adminDashboard();
      };
      document.querySelectorAll("[data-remove-block]").forEach(btn=>btn.onclick=()=>{
        const idx=Number(btn.dataset.removeBlock);
        const name=db.blockOptions?.[idx];
        if(!name)return;
        if(!confirm(`Удалить блок «${name}» из списка?`))return;
        db.blockOptions.splice(idx,1);
        syncRemote(false);
        adminDashboard();
      });
    }
  }

  function adminManagers(){
    const me=db.users.find(u=>u.id===session.userId);
    const managers=db.users.filter(u=>u.role==="manager");
    shell(`${nav("managers",me)}
      <div class="section-head"><div><h1>Менеджеры</h1><p class="muted">Нажмите на менеджера, чтобы увидеть его проектов</p></div></div>
      <div class="grid">${managers.map(m=>{
        const cc=db.clients.filter(c=>c.managerId===m.id && !c.deleted);
        return `<div class="card manager-card" data-manager="${m.id}" style="cursor:pointer"><div class="manager-profile"><div class="avatar manager-avatar">${m.avatar?`<img src="${m.avatar}" alt="">`:esc((m.name||"М").charAt(0).toUpperCase())}</div><div><div class="manager-name">${esc(m.name)}</div><div class="muted">${cc.length} проектов</div></div></div><button class="btn">Открыть</button></div>`;
      }).join("")||'<div class="empty">Менеджеров нет</div>'}</div>`);
    wireNav();
    document.querySelectorAll("[data-manager]").forEach(el=>el.onclick=()=>adminManagerClients(el.dataset.manager));
  }

  function adminManagerClients(mid){
    const me=db.users.find(u=>u.id===session.userId), m=db.users.find(u=>u.id===mid);
    const clients=db.clients.filter(c=>c.managerId===mid && !c.deleted);
    shell(`${nav("managers",me)}
      <div class="section-head"><div><button class="btn ghost" id="backManagers">← Назад</button><h1 style="margin-top:12px">${esc(m?.name||"Менеджер")}</h1><p class="muted">${clients.length} проектов</p></div></div>
      <div class="list">${clients.length?clients.map(c=>projectCard(c,me)).join(""):'<div class="empty">Проектов нет</div>'}</div>`);
    wireNav(); document.getElementById("backManagers").onclick=()=>route("managers"); wireProjectCards();
  }

  function adminAllClients(){
    const me=db.users.find(u=>u.id===session.userId);
    shell(`${nav("allclients",me)}
      <div class="section-head"><div><h1>Все проекты</h1><p class="muted">${db.clients.filter(c=>!c.deleted).length} записей</p></div></div>
      <div class="toolbar"><input id="q" placeholder="Поиск"><select id="mgrFilter"><option value="">Все менеджеры</option>${db.users.filter(u=>u.role==="manager").map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></div>
      <div id="clientList" class="list">${db.clients.filter(c=>!c.deleted).map(c=>projectCard(c,me)).join("")||'<div class="empty">Проектов нет</div>'}</div>`);
    wireNav(); wireProjectCards();
    const q=document.getElementById("q"), mf=document.getElementById("mgrFilter");
    const filt=()=>{const t=q.value.toLowerCase().trim(),mid=mf.value;const f=db.clients.filter(c=>!c.deleted&&(!t||c.name.toLowerCase().includes(t)||String(c.number).includes(t))&&(!mid||c.managerId===mid));document.getElementById("clientList").innerHTML=f.map(c=>projectCard(c,me)).join("")||'<div class="empty">Ничего не найдено</div>';wireProjectCards();};
    q.oninput=filt;mf.onchange=filt;
  }


  function trashView(){
    const me=db.users.find(u=>u.id===session.userId);
    const deleted=db.clients.filter(c=>c.deleted && (me.role==="admin"||me.role==="viewer"||c.managerId===me.id));
    shell(`${nav("trash",me)}
      <div class="section-head"><div><h1>Корзина</h1><p class="muted">Удалённые проекты доступны только для просмотра</p></div></div>
      <div class="list">${deleted.length?deleted.map(c=>projectCard(c,me)).join(""):'<div class="empty">Корзина пуста</div>'}</div>`);
    wireNav();
    wireProjectCards();
  }

  function usersView(){
    const me=db.users.find(u=>u.id===session.userId);
    shell(`${nav("users",me)}
      <div class="section-head"><div><h1>Пользователи</h1><p class="muted">Регистрация отключена — аккаунты создаёт администратор</p></div><button id="addUser" class="btn primary">+ Добавить пользователя</button></div>
      <div class="table-wrap card"><table class="table"><thead><tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Статус</th><th></th></tr></thead><tbody>
      ${db.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.login)}</td><td>${roleName(u.role)}</td><td>${u.active?'<span class="pill green">Активен</span>':'<span class="pill gray">Заблокирован</span>'}</td><td><button class="btn" data-edit-user="${u.id}">Редактировать</button></td></tr>`).join("")}
      </tbody></table></div>`);
    wireNav();
    document.getElementById("addUser").onclick=()=>openUserEditor(null);
    document.querySelectorAll("[data-edit-user]").forEach(b=>b.onclick=()=>openUserEditor(b.dataset.editUser));
  }

  function openUserEditor(id){
    const u=id?db.users.find(x=>x.id===id):null;
    const modal=document.createElement("div");modal.className="modal";
    modal.innerHTML=`<div class="modal-card"><div class="modal-head"><div><h2>${u?"Редактировать":"Новый"} пользователь</h2><div class="muted small">Только администратор может создавать аккаунты</div></div><button class="icon-btn" data-close>×</button></div>
      <form id="userForm" class="form-grid">
        <div class="field"><label>Имя</label><input name="name" required value="${esc(u?.name||"")}"></div>
        <div class="field"><label>Логин</label><input name="login" required value="${esc(u?.login||"")}"></div>
        <div class="field"><label>Пароль</label><input type="password" name="password" ${u?"":"required"} placeholder="${u?"Оставьте пустым, чтобы не менять":"Введите пароль"}"></div>
        <div class="field"><label>Роль</label><select name="role"><option value="manager" ${u?.role==="manager"?"selected":""}>Менеджер</option><option value="viewer" ${u?.role==="viewer"?"selected":""}>Наблюдатель</option><option value="admin" ${u?.role==="admin"?"selected":""}>Администратор</option></select></div>
        <div class="field full">
          <label>Аватар менеджера</label>
          <div class="avatar-editor">
            <div class="avatar avatar-preview" id="avatarPreview">${u?.avatar?`<img src="${u.avatar}" alt="">`:esc((u?.name||"М").charAt(0).toUpperCase())}</div>
            <div class="avatar-controls">
              <input type="file" id="avatarFile" accept="image/*">
              <div class="small muted" style="margin-top:6px">Выбери фотографию менеджера. До 2 МБ.</div>
              ${u?.avatar?'<button type="button" class="btn ghost" id="removeAvatar" style="margin-top:8px">Удалить аватар</button>':""}
            </div>
          </div>
        </div>
        <div class="field"><label>Статус</label><select name="active"><option value="1" ${u?.active!==false?"selected":""}>Активен</option><option value="0" ${u?.active===false?"selected":""}>Заблокирован</option></select></div>
        <div class="actions field full"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>
      </form></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());
    
    const avatarFile=modal.querySelector("#avatarFile");
    const avatarPreview=modal.querySelector("#avatarPreview");
    modal.dataset.avatarData=u?.avatar||"";
    if(avatarFile){
      avatarFile.onchange=()=>{
        const file=avatarFile.files?.[0];
        if(!file)return;
        if(file.size>2*1024*1024){
          alert("Фотография должна быть не больше 2 МБ");
          avatarFile.value="";
          return;
        }
        const reader=new FileReader();
        reader.onload=()=>{
          modal.dataset.avatarData=String(reader.result);
          if(avatarPreview) avatarPreview.innerHTML=`<img src="${reader.result}" alt="">`;
        };
        reader.readAsDataURL(file);
      };
    }
    const removeAvatar=modal.querySelector("#removeAvatar");
    if(removeAvatar){
      removeAvatar.onclick=()=>{
        modal.dataset.avatarData="";
        if(avatarPreview) avatarPreview.textContent=(u?.name||"М").charAt(0).toUpperCase();
        removeAvatar.remove();
      };
    }
    modal.querySelector("#userForm").onsubmit=e=>{
      e.preventDefault();const fd=new FormData(e.target);
      const cleanName=String(fd.get("name")||"").trim();
      const cleanLogin=String(fd.get("login")||"").trim().toLowerCase();
      const cleanPassword=String(fd.get("password")||"");
      if(!cleanName || !cleanLogin || (!u && !cleanPassword)){alert("Заполните имя, логин и пароль");return}
      if(db.users.some(x=>String(x.login||"").trim().toLowerCase()===cleanLogin&&x.id!==id)){alert("Такой логин уже существует");return}
      const data={id:u?.id||uid("u_"),name:cleanName,login:cleanLogin,password:cleanPassword,role:fd.get("role"),nick:fd.get("nick"),avatar:modal.dataset.avatarData||"",active:fd.get("active")==="1"};
      if(u) Object.assign(u,data); else db.users.push(data);
      syncRemote(false);
      alert(data.password?`Пользователь сохранён.\nЛогин: ${data.login}\nПароль: ${data.password}`:`Пользователь сохранён.\nЛогин: ${data.login}\nПароль не изменён.`);
      modal.remove();route("users");
    };
  }

  function wireProjectCards(){
    document.querySelectorAll("[data-project]").forEach(el=>el.onclick=(e)=>{
      if(e.target.closest("[data-dialog-export]")) return;
      openClient(el.dataset.project);
    });
    document.querySelectorAll("[data-dialog-export]").forEach(btn=>btn.onclick=(e)=>{
      e.stopPropagation();
      openDialogExport(btn.dataset.dialogExport);
    });
  }

  function openDialogExport(id){
    const c=db.clients.find(x=>x.id===id);
    const me=db.users.find(u=>u.id===session.userId);
    if(!c || !me) return;
    if(me.role!=="admin" && me.role!=="viewer"){ alert("Нет доступа"); return; }

    c.dialogExport = c.dialogExport || {updatedAt:"",summary:"",details:""};
    const canEdit = me.role==="viewer" && !c.deleted;
    const modal=document.createElement("div");
    modal.className="modal";
    modal.innerHTML=`<div class="modal-card">
      <div class="modal-head">
        <div>
          <h2>Последняя выгрузка диалога</h2>
          <div class="muted">Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</div>
        </div>
        <button class="icon-btn" data-close>×</button>
      </div>

      ${c.deleted?'<div class="notice">Проект находится в корзине. Выгрузка доступна только для просмотра.</div>':""}

      <div class="card export-date-card">
        <b>Последнее обновление</b>
        <div>${c.dialogExport.updatedAt ? new Date(c.dialogExport.updatedAt).toLocaleString("ru-RU") : "Выгрузка ещё не добавлена"}</div>
      </div>

      <div class="field" style="margin-top:14px">
        <label>Краткая информация о выгрузке</label>
        <textarea id="exportSummary" ${canEdit?"":"readonly"} placeholder="Кратко: что было в последнем диалоге, результат, договорённости">${esc(c.dialogExport.summary||"")}</textarea>
      </div>

      <div class="field" style="margin-top:14px">
        <label>Последняя выгрузка диалога</label>
        <textarea id="exportDetails" ${canEdit?"":"readonly"} class="export-text" placeholder="Вставьте сюда текст или информацию из последней выгрузки диалога">${esc(c.dialogExport.details||"")}</textarea>
      </div>

      <div class="actions">
        ${canEdit?'<button class="btn primary" id="saveDialogExport">Сохранить выгрузку</button>':""}
        <button class="btn ghost" data-close>Закрыть</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());
    if(canEdit){
      document.getElementById("saveDialogExport").onclick=()=>{
        c.dialogExport.summary=document.getElementById("exportSummary").value.trim();
        c.dialogExport.details=document.getElementById("exportDetails").value.trim();
        c.dialogExport.updatedAt=nowISO();
        c.history=c.history||[];
        c.history.push({ts:nowISO(),text:"Наблюдатель обновил последнюю выгрузку диалога"});
        syncRemote(false);
        modal.remove(); render();
      };
    }
  }

  function openClient(id){
    const c=db.clients.find(x=>x.id===id), me=db.users.find(u=>u.id===session.userId);
    if(!c)return;
    if(me.role!=="admin" && me.role!=="viewer" && c.managerId!==me.id){alert("Нет доступа");return}
    const manager=db.users.find(u=>u.id===c.managerId);
    const canEdit=!c.deleted && (me.role==="admin"||me.role==="manager"); const canBlockComment=!c.deleted && (me.role==="admin"||me.role==="manager"||me.role==="viewer");
    const modal=document.createElement("div");modal.className="modal";
    modal.innerHTML=`<div class="modal-card"><div class="modal-head"><div><h2>Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</h2><div class="muted">Менеджер: ${esc(manager?.name||"—")} · В общении ${daysBetween(c.startDate)} дн.</div></div><button class="icon-btn" data-close>×</button></div>
      ${pipeline(c,canEdit)}
      <div class="grid" style="margin-top:16px">
        <div class="card" style="box-shadow:none;border:1px solid #e5e7eb"><b>Ник</b><div>${esc(c.nick||"—")}</div></div><div class="card" style="box-shadow:none;border:1px solid #e5e7eb"><b>Пол</b><div>${c.gender==="male"?"Мужчина":c.gender==="female"?"Женщина":"—"}</div></div>
        <div class="card" style="box-shadow:none;border:1px solid #e5e7eb"></div>
        
      </div>
      
      <div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:14px">
        <b>Что уже обсуждали</b>
        <div style="white-space:pre-wrap;margin-top:5px">${esc(c.discussion||"—")}</div>
      </div>
      <div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:12px">
        <b>Заметки менеджера</b>
        <div style="white-space:pre-wrap;margin-top:5px">${esc(c.notes||"—")}</div>
      </div>

      <div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:14px">
        <div class="multi-block-header">
          <div>
            <h3 style="margin:0">Блоки и реакции</h3>
            <div class="muted small">Здесь сохраняются все ранее выбранные блоки, реакция и комментарии по каждому блоку.</div>
          </div>
        </div>

        <div id="savedBlocksList" class="saved-blocks-list"></div>

        ${canBlockComment?`
        <div class="block-entry-editor">
          <div class="field">
            <label>Блок</label>
            <select id="multiBlockSelect">
              <option value="">Выберите блок</option>
              ${(db.blockOptions||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Реакция на блок</label>
            <select id="multiReactionSelect">
              <option value="">Не выбрана</option>
              <option value="Положительная">Положительная</option>
              <option value="Нейтральная">Нейтральная</option>
              <option value="Сомнение">Сомнение</option>
              <option value="Негативная">Негативная</option>
              <option value="Нужно вернуться позже">Нужно вернуться позже</option>
            </select>
          </div>
          <div class="field full">
            <label>Комментарий по выбранному блоку</label>
            <textarea id="multiBlockComment" placeholder="Например: клиент положительно отреагировал, задал вопросы..."></textarea>
          </div>
          <div class="actions field full" style="margin-top:0">
            <button class="btn primary" type="button" id="saveMultiBlock">Сохранить блок</button>
          </div>
        </div>
        `:""}
      </div>

      <h3>История</h3><div class="timeline">${(c.history||[]).slice().sort((a,b)=>b.ts.localeCompare(a.ts)).map(h=>`<div class="timeline-item"><b>${new Date(h.ts).toLocaleString("ru-RU")}</b><span>${esc(h.text)}</span></div>`).join("")||'<div class="muted">Истории пока нет</div>'}</div>
      <div class="actions">${c.deleted?'<span class="pill gray">Проект в корзине — редактирование недоступно</span>':""}${me.role==="admin"?'<button class="btn ghost" id="viewDialogExport">Последняя выгрузка</button>':""}${me.role==="viewer"&&!c.deleted?'<button class="btn ghost" id="editDialogExport">Добавить / обновить выгрузку</button>':""}${canEdit?`<button class="btn danger" id="deleteProject">Удалить проект</button><button class="btn primary" id="editClient">Редактировать</button>`:""}<button class="btn ghost" data-close>Закрыть</button></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());
    if(canEdit){
      modal.querySelectorAll("[data-stage]").forEach(el=>el.onclick=()=>{
        const newIdx=Number(el.dataset.stage); const old=c.stageIndex;
        if(newIdx===old)return;
        c.stageIndex=newIdx;c.history=c.history||[];c.history.push({ts:nowISO(),text:`Стадия изменена: «${c.stages[old]}» → «${c.stages[newIdx]}»`});
        db.audit.push({ts:nowISO(),userId:me.id,text:`Изменена стадия проекта ${c.name}`});
        syncRemote(false);modal.remove();render();openClient(id);
      });
      document.getElementById("editClient").onclick=()=>{modal.remove();openClientEditor(id)};
      const delBtn=document.getElementById("deleteProject");
      if(delBtn) delBtn.onclick=()=>{
        if(!confirm("Переместить проект в корзину? После этого его нельзя будет редактировать.")) return;
        c.deleted=true;c.deletedAt=nowISO();c.history=c.history||[];c.history.push({ts:nowISO(),text:"Проект перемещён в корзину"});
        syncRemote(false);modal.remove();render();
      };
    }

    c.blockRecords = Array.isArray(c.blockRecords) ? c.blockRecords : [];

    const savedBlocksList=document.getElementById("savedBlocksList");
    const multiBlockSelect=document.getElementById("multiBlockSelect");
    const multiReactionSelect=document.getElementById("multiReactionSelect");
    const multiBlockComment=document.getElementById("multiBlockComment");
    const saveMultiBlock=document.getElementById("saveMultiBlock");

    const renderSavedBlocks=()=>{
      if(!savedBlocksList) return;
      if(!c.blockRecords.length){
        savedBlocksList.innerHTML='<div class="muted">Сохранённых блоков пока нет.</div>';
        return;
      }
      savedBlocksList.innerHTML=c.blockRecords.map((rec,idx)=>{
        const comments=(rec.comments||[]).slice().sort((a,b)=>b.ts.localeCompare(a.ts));
        return `<div class="saved-block-row">
          <div class="saved-block-top">
            <div><b>${esc(rec.block)}</b><span class="reaction-badge">${esc(rec.reaction||"Реакция не указана")}</span></div>
            ${canBlockComment?`<div class="saved-block-actions">
              <button class="btn ghost small-btn" data-edit-saved-block="${idx}">Выбрать</button>
              <button class="btn danger small-btn" data-delete-saved-block="${idx}">Удалить блок</button>
            </div>`:""}
          </div>
          <div class="saved-block-comments">
            ${comments.length?comments.map(x=>`<div class="saved-comment"><div class="saved-comment-meta">${esc(x.authorName||"Пользователь")} · ${new Date(x.ts).toLocaleString("ru-RU")}</div><div>${esc(x.text)}</div></div>`).join(""):'<div class="muted small">Комментариев по этому блоку нет.</div>'}
          </div>
        </div>`;
      }).join("");

      document.querySelectorAll("[data-edit-saved-block]").forEach(btn=>btn.onclick=()=>{
        const rec=c.blockRecords[Number(btn.dataset.editSavedBlock)];
        if(!rec || !multiBlockSelect || !multiReactionSelect) return;
        multiBlockSelect.value=rec.block;
        multiReactionSelect.value=rec.reaction||"";
        if(multiBlockComment) multiBlockComment.value="";
      });

      document.querySelectorAll("[data-delete-saved-block]").forEach(btn=>btn.onclick=()=>{
        const idx=Number(btn.dataset.deleteSavedBlock);
        const rec=c.blockRecords[idx];
        if(!rec) return;
        if(!confirm(`Удалить «${rec.block}» вместе с реакцией и всеми комментариями этого блока?`)) return;

        c.blockRecords.splice(idx,1);

        c.history=c.history||[];
        c.history.push({
          ts:nowISO(),
          text:`Удалён «${rec.block}» вместе с реакцией и комментариями`
        });

        syncRemote(false);

        if(multiBlockSelect && multiBlockSelect.value===rec.block){
          multiBlockSelect.value="";
          multiReactionSelect.value="";
          if(multiBlockComment) multiBlockComment.value="";
        }

        renderSavedBlocks();
      });
    };

    if(saveMultiBlock){
      saveMultiBlock.onclick=()=>{
        const block=(multiBlockSelect?.value||"").trim();
        const reaction=(multiReactionSelect?.value||"").trim();
        const comment=(multiBlockComment?.value||"").trim();

        if(!block){ alert("Выберите блок"); return; }
        if(!reaction){ alert("Выберите реакцию на блок"); return; }

        let rec=c.blockRecords.find(x=>x.block===block);
        if(!rec){
          rec={block,reaction,comments:[]};
          c.blockRecords.push(rec);
        }else{
          rec.reaction=reaction;
          rec.comments=Array.isArray(rec.comments)?rec.comments:[];
        }

        if(comment){
          rec.comments.push({
            ts:nowISO(),
            text:comment,
            authorId:me.id,
            authorName:me.name
          });
        }

        c.history=c.history||[];
        c.history.push({
          ts:nowISO(),
          text:`Сохранён «${block}»: реакция — ${reaction}${comment?" + комментарий":""}`
        });

        syncRemote(false);
        if(multiBlockComment) multiBlockComment.value="";
        renderSavedBlocks();
      };
    }

    renderSavedBlocks();

    const viewExportBtn=document.getElementById("viewDialogExport");
    if(viewExportBtn) viewExportBtn.onclick=()=>{modal.remove();openDialogExport(id);};
    const editExportBtn=document.getElementById("editDialogExport");
    if(editExportBtn) editExportBtn.onclick=()=>{modal.remove();openDialogExport(id);};

  }

  function openClientEditor(id){
    if(id){ const existing=db.clients.find(x=>x.id===id); if(existing?.deleted){alert("Удалённые проекты нельзя редактировать");return;} }
    const me=db.users.find(u=>u.id===session.userId), c=id?db.clients.find(x=>x.id===id):null;
    const stages=(c?.stages||db.defaultStages).slice();
    const modal=document.createElement("div");modal.className="modal";
    modal.innerHTML=`<div class="modal-card"><div class="modal-head"><div><h2>${c?"Редактировать проект":"Новый проект"}</h2><div class="muted small">Все поля можно изменить позже</div></div><button class="icon-btn" data-close>×</button></div>
      <form id="clientForm" class="form-grid">
        <div class="field"><label>Имя</label><input name="name" required value="${esc(c?.name||"")}"></div>
        <div class="field"><label>Ник</label><input name="nick" value="${esc(c?.nick||"")}" placeholder="Введите ник"></div>
        <div class="field"><label>Возраст</label><input name="age" value="${esc(c?.age||"")}"></div><div class="field"><label>Пол</label><select name="gender">
          <option value="">Не указан</option>
          <option value="male" ${c?.gender==="male"?"selected":""}>Мужчина</option>
          <option value="female" ${c?.gender==="female"?"selected":""}>Женщина</option>
        </select></div>
        <div class="field"><label>Дата начала общения</label><input type="date" name="startDate" required value="${esc(c?.startDate||new Date().toISOString().slice(0,10))}"></div>
        <div class="field"><label>Профессия</label><input name="profession" value="${esc(c?.profession||"")}"></div>
        <div class="field full"><label>Интересы</label><input name="interests" value="${esc(c?.interests||"")}"></div>
        <div class="field full"><label>Что уже обсуждали</label>
          <textarea name="discussion" placeholder="Например: познакомились, обсудили цели">${esc(c?.discussion||"")}</textarea>
        </div>
        <div class="field full"><label>Заметки менеджера</label>
          <textarea name="notes" placeholder="Например: перезвонить после выходных">${esc(c?.notes||"")}</textarea>
        </div>
        <div class="field full"><label>Стадии проекта (через запятую)</label><input name="stages" value="${esc(stages.join(", "))}"><div class="small muted">Например: Начальная, Развитие, Слияние, Залив. инф, Пред. предлог, 72 часа</div></div>
        ${me.role==="admin"?`<div class="field full"><label>Менеджер</label><select name="managerId">${db.users.filter(u=>u.role==="manager").map(u=>`<option value="${u.id}" ${(c?.managerId||"")===u.id?"selected":""}>${esc(u.name)}</option>`).join("")}</select></div>`:""}
        <div class="actions field full"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>
      </form></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());
    modal.querySelector("#clientForm").onsubmit=e=>{
      e.preventDefault();const fd=new FormData(e.target);
      const newStages=String(fd.get("stages")||"").split(",").map(x=>x.trim()).filter(Boolean);
      if(newStages.length<2){alert("Укажите минимум 2 стадии");return}
      if(c){
        Object.assign(c,{name:fd.get("name"),nick:fd.get("nick"),age:fd.get("age"),gender:fd.get("gender"),startDate:fd.get("startDate"),profession:fd.get("profession"),discussion:fd.get("discussion"),notes:fd.get("notes"),interests:fd.get("interests"),stages:newStages,managerId:me.role==="admin"?fd.get("managerId"):c.managerId});
        c.stageIndex=Math.min(c.stageIndex,newStages.length-1);c.blockRecords=Array.isArray(c.blockRecords)?c.blockRecords:[];c.history=c.history||[];c.history.push({ts:nowISO(),text:"Карточка проекта отредактирована"});
      }else{
        const nextNum=Math.max(0,...db.clients.map(x=>x.number||0))+1;
        db.clients.push({id:uid("c_"),number:nextNum,name:fd.get("name"),nick:fd.get("nick"),age:fd.get("age"),gender:fd.get("gender"),managerId:me.role==="admin"?fd.get("managerId"):me.id,profession:fd.get("profession"),interests:fd.get("interests"),startDate:fd.get("startDate"),stageIndex:0,stages:newStages,deleted:false,blockRecords:[],history:[{ts:nowISO(),text:"Создан проект"}]});
      }
      syncRemote(false);modal.remove();render();
    };
  }

  let currentRoute=null;
  function route(r){
    currentRoute=r;
    const me=db.users.find(u=>u.id===session.userId);
    if(!me)return loginView();
    if(r==="trash") return trashView();
    if(me.role==="admin" || me.role==="viewer"){
      if(r==="managers")return adminManagers();
      if(r==="allclients")return adminAllClients();
      if(r==="users" && me.role==="admin")return usersView();
      return adminDashboard();
    }
    return managerView();
  }
  function render(){
    if(!session)return loginView();
    const me=db.users.find(u=>u.id===session.userId);
    if(!me||!me.active){logout();return}
    route(currentRoute || ((me.role==="admin"||me.role==="viewer")?"dashboard":"clients"));
  }
  async function bootstrap(){
    if(session?.token){
      const ok=await fetchState();
      if(!ok){
        try{
          const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
          if(cached) db=cached;
        }catch(e){}
      }
    }
    render();
  }
  bootstrap();
})();