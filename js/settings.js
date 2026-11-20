// בונה שורת מערכת קומפקטית לרשימת "המערכות שלי" במסך ההגדרות - לחיצה על השורה טוענת
// את אותה מערכת לשדות העריכה, וכפתור המחיקה הקטן מסיר אותה בלי לצאת מההגדרות.
function buildSettingsSystemRow(sys, activeId){
  const row = document.createElement('div');
  row.className = 'settings-sys-row' + (sys.id === activeId ? ' active' : '');
  row.innerHTML =
    '<span class="settings-sys-avatar">' + ICON_PERSON + '</span>' +
    '<span class="settings-sys-info"><b></b><span></span></span>' +
    '<button type="button" class="settings-sys-del" title="מחיקת מערכת זו" aria-label="מחיקת מערכת זו">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
    '</button>';
  row.querySelector('b').textContent = systemLabel(sys);
  row.querySelector('.settings-sys-info span').textContent =
    'שלוחה ' + (sys.invited ? '••' : (sys.ext || '1')) + (sys.invited ? ' · הצטרפות בקישור' : '');
  row.onclick = () => { setActiveSystemId(sys.id); openSettings(); };
  row.querySelector('.settings-sys-del').onclick = (e) => {
    e.stopPropagation();
    const ok = confirm('להסיר את המערכת "' + systemLabel(sys) + '" מהאתר הזה? ' +
      'פרטי החיבור יימחקו מהמכשיר הזה בלבד - שום דבר לא יימחק בימות המשיח עצמו.');
    if(!ok) return;
    const remaining = getSystems().filter(s => s.id !== sys.id);
    saveSystems(remaining);
    if(activeId === sys.id) setActiveSystemId(null);
    openSettings();
  };
  return row;
}
function renderSettingsSystemsList(){
  const systems = getSystems();
  settingsSystemsSection.style.display = systems.length > 0 ? 'block' : 'none';
  settingsSystemsList.innerHTML = '';
  const activeId = getActiveSystemId();
  systems.forEach(sys => settingsSystemsList.appendChild(buildSettingsSystemRow(sys, activeId)));
}

function maskDisplay(){ return '••••••••••••'; }

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

  invitedNotice.style.display = invited ? 'flex' : 'none';
  inviteLinkBtn.style.display = (sys && !invited) ? 'flex' : 'none';
  inviteHint.style.display = (sys && !invited) ? 'block' : 'none';
  deleteSystemBtn.style.display = sys ? 'inline-block' : 'none';
  settingsTitle.textContent = sys ? (invited ? 'הקבוצה שלי' : 'עריכת מערכת') : 'חיבור מערכת חדשה';
  renderSettingsSystemsList();
  settingsOverlay.classList.add('open');
}
function closeSettings(){ settingsOverlay.classList.remove('open'); }

// ===== קישור הזמנה לחברי קבוצה =====
// מי שהגדיר מערכת (טוקן, שלוחה, אנשי קשר וכו') יכול לייצר קישור מיוחד שמעביר לחברי
// הקבוצה שלו: פתיחת הקישור טוענת את אותם פרטי חיבור אוטומטית במכשיר של מי שקיבל אותו,
// בלי להציג לו בשום שלב את הטוקן/הקישורים/שאר הפרטים - לא בשדה בטופס, לא ב-alert
// ולא ב-console. הפרטים מקודדים (לא מוצפנים באמת! ר' הערה למטה) בפרמטר קצר בכתובת,
// ומיד עם הטעינה (ר' applyInviteLinkIfPresent) נמחקים מהכתובת בשורת הכתובת של הדפדפן.
// חשוב: זה קידוד ולא הצפנה. כל מי שמחזיק בקישור יכול לפענח ממנו את הטוקן (סיסמת הניהול)
// ולקבל גישה מלאה למערכת - לכן מוצגת אזהרה ליד הכפתור ומבקשים אישור לפני ההעתקה.
const INVITE_PARAM = 'j';
const inviteLinkBtn = document.getElementById('inviteLinkBtn');
const inviteHint = document.getElementById('inviteHint');
const tzIncomingInput = document.getElementById('tzIncomingInput');
inviteLinkBtn.onclick = async () => {
  const sys = getActiveSystem();
  if(!sys){ return; }
  const ok = confirm('מי שיקבל את הקישור יוכל להאזין, לשלוח ולמחוק הקלטות במערכת הזו ולשלוח צינתוקים. ליצור את הקישור?');
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
    // fallback למקרה שה-clipboard API חסום (למשל דפדפן ישן/הרשאות) - מציגים prompt לבחירה/העתקה ידנית
    window.prompt('העתיקו את קישור ההזמנה:', link);
  }
};

