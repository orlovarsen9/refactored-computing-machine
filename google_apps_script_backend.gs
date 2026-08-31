/**
 * PROJECT CRM - Google Apps Script backend
 *
 * ВАЖНО:
 * 1. Откройте Google Таблицу -> Расширения -> Apps Script.
 * 2. Полностью замените старый код этим файлом.
 * 3. Deploy -> Manage deployments -> Edit -> New version -> Deploy.
 * 4. Execute as: Me. Access: Anyone.
 *
 * После этого GitHub Pages frontend сможет работать с общей базой на всех устройствах.
 */

const DATA_SHEET = "CRM_DATA";
const PROJECTS_SHEET = "Проекты";
const BLOCKS_SHEET = "Блоки";
const COMMENTS_SHEET = "Комментарии";
const USERS_SHEET = "Пользователи";
const CHUNK_SIZE = 40000;
const SESSION_HOURS = 168; // 7 дней

function doGet() {
  return jsonOut({ok:true, service:"Project CRM", time:new Date().toISOString()});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");

    if (action === "login") return handleLogin(body);
    if (action === "getState") return handleGetState(body);
    if (action === "saveState") return handleSaveState(body);
    if (action === "logout") return handleLogout(body);

    return jsonOut({ok:false,error:"Неизвестное действие"});
  } catch (err) {
    return jsonOut({ok:false,error:String(err && err.message || err)});
  }
}

function defaultState() {
  return {
    users: [
      {
        id:"u_admin",
        name:"Главный администратор",
        login:"admin",
        passwordHash:hashPassword("admin123"),
        role:"admin",
        nick:"",
        avatar:"",
        active:true
      },
      {
        id:"u_mgr1",
        name:"Александр",
        login:"manager1",
        passwordHash:hashPassword("manager123"),
        role:"manager",
        nick:"",
        avatar:"",
        active:true
      },
      {
        id:"u_view",
        name:"Наблюдатель",
        login:"viewer",
        passwordHash:hashPassword("viewer123"),
        role:"viewer",
        nick:"",
        avatar:"",
        active:true
      }
    ],
    defaultStages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],
    blockOptions:["Блок 1","Блок 2","Блок 3","Блок 4","Блок 5"],
    clients:[],
    audit:[]
  };
}

function handleLogin(body) {
  const state = loadState();
  const login = String(body.login || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!state || !Array.isArray(state.users)) {
    return jsonOut({ok:false,error:"Лист CRM_DATA повреждён или база пользователей не создана"});
  }

  const user = (state.users || []).find(function(u){
    return String(u.login || "").trim().toLowerCase() === login && u.active !== false;
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonOut({ok:false,error:"Неверный логин или пароль."});
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  saveSession(token, user.id);

  return jsonOut({
    ok:true,
    token:token,
    user:sanitizeUser(user),
    state:sanitizeState(state)
  });
}

function handleGetState(body) {
  const state = loadState();
  const user = requireUser(body.token, state);
  if (!user) return jsonOut({ok:false,error:"Сессия истекла. Войдите снова."});
  return jsonOut({ok:true,state:sanitizeState(state)});
}

function handleSaveState(body) {
  const current = loadState();
  const user = requireUser(body.token, current);
  if (!user) return jsonOut({ok:false,error:"Сессия истекла. Войдите снова."});

  const incoming = body.state || {};
  if (!Array.isArray(incoming.users) || !Array.isArray(incoming.clients)) {
    return jsonOut({ok:false,error:"Некорректные данные"});
  }

  let next = JSON.parse(JSON.stringify(current));

  if (user.role === "admin") {
    next.defaultStages = Array.isArray(incoming.defaultStages) ? incoming.defaultStages : current.defaultStages;
    next.blockOptions = Array.isArray(incoming.blockOptions) ? incoming.blockOptions : current.blockOptions;
    next.clients = incoming.clients;
    next.audit = Array.isArray(incoming.audit) ? incoming.audit : [];

    const existing = {};
    (current.users || []).forEach(function(u){ existing[u.id] = u; });

    next.users = incoming.users.map(function(u){
      const old = existing[u.id];
      const rawPassword = String(u.password || "");
      return {
        id:u.id || ("u_" + Utilities.getUuid()),
        name:String(u.name || "").trim(),
        login:String(u.login || "").trim().toLowerCase(),
        passwordHash: rawPassword ? hashPassword(rawPassword) : (old ? old.passwordHash : ""),
        role:["admin","manager","viewer"].indexOf(u.role) >= 0 ? u.role : "manager",
        nick:String(u.nick || ""),
        avatar:String(u.avatar || ""),
        active:u.active !== false
      };
    });

    const seen = {};
    for (var i=0;i<next.users.length;i++) {
      const lg = next.users[i].login;
      if (!lg) return jsonOut({ok:false,error:"У пользователя пустой логин"});
      if (seen[lg]) return jsonOut({ok:false,error:"Логин " + lg + " используется дважды"});
      seen[lg] = true;
      if (!next.users[i].passwordHash) return jsonOut({ok:false,error:"Для нового пользователя нужен пароль"});
    }
  } else if (user.role === "manager") {
    // Менеджер меняет только свои проекты. Пользователи и настройки защищены.
    const protectedClients = (current.clients || []).filter(function(c){ return c.managerId !== user.id; });
    const ownIncoming = (incoming.clients || []).filter(function(c){ return c.managerId === user.id; });
    next.clients = protectedClients.concat(ownIncoming);
  } else if (user.role === "viewer") {
    // Наблюдатель может работать с информацией проектов, но не управлять пользователями.
    next.clients = incoming.clients;
    next.audit = Array.isArray(incoming.audit) ? incoming.audit : current.audit;
  } else {
    return jsonOut({ok:false,error:"Нет прав"});
  }

  saveState(next);
  mirrorSheets(next);

  return jsonOut({ok:true,state:sanitizeState(next)});
}

function handleLogout(body) {
  if (body.token) {
    PropertiesService.getScriptProperties().deleteProperty("sess_" + body.token);
  }
  return jsonOut({ok:true});
}

function requireUser(token, state) {
  if (!token) return null;
  const raw = PropertiesService.getScriptProperties().getProperty("sess_" + token);
  if (!raw) return null;
  try {
    const sess = JSON.parse(raw);
    if (Date.now() > Number(sess.exp || 0)) {
      PropertiesService.getScriptProperties().deleteProperty("sess_" + token);
      return null;
    }
    return (state.users || []).find(function(u){ return u.id === sess.userId && u.active !== false; }) || null;
  } catch(e) {
    return null;
  }
}

function saveSession(token, userId) {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  PropertiesService.getScriptProperties().setProperty("sess_" + token, JSON.stringify({userId:userId,exp:exp}));
}

function getDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) sh = ss.insertSheet(DATA_SHEET);
  return sh;
}

