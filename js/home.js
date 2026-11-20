// ===== רשימת המערכות (בסגנון רשימת השיחות של וואטסאפ) =====
// בטלפון: מסך נפרד שמוצג כשיש יותר ממערכת אחת (עם מערכת אחת נכנסים ישר לשיחה).
// במחשב (מסך רחב): מוצגת תמיד בצד, והשיחה הפתוחה לידה.
const appEl = document.getElementById('app');
const homeListEl = document.getElementById('homeListEl');
const homeCountLabel = document.getElementById('homeCountLabel');
const backHomeBtn = document.getElementById('backHomeBtn');
const homeAddBtn = document.getElementById('homeAddBtn');
let inHomeMode = false;

const wideQuery = window.matchMedia('(min-width: 900px)');
function isWide(){ return wideQuery.matches; }

function updateHeaderForMode(){
  const systems = getSystems();
  backHomeBtn.style.display = (!inHomeMode && systems.length > 1) ? 'flex' : 'none';
  homeCountLabel.textContent = systems.length + (systems.length === 1 ? ' מערכת מחוברת' : ' מערכות מחוברות');
  const sys = getActiveSystem();
  headerTitle.textContent = sys ? systemLabel(sys) : 'וואטסאפ פון';
  document.title = sys ? (systemLabel(sys) + ' · וואטסאפ פון') : 'וואטסאפ פון';
}

function showHome(){
  inHomeMode = true;
  appEl.classList.add('home-mode');
  updateHeaderForMode();
  renderHome();
}
function showConversation(){
  inHomeMode = false;
  appEl.classList.remove('home-mode');
  updateHeaderForMode();
}
// עוברים למערכת נתונה: הופכים אותה לפעילה, עוברים למסך השיחה, וטוענים את אנשי הקשר
// וההקלטות שלה.
function enterSystem(id){
  setActiveSystemId(id);
  showConversation();
  closeSearch();
  refreshSidebar();
  fetchContactsFromServer().then(loadRecordings);
}
backHomeBtn.onclick = showHome;
homeAddBtn.onclick = () => { setActiveSystemId(null); openSettings(); };

// במחשב רשימת המערכות תמיד גלויה - מציירים אותה מחדש אם צריך, אחרת רק מסמנים את הפעילה
function refreshSidebar(){
  updateHeaderForMode();
  if(!isWide() && !inHomeMode) return;
  const ids = getSystems().map(s => s.id).join(',');
  if(homeListEl.dataset.ids !== ids) renderHome();
  else highlightActiveSystemRow();
}
function highlightActiveSystemRow(){
  const activeId = getActiveSystemId();
  homeListEl.querySelectorAll('.sys-row').forEach(r => r.classList.toggle('active', r.dataset.id === activeId));
}

// בונה שורת מערכת ברשימה (שלד ראשוני שמוצג מיד, לפני שהתצוגה המקדימה נטענת ברקע).
function buildSystemRow(sys){
  const row = document.createElement('div');
  row.className = 'sys-row';
  row.dataset.id = sys.id;
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.onclick = () => enterSystem(sys.id);
  row.onkeydown = (e) => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); enterSystem(sys.id); } };

  const avatar = document.createElement('div');
  avatar.className = 'sys-avatar';
  avatar.innerHTML = sys.label ? contactAvatarHTML({ name: sys.label }) : ICON_PERSON;

  const body = document.createElement('div');
  body.className = 'sys-body';
  const topRow = document.createElement('div');
  topRow.className = 'sys-toprow';
  const label = document.createElement('span');
  label.className = 'sys-label';
  label.textContent = systemLabel(sys);
  const time = document.createElement('span');
  time.className = 'sys-time';
  topRow.appendChild(label);
  topRow.appendChild(time);

  const bottomRow = document.createElement('div');
  bottomRow.className = 'sys-bottomrow';
  const preview = document.createElement('div');
  preview.className = 'sys-preview';
  preview.textContent = 'טוען הודעה אחרונה…';
  const unread = document.createElement('span');
  unread.className = 'sys-unread';
  unread.hidden = true;
  bottomRow.appendChild(preview);
  bottomRow.appendChild(unread);

  body.appendChild(topRow);
  body.appendChild(bottomRow);
  row.appendChild(avatar);
  row.appendChild(body);

  row._time = time;
  row._preview = preview;
  row._unread = unread;
  return row;
}