// אם נכנסו לאתר עם קישור הזמנה (?j=...) - קוראים את פרטי המערכת המקודדים בו, מוסיפים/
// מעדכנים מערכת בהתאם ונכנסים אליה ישירות. חשוב: הפונקציה הזו לא כותבת שום דבר מהמידע
// המפוענח למסך, לטופס או ל-console בשום שלב, ומנקה את הפרמטר מהכתובת מיד עם הקריאה -
// כך שמי שקיבל את הקישור לא רואה טוקן, כתובות API או כל פרט אחר, גם אם יפתח כלי פיתוח.
// הערה (למפתח בלבד, לא מוצג למשתמש): זהו קידוד (Base64) ולא הצפנה אמיתית - מי שממש
// ינתח את הקישור עצמו (למשל דרך ההיסטוריה של הדפדפן, אם הספיק להיפתח לפני הניקוי) יכול
// עקרונית לפענח אותו. זה מספיק כדי שהמידע לא "יוצג" באתר כפי שביקשת, אבל זו לא הצפנה.
function applyInviteLinkIfPresent(){
  const params = new URLSearchParams(location.search);
  const raw = params.get(INVITE_PARAM);
  if(!raw) return false;
  // מנקים את הפרמטר מהכתובת מייד, לפני כל עיבוד נוסף - כדי לצמצם למינימום את הזמן
  // שבו הוא מופיע (מקודד) בשורת הכתובת.
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
    setActiveSystemId(existing.id);
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
  setActiveSystemId(sys.id);
  enterSystem(sys.id);
  return true;
}

document.getElementById('settingsBtn').onclick = openSettings;
document.getElementById('closeSettingsBtn').onclick = closeSettings;
document.getElementById('refreshBtn').onclick = () => loadRecordings();

document.getElementById('saveSettingsBtn').onclick = () => {
  // גלובלי - נשמר תמיד, בלי קשר לאיזו מערכת פעילה כרגע או אם היא "invited".
  setSpeechApiKey(speechApiKeyInput.value);
  const sys = getActiveSystem();
  if(sys && sys.invited){
    // מערכת שהצטרפו אליה דרך קישור הזמנה: השדות הרגישים נעולים ומוצגים ממוסכים (ר' openSettings),
    // כך שאין להם ערך אמיתי לשמור כאן - מרשים לשנות רק את שם התצוגה המקומי.
    upsertActiveSystem({ label: labelInput.value.trim() });
    setTzIncoming(sys.id, tzIncomingInput.checked);
    closeSettings();
    fetchContactsFromServer().then(loadRecordings);
    return;
  }
  const t = tokenInput.value.trim();
  const e = extInput.value.trim() || '1';
  if(!t){ alert('נא להזין טוקן'); return; }
  const savedSys = upsertActiveSystem({
    token: t,
    ext: e,
    label: labelInput.value.trim(),
    tzintukList: tzintukListInput.value.trim(),
    contactsApi: contactsApiInput.value.trim(),
    contactsSource: contactsSourceInput.value
  });
  setTzIncoming(savedSys.id, tzIncomingInput.checked);
  closeSettings();
  fetchContactsFromServer().then(loadRecordings);
};

// "הוספת מערכת נוספת" מתוך ההגדרות - פותח שוב את מסך ההגדרות המקוצר כאילו אין מערכת פעילה,
// כדי שהוא יתחיל עם שדות ריקים וייצור בסיום מערכת חדשה (ר' upsertActiveSystem) במקום לשכתב
// את הנוכחית. המדריך למתחיל עדיין נגיש דרך הכפתור הייעודי, אבל לא נפתח כברירת מחדל.
document.getElementById('addAnotherSystemBtn').onclick = () => {
  setActiveSystemId(null);
  openSettings();
};

const deleteSystemBtn = document.getElementById('deleteSystemBtn');
deleteSystemBtn.onclick = () => {
  const sys = getActiveSystem();
  if(!sys) return;
  const ok = confirm('להסיר את המערכת "' + systemLabel(sys) + '" מהאתר הזה? ' +
    'פרטי החיבור יימחקו מהמכשיר הזה בלבד - שום דבר לא יימחק בימות המשיח עצמו.');
  if(!ok) return;
  const remaining = getSystems().filter(s => s.id !== sys.id);
  saveSystems(remaining);
  setActiveSystemId(null);
  closeSettings();
  if(remaining.length === 0){ openSettings(); }
  else if(remaining.length === 1){ enterSystem(remaining[0].id); }
  else { showHome(); }
};

// ===== הדרכות - מסך מידע סטטי (לא אינטראקטיבי) עם קישורים והסברים לכל שדה, לפי קטגוריה =====
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

function openGuides(){
  closeSettings();
  showGuidePanel(guidesNavItems[0].dataset.guidePanel);
  guidesOverlay.classList.add('open');
}
function closeGuides(){
  guidesOverlay.classList.remove('open');
}
document.getElementById('helpFab').onclick = openGuides;
document.getElementById('closeGuidesBtn').onclick = closeGuides;