function loadState() {
  const sh = getDataSheet();
  const last = sh.getLastRow();
  if (!last) {
    const state = defaultState();
    saveState(state);
    mirrorSheets(state);
    return state;
  }

  const values = sh.getRange(1,1,last,1).getValues();
  let text = "";
  values.forEach(function(r){ text += String(r[0] || ""); });

  if (!text) {
    const state = defaultState();
    saveState(state);
    mirrorSheets(state);
    return state;
  }

  try {
    return JSON.parse(text);
  } catch(e) {
    throw new Error("Не удалось прочитать общую базу CRM");
  }
}

function saveState(state) {
  const sh = getDataSheet();
  const text = JSON.stringify(state);
  const chunks = [];
  for (let i=0;i<text.length;i+=CHUNK_SIZE) chunks.push([text.slice(i,i+CHUNK_SIZE)]);
  sh.clearContents();
  if (chunks.length) sh.getRange(1,1,chunks.length,1).setValues(chunks);
  sh.hideSheet();
}

function mirrorSheets(state) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let projects = ss.getSheetByName(PROJECTS_SHEET);
  if (!projects) projects = ss.insertSheet(PROJECTS_SHEET);
  let blocks = ss.getSheetByName(BLOCKS_SHEET);
  if (!blocks) blocks = ss.insertSheet(BLOCKS_SHEET);
  let comments = ss.getSheetByName(COMMENTS_SHEET);
  if (!comments) comments = ss.insertSheet(COMMENTS_SHEET);
  let usersSheet = ss.getSheetByName(USERS_SHEET);
  if (!usersSheet) usersSheet = ss.insertSheet(USERS_SHEET);

  projects.clearContents();
  blocks.clearContents();
  comments.clearContents();
  usersSheet.clearContents();

  const pRows = [[
    "№","Имя","Ник","Пол","Профессия","Менеджер","Дата начала",
    "Стадия","Удалён","Что уже обсуждали","Заметки менеджера"
  ]];
  const bRows = [["№ проекта","Имя","Блок","Реакция"]];
  const cRows = [["№ проекта","Имя","Блок","Автор","Дата","Комментарий"]];
  const uRows = [["ID","Имя","Логин","Роль","Доступ","Ник"]];

  (state.users || []).forEach(function(u){
    uRows.push([
      u.id || "",
      u.name || "",
      u.login || "",
      u.role || "",
      u.active !== false ? "Разрешён" : "Запрещён",
      u.nick || ""
    ]);
  });

  const users = {};
  (state.users || []).forEach(function(u){ users[u.id] = u; });

  (state.clients || []).forEach(function(p){
    const manager = users[p.managerId];
    pRows.push([
      p.number || "",
      p.name || "",
      p.nick || "",
      p.gender || "",
      p.profession || "",
      manager ? manager.name : "",
      p.startDate || "",
      (p.stages || [])[p.stageIndex] || "",
      p.deleted ? "Да" : "Нет",
      p.discussion || "",
      p.notes || ""
    ]);

    (p.blockRecords || []).forEach(function(b){
      bRows.push([p.number || "",p.name || "",b.block || "",b.reaction || ""]);
      (b.comments || []).forEach(function(c){
        cRows.push([
          p.number || "",
          p.name || "",
          b.block || "",
          c.authorName || "",
          c.ts || "",
          c.text || ""
        ]);
      });
    });
  });

  projects.getRange(1,1,pRows.length,pRows[0].length).setValues(pRows);
  blocks.getRange(1,1,bRows.length,bRows[0].length).setValues(bRows);
  comments.getRange(1,1,cRows.length,cRows[0].length).setValues(cRows);
  usersSheet.getRange(1,1,uRows.length,uRows[0].length).setValues(uRows);
  projects.setFrozenRows(1);
  blocks.setFrozenRows(1);
  comments.setFrozenRows(1);
  usersSheet.setFrozenRows(1);
}

function sanitizeState(state) {
  const out = JSON.parse(JSON.stringify(state));
  out.users = (out.users || []).map(sanitizeUser);
  return out;
}

function sanitizeUser(u) {
  const out = JSON.parse(JSON.stringify(u));
  delete out.passwordHash;
  out.password = "";
  return out;
}

function hashPassword(password) {
  const salt = Utilities.getUuid().replace(/-/g,"");
  return salt + ":" + digest(salt + ":" + String(password));
}

function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(":") < 0) return false;
  const pos = stored.indexOf(":");
  const salt = stored.slice(0,pos);
  const expected = stored.slice(pos+1);
  return digest(salt + ":" + String(password)) === expected;
}

function digest(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function(b){
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