// שולף עבור קובץ הקלטה בודד את פרטי השולח (התאמה לפי מספר טלפון מול רשימת אנשי קשר
// נתונה) - גרסה עצמאית של אותו היגיון שמופעל בכל הודעה בתוך buildRecItem.
function resolveFileSender(file, contacts){
  const phoneInfo = parsePhoneAndDate(file.name);
  const fallbackPhone = phoneInfo ? null : extractPhoneFallback(file);
  const matchedPhone = phoneInfo ? phoneInfo.phone : fallbackPhone;
  let contact = null;
  if(matchedPhone){
    const target = normalizePhone(matchedPhone);
    contact = contacts.find(c => normalizePhone(c.phone) === target) || null;
  }
  const dateLabel = phoneInfo ? phoneInfo.date : extractDateLabel(file);
  const displayName = contact ? contact.name : (matchedPhone || 'לא מזוהה');
  return { contact, displayName, dateLabel };
}

function setRowUnread(row, n){
  row._unread.hidden = !n;
  row._unread.textContent = n > 99 ? '99+' : String(n || '');
  row.classList.toggle('has-unread', !!n);
}

// טוען ברקע את ההקלטה האחרונה ואת אנשי הקשר של מערכת נתונה, ומעדכן את שורתה ברשימה -
// לכל מערכת בנפרד ובמקביל, כדי שמערכת איטית/לא זמינה לא תעכב את הצגת האחרות.
async function loadSystemRowPreview(sys, row){
  try{
    const [files, contacts] = await Promise.all([
      fetchFileList(sys.token, sys.ext || '1'),
      (async () => {
        if(!sys.contactsApi) return [];
        try{
          const url = sys.contactsSource === 'appsscript'
            ? sys.contactsApi + (sys.contactsApi.includes('?') ? '&' : '?') + 'action=search&SystemKey=' + encodeURIComponent(sys.token)
            : sys.contactsApi + '/search?SystemKey=' + encodeURIComponent(sys.token);
          const res = await fetch(url);
          const rows = await res.json();
          return (Array.isArray(rows) ? rows : [])
            .filter(r => !String(r.ContactId||'').startsWith('rec:'))
            .map(r => ({ id: r.ContactId, name: r.Name, phone: r.Phone, photo: r.PhotoUrl || '' }));
        }catch(err){ return []; }
      })()
    ]);
    const last = files[files.length - 1];
    if(!last){
      row._preview.textContent = 'אין עדיין הודעות';
      setRowUnread(row, 0);
      return;
    }
    // נקודת ההתחלה של מונה "לא נקראו": בפעם הראשונה שרואים מערכת, כל מה שקיים נחשב נקרא
    if(!getLastSeen(sys.id)) setLastSeen(sys.id, last.name);
    const isOpenNow = sys.id === getActiveSystemId() && !inHomeMode;
    setRowUnread(row, isOpenNow ? 0 : countUnread(sys.id, files));

    const sender = resolveFileSender(last, contacts);
    row._preview.innerHTML = ICON_MIC + '<span></span>';
    row._preview.querySelector('span').textContent = sender.displayName;
    const info = fileDateInfo(last);
    row._time.textContent = info ? (dayLabel(info.date) === 'היום' && info.hasTime ? fmtClock(info.date) : dayLabel(info.date)) : '';
  }catch(err){
    row._preview.textContent = 'לא הצלחנו לטעון את המערכת';
  }
}

function renderHome(){
  const systems = getSystems();
  homeListEl.innerHTML = '';
  homeListEl.dataset.ids = systems.map(s => s.id).join(',');
  updateHeaderForMode();
  if(systems.length === 0){
    const empty = document.createElement('div');
    empty.className = 'home-empty';
    empty.textContent = 'עוד לא חיברתם מערכת. לחצו על + כדי להתחיל.';
    homeListEl.appendChild(empty);
    if(!settingsOverlay.classList.contains('open')) openSettings();
    return;
  }
  systems.forEach(sys => {
    const row = buildSystemRow(sys);
    homeListEl.appendChild(row);
    loadSystemRowPreview(sys, row);
  });
  highlightActiveSystemRow();
}

