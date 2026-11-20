// ===== מסך "רשימת מערכות" (בסגנון רשימת השיחות של וואטסאפ) =====
// מוצג רק כשמוגדרת יותר ממערכת אחת - כל שורה היא מערכת, עם אווטאר/שם ותצוגה מקדימה
// של מי שלח את ההודעה האחרונה בה. עם מערכת אחת בלבד נכנסים ישר לתוכה, כמו קודם.
const appEl = document.getElementById('app');
const homeListEl = document.getElementById('homeListEl');
const backHomeBtn = document.getElementById('backHomeBtn');
const homeAddBtn = document.getElementById('homeAddBtn');
const refreshBtnEl = document.getElementById('refreshBtn');
const contactsBtnEl = document.getElementById('contactsBtn');
const settingsBtnEl = document.getElementById('settingsBtn');
let inHomeMode = false;

function updateHeaderForMode(){
  const systems = getSystems();
  refreshBtnEl.style.display = inHomeMode ? 'none' : 'flex';
  contactsBtnEl.style.display = inHomeMode ? 'none' : 'flex';
  settingsBtnEl.style.display = inHomeMode ? 'none' : 'flex';
  homeAddBtn.style.display = inHomeMode ? 'flex' : 'none';
  backHomeBtn.style.display = (!inHomeMode && systems.length > 1) ? 'flex' : 'none';
  if(inHomeMode){
    headerTitle.textContent = 'וואטסאפ פון';
    extLabel.style.display = '';
    extLabel.textContent = systems.length + (systems.length === 1 ? ' מערכת מחוברת' : ' מערכות מחוברות');
  } else {
    // בתוך שיחה מציגים את שם הקבוצה/המערכת עצמה במקום שם האפליקציה, ומסתירים את שורת
    // "שלוחה X" - שם המערכת כבר מספיק כדי לזהות באיזו שיחה נמצאים.
    headerTitle.textContent = systemLabel(getActiveSystem());
    extLabel.style.display = 'none';
  }
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
// וההקלטות שלה - בדיוק כמו הטעינה הרגילה בכניסה לאתר.
function enterSystem(id){
  setActiveSystemId(id);
  showConversation();
  fetchContactsFromServer().then(loadRecordings);
}
backHomeBtn.onclick = showHome;
homeAddBtn.onclick = () => { setActiveSystemId(null); openSettings(); };

// בונה שורת מערכת ברשימה (שלד ראשוני שמוצג מיד, לפני שהתצוגה המקדימה נטענת ברקע).
function buildSystemRow(sys){
  const row = document.createElement('div');
  row.className = 'sys-row';
  row.onclick = () => enterSystem(sys.id);

  const avatar = document.createElement('div');
  avatar.className = 'sys-avatar';
  avatar.innerHTML = ICON_PERSON;

  const body = document.createElement('div');
  body.className = 'sys-body';
  const topRow = document.createElement('div');
  topRow.className = 'sys-toprow';
  const label = document.createElement('span');
  label.className = 'sys-label';
  label.textContent = systemLabel(sys);
  const time = document.createElement('span');
  time.className = 'sys-time';
  time.textContent = '';
  topRow.appendChild(label);
  topRow.appendChild(time);

  const preview = document.createElement('div');
  preview.className = 'sys-preview';
  preview.innerHTML = 'טוען הודעה אחרונה…';

  body.appendChild(topRow);
  body.appendChild(preview);
  row.appendChild(avatar);
  row.appendChild(body);

  row._avatar = avatar;
  row._time = time;
  row._preview = preview;
  return row;
}

// שולף עבור קובץ הקלטה בודד את פרטי השולח (התאמה לפי מספר טלפון מול רשימת אנשי קשר
// נתונה) - גרסה עצמאית של אותו היגיון שמופעל בכל הודעה בתוך buildRecItem, כדי שהתצוגה
// המקדימה ברשימת המערכות תוכל להשתמש בו בלי להיכנס בפועל למערכת ולטעון את כל השיחה.
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

// טוען ברקע את ההקלטה האחרונה ואת אנשי הקשר של מערכת נתונה, ומעדכן את שורתה ברשימה -
// לכל מערכת בנפרד ובמקביל, כדי שמערכת איטית/לא זמינה לא תעכב את הצגת האחרות.
async function loadSystemRowPreview(sys, row){
  try{
    const [files, contacts] = await Promise.all([
      fetchFileList(sys.token, sys.ext || '1').catch(() => []),
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
      return;
    }
    const sender = resolveFileSender(last, contacts);
    row._avatar.innerHTML = contactAvatarHTML(sender.contact || (sender.displayName ? {name: sender.displayName} : null));
    row._preview.innerHTML = ICON_MIC + '<span></span>';
    row._preview.querySelector('span').textContent = sender.displayName;
    if(sender.dateLabel) row._time.textContent = sender.dateLabel.split(' ')[0];
  }catch(err){
    row._preview.textContent = 'שגיאה בטעינת המערכת';
  }
}

function renderHome(){
  const systems = getSystems();
  homeListEl.innerHTML = '';
  if(systems.length === 0){
    openSettings();
    return;
  }
  systems.forEach(sys => {
    const row = buildSystemRow(sys);
    homeListEl.appendChild(row);
    loadSystemRowPreview(sys, row);
  });
}

// ===== צינתוק לרשימת מנויים בהקלטה חדשה =====
// שולח שיחת צינתוק לכל המספרים הרשומים ברשימת צינתוקים (ניהול רשימות צינתוקים
// במודול צינתוקים חינמיים בימות המשיח), דרך פקודת RunTzintuk. הפרמטר phones=tzl:<מספר הרשימה>
// אומר לימות המשיח לשלוף בעצמו את כל המספרים המנויים לאותה רשימה ולצנתק את כולם -
// אין צורך לשלוף את המספרים בצד שלנו, ימות המשיח עושה את זה מולם.
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
    console.warn('שגיאה בשליחת הצינתוק לרשימה (ייתכן חסימת CORS):', err.message);
  }
}

