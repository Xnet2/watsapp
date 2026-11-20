// ===== מסך ההגדרות =====
const connStatus = document.getElementById('connStatus');
const settingsIntro = document.getElementById('settingsIntro');
const advSettings = document.getElementById('advSettings');
const themeInput = document.getElementById('themeInput');
const notifyInput = document.getElementById('notifyInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const tzIncomingInput = document.getElementById('tzIncomingInput');

// הסרת מערכת מהמכשיר (לא נוגע בשום דבר בימות המשיח עצמה). מחזיר true אם הוסרה.
async function removeSystem(sys){
  const ok = await appConfirm(
    'פרטי החיבור של "' + systemLabel(sys) + '" יימחקו מהמכשיר הזה בלבד. שום דבר לא יימחק בימות המשיח עצמה.',
    { title: 'להסיר את המערכת?', okText: 'הסרה', danger: true }
  );
  if(!ok) return false;
  saveSystems(getSystems().filter(s => s.id !== sys.id));
  if(getActiveSystemId() === sys.id) setActiveSystemId(null);
  return true;
}

// בונה שורת מערכת קומפקטית לרשימת "המערכות שלי" במסך ההגדרות - לחיצה על השורה טוענת
// את אותה מערכת לשדות העריכה, וכפתור המחיקה הקטן מסיר אותה בלי לצאת מההגדרות.
function buildSettingsSystemRow(sys, activeId){
  const row = document.createElement('div');
  row.className = 'settings-sys-row' + (sys.id === activeId ? ' active' : '');
  row.innerHTML =
    '<span class="settings-sys-avatar">' + contactAvatarHTML({ name: systemLabel(sys) }) + '</span>' +
    '<span class="settings-sys-info"><b></b><span></span></span>' +
    '<button type="button" class="settings-sys-del" title="מחיקת מערכת זו" aria-label="מחיקת מערכת זו">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
    '</button>';
  row.querySelector('b').textContent = systemLabel(sys);
  row.querySelector('.settings-sys-info span').textContent =
    'שלוחה ' + (sys.invited ? '••' : (sys.ext || '1')) + (sys.invited ? ' · הצטרפות בקישור' : '');
  row.onclick = () => { setActiveSystemId(sys.id); openSettings(); };
  row.querySelector('.settings-sys-del').onclick = async (e) => {
    e.stopPropagation();
    if(await removeSystem(sys)){
      openSettings();
      refreshSidebar();
    }
  };
  return row;
}
function renderSettingsSystemsList(){
  const systems = getSystems();
  settingsSystemsSection.style.display = systems.length > 1 ? 'block' : 'none';
  settingsSystemsList.innerHTML = '';
  const activeId = getActiveSystemId();
  systems.forEach(sys => settingsSystemsList.appendChild(buildSettingsSystemRow(sys, activeId)));
}

function maskDisplay(){ return '••••••••••••'; }

// כשהבדיקה נכשלת, הלחיצה הבאה על "שמירה" שומרת בכל זאת (למשל כשאין רשת כרגע)
let forceSaveArmed = false;
function setConnStatus(kind, text){
  connStatus.hidden = !kind;
  connStatus.className = 'conn-status' + (kind ? ' ' + kind : '');
  connStatus.textContent = text || '';
}
function resetSaveButton(){
  forceSaveArmed = false;
  saveSettingsBtn.disabled = false;
  saveSettingsBtn.textContent = 'שמירה וטעינה';
}

function openSettings(){
  const sys = getActiveSystem();
  const invited = !!(sys && sys.invited);

  labelInput.value = (sys && sys.label) || '';

  [tokenInput, extInput, tzintukListInput, contactsApiInput].forEach(inp => {
    inp.readOnly = invited;
    inp.classList.toggle('masked-field', invited);
  });
  contactsSourceInput.disabled = invited;

  if(invited){
    tokenInput.value = maskDisplay();
    extInput.value = maskDisplay();
    tzintukListInput.value = sys.tzintukList ? maskDisplay() : '';
    contactsApiInput.value = sys.contactsApi ? maskDisplay() : '';
    contactsSourceInput.value = sys.contactsSource || 'sheetdb';
  } else {
    tokenInput.value = getToken();
    extInput.value = getExt();
    tzintukListInput.value = getTzintukList();
    contactsApiInput.value = getContactsApiUrl();
    contactsSourceInput.value = getContactsSource();
  }

  // מפתח ה-API לתמלול הוא גלובלי לדפדפן ולא חלק ממערכת ספציפית - נטען תמיד מאותו מקום,
  // גם במסך "עריכת מערכת" של קבוצה שהצטרפו אליה דרך הזמנה (invited), כי הוא לא חלק מהזמנה.
  speechApiKeyInput.value = getSpeechApiKey();
  tzIncomingInput.checked = getTzIncoming(sys);
  themeInput.value = getTheme();
  notifyInput.checked = getNotifyEnabled() && ('Notification' in window) && Notification.permission === 'granted';
  notifyInput.disabled = !('Notification' in window);

  // ההגדרות הנוספות נפתחות מראש רק אם כבר משהו מוגדר בהן
  advSettings.open = !!(sys && (sys.tzintukList || sys.contactsApi)) || !!getSpeechApiKey();

  settingsIntro.hidden = !!sys;
  invitedNotice.style.display = invited ? 'flex' : 'none';
  inviteLinkBtn.style.display = (sys && !invited) ? 'flex' : 'none';
  inviteHint.style.display = (sys && !invited) ? 'block' : 'none';
  deleteSystemBtn.style.display = sys ? 'inline-block' : 'none';
  settingsTitle.textContent = sys ? (invited ? 'הקבוצה שלי' : 'עריכת מערכת') : 'חיבור מערכת חדשה';
  setConnStatus(null);
  resetSaveButton();
  renderSettingsSystemsList();
  settingsOverlay.classList.add('open');
}
function closeSettings(){
  settingsOverlay.classList.remove('open');
  // נסגר בלי לשמור אחרי "הוספת מערכת נוספת" - חוזרים למערכת שהייתה פתוחה
  if(!getActiveSystemId()){
    const systems = getSystems();
    if(systems.length) setActiveSystemId(systems[0].id);
  }
}
[tokenInput, extInput].forEach(inp => inp.addEventListener('input', () => { setConnStatus(null); resetSaveButton(); }));

// העדפות המכשיר נשמרות מייד עם השינוי (גם בלי ללחוץ "שמירה")
themeInput.onchange = () => setTheme(themeInput.value);
notifyInput.onchange = async () => {
  if(!notifyInput.checked){ setNotifyEnabled(false); return; }
  if(!('Notification' in window)){ notifyInput.checked = false; return; }
  let perm = Notification.permission;
  if(perm === 'default') perm = await Notification.requestPermission();
  if(perm !== 'granted'){
    notifyInput.checked = false;
    setNotifyEnabled(false);
    appAlert('הדפדפן חוסם התראות מהאתר הזה. אפשר לאשר אותן בהגדרות האתר בדפדפן (סמל המנעול ליד הכתובת).', 'התראות חסומות');
    return;
  }
  setNotifyEnabled(true);
};

// ===== קישור הזמנה לחברי קבוצה =====
// מי שהגדיר מערכת (טוקן, שלוחה, אנשי קשר וכו') יכול לייצר קישור מיוחד שמעביר לחברי
// הקבוצה שלו: פתיחת הקישור טוענת את אותם פרטי חיבור אוטומטית במכשיר של מי שקיבל אותו,
// בלי להציג לו את הטוקן/הקישורים/שאר הפרטים בממשק. הפרטים מקודדים בפרמטר קצר בכתובת,
// ומיד עם הטעינה (ר' applyInviteLinkIfPresent) נמחקים משורת הכתובת של הדפדפן.
// חשוב: זה קידוד ולא הצפנה. כל מי שמחזיק בקישור יכול לפענח ממנו את הטוקן (סיסמת הניהול)
// ולקבל גישה מלאה למערכת - לכן מוצגת אזהרה ליד הכפתור ומבקשים אישור לפני ההעתקה.
const INVITE_PARAM = 'j';
const inviteLinkBtn = document.getElementById('inviteLinkBtn');
const inviteHint = document.getElementById('inviteHint');
inviteLinkBtn.onclick = async () => {
  const sys = getActiveSystem();
  if(!sys){ return; }
  const ok = await appConfirm(
    'מי שיקבל את הקישור יוכל להאזין, לשלוח ולמחוק הקלטות במערכת הזו ולשלוח צינתוקים. שלחו אותו רק לאנשים שאתם סומכים עליהם.',
    { title: 'ליצור קישור הזמנה?', okText: 'יצירת קישור' }
  );
  if(!ok) return;
  const payload = {
    label: sys.label || '',
    token: sys.token || '',
    ext: sys.ext || '1',
    tzintukList: sys.tzintukList || '',
    tzintukCallerId: sys.tzintukCallerId || '',
    contactsApi: sys.contactsApi || '',
    contactsSource: sys.contactsSource || 'sheetdb'
  };
  const encoded = b64UrlEncode(JSON.stringify(payload));
  const link = location.origin + location.pathname + '?' + INVITE_PARAM + '=' + encoded;
  try{
    await navigator.clipboard.writeText(link);
    showToast('קישור ההזמנה הועתק! אפשר לשלוח אותו לחברי הקבוצה');
  }catch(err){
    // ה-clipboard API חסום (דפדפן ישן/הרשאות) - מציגים את הקישור להעתקה ידנית
    appDialog({ title: 'קישור ההזמנה', message: 'העתיקו את הקישור ושלחו אותו לחברי הקבוצה:', copyText: link, okText: 'סגירה', cancelText: null });
  }
};

// אם נכנסו לאתר עם קישור הזמנה (?j=...) - קוראים את פרטי המערכת המקודדים בו, מוסיפים/
// מעדכנים מערכת בהתאם ונכנסים אליה ישירות. הפונקציה לא כותבת שום דבר מהמידע המפוענח
// למסך, לטופס או ל-console, ומנקה את הפרמטר מהכתובת מיד עם הקריאה.
function applyInviteLinkIfPresent(){
  const params = new URLSearchParams(location.search);
  const raw = params.get(INVITE_PARAM);
  if(!raw) return false;
  history.replaceState(null, '', location.pathname + location.hash);
  let payload;
  try{
    payload = JSON.parse(b64UrlDecode(raw));
  }catch(err){
    return false;
  }
  if(!payload || !payload.token) return false;

  // אם כבר קיימת אצל המשתמש הזה מערכת עם אותו טוקן ושלוחה - נכנסים אליה במקום ליצור כפילות
  const existing = getSystems().find(s => s.token === payload.token && (s.ext || '1') === (payload.ext || '1'));
  if(existing){
    enterSystem(existing.id);
    return true;
  }

  const systems = getSystems();
  const sys = {
    id: genSystemId(),
    label: payload.label || '',
    token: payload.token,
    ext: payload.ext || '1',
    tzintukList: payload.tzintukList || '',
    tzintukCallerId: payload.tzintukCallerId || '',
    contactsApi: payload.contactsApi || '',
    contactsSource: payload.contactsSource || 'sheetdb',
    invited: true
  };
  systems.push(sys);
  saveSystems(systems);
  enterSystem(sys.id);
  return true;
}

document.getElementById('settingsBtn').onclick = openSettings;
document.getElementById('closeSettingsBtn').onclick = closeSettings;
document.getElementById('settingsCloseX').onclick = closeSettings;
document.getElementById('refreshBtn').onclick = () => loadRecordings();

saveSettingsBtn.onclick = async () => {
  // גלובלי - נשמר תמיד, בלי קשר לאיזו מערכת פעילה כרגע או אם היא "invited".
  setSpeechApiKey(speechApiKeyInput.value);
  const sys = getActiveSystem();
  if(sys && sys.invited){
    // מערכת שהצטרפו אליה דרך קישור הזמנה: השדות הרגישים נעולים ומוצגים ממוסכים, כך שאין
    // להם ערך אמיתי לשמור כאן - מרשים לשנות רק את שם התצוגה המקומי.
    upsertActiveSystem({ label: labelInput.value.trim() });
    setTzIncoming(sys.id, tzIncomingInput.checked);
    settingsOverlay.classList.remove('open');
    enterSystem(sys.id);
    return;
  }
  const t = tokenInput.value.trim();
  const e = extInput.value.trim() || '1';
  if(!t){
    setConnStatus('error', 'נא להזין מספר מערכת וסיסמה.');
    tokenInput.focus();
    return;
  }

  // בדיקת חיבור לפני שמירה: מנסים לקרוא את השלוחה. אם זה נכשל, מציגים למה ומאפשרים לשמור בכל זאת.
  if(!forceSaveArmed){
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'בודק חיבור…';
    setConnStatus('checking', 'מתחבר לימות המשיח…');
    try{
      const files = await fetchFileList(t, e);
      setConnStatus('ok', 'מחובר ✓ ' + (files.length ? ('נמצאו ' + files.length + ' הודעות בשלוחה ' + e) : ('השלוחה ' + e + ' ריקה כרגע')));
    }catch(err){
      const fe = friendlyError(err);
      const msg = (err instanceof TypeError) ? fe.msg : ('ימות המשיח החזירו שגיאה: ' + (err.message || 'לא ידועה') + '. בדקו את מספר המערכת, הסיסמה והשלוחה.');
      setConnStatus('error', msg);
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = 'לשמור בכל זאת';
      forceSaveArmed = true;
      return;
    }
  }

  const savedSys = upsertActiveSystem({
    token: t,
    ext: e,
    label: labelInput.value.trim(),
    tzintukList: tzintukListInput.value.trim(),
    contactsApi: contactsApiInput.value.trim(),
    contactsSource: contactsSourceInput.value
  });
  setTzIncoming(savedSys.id, tzIncomingInput.checked);
  resetSaveButton();
  settingsOverlay.classList.remove('open');
  enterSystem(savedSys.id);
};

// "הוספת מערכת נוספת" מתוך ההגדרות - פותח שוב את מסך ההגדרות כאילו אין מערכת פעילה,
// כדי שהוא יתחיל עם שדות ריקים וייצור בסיום מערכת חדשה (ר' upsertActiveSystem) במקום לשכתב
// את הנוכחית.
document.getElementById('addAnotherSystemBtn').onclick = () => {
  setActiveSystemId(null);
  openSettings();
};

const deleteSystemBtn = document.getElementById('deleteSystemBtn');
deleteSystemBtn.onclick = async () => {
  const sys = getActiveSystem();
  if(!sys) return;
  if(!(await removeSystem(sys))) return;
  settingsOverlay.classList.remove('open');
  const remaining = getSystems();
  if(remaining.length === 0){ openSettings(); refreshSidebar(); }
  else if(remaining.length === 1 || isWide()){ enterSystem(remaining[0].id); }
  else { showHome(); }
};

// ===== הדרכות - מסך מידע סטטי עם קישורים והסברים לכל שדה, לפי קטגוריה =====
const guidesOverlay = document.getElementById('guidesOverlay');
const guidesNav = document.getElementById('guidesNav');
const guidesNavItems = Array.from(guidesNav.querySelectorAll('.guides-nav-item'));
const guidePanels = Array.from(document.querySelectorAll('.guide-panel'));

function showGuidePanel(panelId){
  guidePanels.forEach(el => el.classList.toggle('active', el.id === panelId));
  guidesNavItems.forEach(btn => btn.classList.toggle('active', btn.dataset.guidePanel === panelId));
}
guidesNavItems.forEach(btn => {
  btn.onclick = () => showGuidePanel(btn.dataset.guidePanel);
});

// נפתח מעל ההגדרות (לא סוגר אותן), כך שאחרי קריאת ההדרכה חוזרים ישר לטופס
function openGuides(){
  showGuidePanel(guidesNavItems[0].dataset.guidePanel);
  guidesOverlay.classList.add('open');
}
function closeGuides(){
  guidesOverlay.classList.remove('open');
}
document.getElementById('helpFab').onclick = openGuides;
document.getElementById('openGuidesFromSettings').onclick = openGuides;
document.getElementById('closeGuidesBtn').onclick = closeGuides;