// מעדכן את השורה של מערכת אחת (למשל אחרי שנכנסו אליה, כדי לאפס את מונה "לא נקראו")
function refreshHomeRow(id){
  const row = homeListEl.querySelector('.sys-row[data-id="' + id + '"]');
  const sys = getSystems().find(s => s.id === id);
  if(row && sys) loadSystemRowPreview(sys, row);
}

// רענון שקט של רשימת המערכות פעם בדקה, כשהיא גלויה (במחשב תמיד, בטלפון במסך הרשימה)
setInterval(() => {
  if(document.hidden) return;
  if(!isWide() && !inHomeMode) return;
  homeListEl.querySelectorAll('.sys-row').forEach(row => {
    const sys = getSystems().find(s => s.id === row.dataset.id);
    if(sys && !(sys.id === getActiveSystemId() && !inHomeMode)) loadSystemRowPreview(sys, row);
  });
}, 60000);

// מעבר בין פריסת טלפון למחשב (סיבוב טאבלט, שינוי גודל חלון)
wideQuery.addEventListener('change', () => {
  if(isWide()){
    if(inHomeMode && getActiveSystemId()) showConversation();
    refreshSidebar();
  }
});

// ===== צינתוק לרשימת מנויים בהקלטה חדשה =====
// שולח שיחת צינתוק לכל המספרים הרשומים ברשימת צינתוקים (ניהול רשימות צינתוקים
// במודול צינתוקים חינמיים בימות המשיח), דרך פקודת RunTzintuk. הפרמטר phones=tzl:<מספר הרשימה>
// אומר לימות המשיח לשלוף בעצמו את כל המספרים המנויים לאותה רשימה ולצנתק את כולם.

// האם המכשיר הזה שולח צינתוק כשמגיעה הודעה חדשה מהטלפון (ולא מהאתר). בעבר כל מכשיר
// שהאתר היה פתוח בו צנתק - כך שעם כמה אנשים פתוחים הרשימה קיבלה כמה צינתוקים על אותה
// הודעה. עכשיו זו הגדרה לכל מכשיר: כברירת מחדל פעילה רק אצל מי שהגדיר את המערכת
// (ולא אצל מי שהצטרף בקישור הזמנה), וניתנת לשינוי בהגדרות.
function tzIncomingKey(id){ return 'yemot_tz_incoming:' + id; }
function getTzIncoming(sys){
  if(!sys) return true;
  const v = localStorage.getItem(tzIncomingKey(sys.id));
  if(v === null) return !sys.invited;
  return v === '1';
}
function setTzIncoming(id, on){
  if(id) localStorage.setItem(tzIncomingKey(id), on ? '1' : '0');
}

// מונע צינתוק כפול על אותה הודעה כשהאתר פתוח בכמה לשוניות באותו דפדפן.
const LS_TZ_SENT = 'yemot_tz_sent';
function claimTzintuk(key){
  let sent = [];
  try{ sent = JSON.parse(localStorage.getItem(LS_TZ_SENT) || '[]'); }catch(err){}
  if(sent.includes(key)) return false;
  sent.push(key);
  try{ localStorage.setItem(LS_TZ_SENT, JSON.stringify(sent.slice(-200))); }catch(err){}
  return true;
}

// dedupeKey (אופציונלי) - מזהה ההודעה שבגללה מצנתקים; אם כבר צונתק עליה מהדפדפן הזה, מדלגים.
async function sendTzintuk(dedupeKey){
  const list = getTzintukList();
  if(!list) return;
  const token = getToken();
  if(!token) return;
  if(dedupeKey && !claimTzintuk(dedupeKey)) return;
  const params = new URLSearchParams({ token, phones: 'tzl:' + list });
  const callerId = getTzintukCallerId();
  if(callerId) params.set('callerId', callerId);
  try{
    const res = await fetch(BASE_URL + 'RunTzintuk?' + params.toString());
    const data = await res.json();
    if(data.responseStatus !== 'OK'){
      console.warn('שליחת הצינתוק לרשימה נכשלה:', data.message || data.responseStatus);
    }
  }catch(err){
    console.warn('שגיאה בשליחת הצינתוק לרשימה:', err.message);
  }
}
