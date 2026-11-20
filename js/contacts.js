// ===== אנשי קשר =====
const ICON_PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const ICON_PERSON_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>';
const ICON_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

const contactsOverlay = document.getElementById('contactsOverlay');
const contactsList = document.getElementById('contactsList');
const contactEditOverlay = document.getElementById('contactEditOverlay');
const contactEditTitle = document.getElementById('contactEditTitle');
const avatarPickBtn = document.getElementById('avatarPickBtn');
const avatarPreviewImg = document.getElementById('avatarPreviewImg');
const contactPhotoInput = document.getElementById('contactPhotoInput');
const removePhotoBtn = document.getElementById('removePhotoBtn');
const contactNameInput = document.getElementById('contactNameInput');
const contactPhoneInput = document.getElementById('contactPhoneInput');
const contactIsMeInput = document.getElementById('contactIsMeInput');
const deleteContactBtn = document.getElementById('deleteContactBtn');

// מזהה איש הקשר שמסומן כ"אני" - נשמר לכל טוקן בנפרד (העדפת תצוגה מקומית).
function meContactKey(){ return 'yemot_me_contact:' + (getToken() || ''); }
function getMeContactId(){ return localStorage.getItem(meContactKey()) || null; }
function setMeContactId(id){
  if(id) localStorage.setItem(meContactKey(), id);
  else localStorage.removeItem(meContactKey());
}
// מחזיר את איש הקשר שסומן כ"אני", אם הוגדר ואם הוא עדיין קיים ברשימת אנשי הקשר
function getMeContact(){
  const id = getMeContactId();
  if(!id) return null;
  return getContacts().find(c => c.id === id) || null;
}


// אנשי הקשר נטענים מהגיליון (לפי הטוקן) ומוחזקים בזיכרון בשביל רינדור מהיר וסינכרוני.
let contactsCache = [];

// שיוך "מי שלח" עבור הקלטות שהועלו מהאתר הזה (ולא ניתן לזהות אותן משם הקובץ, כי
// autoNumbering=true - ר' uploadRecording) - נשמר *באותו* גיליון SheetDB של אנשי הקשר,
// כשורה מיוחדת עם ContactId בפורמט 'rec:<שם הקובץ>' (כדי לא להתנגש עם אנשי קשר אמיתיים).
// כך השיוך משותף לכל מי שנכנס עם אותו טוקן/שלוחה - ולא רק מקומי לדפדפן שהעלה את ההקלטה.
let recAttributionCache = [];

function getContacts(){ return contactsCache; }

// טוען מחדש את אנשי הקשר של הטוקן הנוכחי מהגיליון (דרך SheetDB או סקריפט Apps Script -
// לפי מה שהוגדר להרצה הזו ב-getContactsSource()).
// עמודות בגיליון (שתי השיטות): SystemKey | ContactId | Name | Phone | PhotoUrl | UpdatedAt
async function fetchContactsFromServer(){
  const token = getToken();
  const apiUrl = getContactsApiUrl();
  const source = getContactsSource();
  if(!token || !apiUrl){ contactsCache = []; recAttributionCache = []; return contactsCache; }
  try{
    const url = source === 'appsscript'
      ? apiUrl + (apiUrl.includes('?') ? '&' : '?') + 'action=search&SystemKey=' + encodeURIComponent(token)
      : apiUrl + '/search?SystemKey=' + encodeURIComponent(token);
    const res = await fetch(url);
    const rows = await res.json();
    const all = Array.isArray(rows) ? rows : [];
    contactsCache = all
      .filter(r => !String(r.ContactId||'').startsWith('rec:'))
      .map(r => ({ id: r.ContactId, name: r.Name, phone: r.Phone, photo: r.PhotoUrl || '' }));
    recAttributionCache = all
      .filter(r => String(r.ContactId||'').startsWith('rec:'))
      .map(r => ({ file: String(r.ContactId).slice(4), name: r.Name, phone: r.Phone, photo: r.PhotoUrl || '' }));
  }catch(err){
    console.warn('שגיאה בטעינת אנשי קשר מהגיליון:', err.message);
  }
  return contactsCache;
}

// מחזיר את פרטי השולח המשויכים לקובץ הקלטה שהועלה מהאתר הזה, אם נשמר שיוך כזה בגיליון.
function getRecordingAttribution(fileName){
  return recAttributionCache.find(r => r.file === fileName) || null;
}

// שומר בגיליון (משותף לכולם) מי שלח הקלטה שהועלתה מהאתר הזה - לפי מי שסומן כ"אני"
// באנשי הקשר בזמן ההעלאה. נקרא מיד אחרי שמתגלה השם/מספר שימות המשיח קבע לקובץ בפועל.
async function saveRecordingAttribution(fileName){
  const me = getMeContact();
  if(!me || !me.phone) return; // בלי איש קשר "אני" עם מספר טלפון, אין מה לשמור
  const apiUrl = getContactsApiUrl();
  if(!apiUrl) return; // בלי כתובת API מוגדרת, אין לאן לשמור את השיוך
  const source = getContactsSource();
  const token = getToken();
  const row = {
    SystemKey: token,
    ContactId: 'rec:' + fileName,
    Name: me.name,
    Phone: me.phone,
    PhotoUrl: me.photo || '',
    UpdatedAt: new Date().toISOString()
  };
  try{
    const res = source === 'appsscript'
      ? await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'upsert', row })
        })
      : await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [row] })
        });
    if(res.ok){
      recAttributionCache = recAttributionCache.filter(r => r.file !== fileName);
      recAttributionCache.push({ file: fileName, name: me.name, phone: me.phone, photo: me.photo || '' });
    }
  }catch(err){
    console.warn('שגיאה בשמירת שיוך שולח להקלטה:', err.message);
  }
}


// שומר איש קשר בודד בגיליון (הוספה אם חדש, עדכון אם כבר קיים), ומעדכן את המטמון המקומי.
async function saveContactToServer(contact){
  const apiUrl = getContactsApiUrl();
  if(!apiUrl) throw new Error('לא הוגדרה כתובת API לאנשי קשר בהגדרות');
  const source = getContactsSource();
  const token = getToken();
  const row = {
    SystemKey: token,
    ContactId: contact.id,
    Name: contact.name,
    Phone: contact.phone,
    PhotoUrl: contact.photo || '',
    UpdatedAt: new Date().toISOString()
  };
  let res;
  if(source === 'appsscript'){
    // גוף הבקשה נשלח כ-text/plain (ולא application/json) כדי להימנע מבקשת preflight מסוג
    // OPTIONS, ש-Apps Script Web App לא יודע לענות עליה - הסקריפט עצמו עדיין מפענח JSON תקין.
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'upsert', row })
    });
  } else {
    const exists = contactsCache.some(c => c.id === contact.id);
    if(exists){
      res = await fetch(apiUrl + '/ContactId/' + encodeURIComponent(contact.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: row })
      });
    } else {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [row] })
      });
    }
  }
  if(!res.ok) throw new Error('שמירה נכשלה (' + res.status + ')');
  const idx = contactsCache.findIndex(c => c.id === contact.id);
  if(idx !== -1) contactsCache[idx] = contact; else contactsCache.push(contact);
}

// מוחק איש קשר מהגיליון, ומעדכן את המטמון המקומי.
async function deleteContactFromServer(id){
  const apiUrl = getContactsApiUrl();
  if(!apiUrl) throw new Error('לא הוגדרה כתובת API לאנשי קשר בהגדרות');
  const source = getContactsSource();
  const res = source === 'appsscript'
    ? await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete', row: { SystemKey: getToken(), ContactId: id } })
      })
    : await fetch(apiUrl + '/ContactId/' + encodeURIComponent(id), {
        method: 'DELETE'
      });
  if(!res.ok) throw new Error('מחיקה נכשלה (' + res.status + ')');
  contactsCache = contactsCache.filter(c => c.id !== id);
}

// משאיר רק את 9 הספרות האחרונות של המספר, כדי שהשוואה תצליח בלי קשר
// לקידומת בינלאומית (972+) או לאפס המוביל.
function normalizePhone(str){
  const digits = String(str || '').replace(/\D/g, '');
  return digits.slice(-9);
}
function findContactByPhone(phone){
  const target = normalizePhone(phone);
  if(!target) return null;
  return getContacts().find(c => normalizePhone(c.phone) === target) || null;
}

// צבע עקבי לפי השם (כמו אווטארים של אנשי קשר בוואטסאפ), לשימוש כשאין תמונה.
const AVATAR_COLORS = ['#F06292','#BA68C8','#7986CB','#4FC3F7','#4DB6AC','#81C784','#FFB74D','#A1887F'];
function avatarColorFor(str){
  let seed = 0;
  for(let i=0;i<str.length;i++) seed = (seed*31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[seed % AVATAR_COLORS.length];
}
function initialsFor(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(parts.length === 0) return '?';
  return parts.length === 1 ? parts[0][0] : (parts[0][0] + parts[parts.length-1][0]);
}
function contactAvatarHTML(contact){
  if(contact && contact.photo) return '<img src="' + contact.photo + '" alt="">';
  if(contact && contact.name){
    const color = avatarColorFor(contact.name);
    return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;' +
      'background:' + color + ';color:#fff;font-weight:600;font-size:.85rem;">' + initialsFor(contact.name) + '</div>';
  }
  return ICON_PERSON;
}

function renderContactsList(){
  const contacts = getContacts();
  contactsList.innerHTML = '';
  if(contacts.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty-contacts';
    empty.textContent = getContactsApiUrl()
      ? 'אין עדיין אנשי קשר. הוסיפו איש קשר כדי שהשם והתמונה יוצגו בהקלטות שלו.'
      : 'לא הוגדרה כתובת API לאנשי קשר. היכנסו להגדרות והזינו כתובת SheetDB פרטית כדי להתחיל להוסיף אנשי קשר.';
    contactsList.appendChild(empty);
    return;
  }
  contacts.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'', 'he')).forEach(contact => {
    const row = document.createElement('div');
    row.className = 'contact-row';
    row.innerHTML =
      '<div class="c-avatar">' + contactAvatarHTML(contact) + '</div>' +
      '<div class="c-info">' +
        '<div class="c-name"></div>' +
        '<div class="c-phone"></div>' +
      '</div>' +
      '<button type="button" class="delete-btn" aria-label="עריכה">' + ICON_PENCIL + '</button>';
    row.querySelector('.c-name').textContent = contact.name || '(ללא שם)';
    row.querySelector('.c-phone').textContent = contact.phone || '';
    row.onclick = () => openContactEdit(contact.id);
    contactsList.appendChild(row);
  });
}

async function openContacts(){
  contactsOverlay.classList.add('open');
  contactsList.innerHTML = '<div class="empty-contacts">טוען אנשי קשר…</div>';
  await fetchContactsFromServer();
  renderContactsList();
}
function closeContacts(){ contactsOverlay.classList.remove('open'); }

let editingContactId = null;
let pendingAvatarPhoto = null; // dataURL שנבחר בעורך התמונה, טרם נשמר לאיש הקשר

function openContactEdit(id, prefillPhone){
  const contact = id ? getContacts().find(c => c.id === id) : null;
  editingContactId = contact ? contact.id : null;
  pendingAvatarPhoto = contact ? (contact.photo || null) : null;
  contactEditTitle.textContent = contact ? 'עריכת איש קשר' : 'איש קשר חדש';
  contactNameInput.value = contact ? contact.name || '' : '';
  contactPhoneInput.value = contact ? (contact.phone || '') : (prefillPhone || '');
  contactIsMeInput.checked = contact ? (contact.id === getMeContactId()) : false;
  deleteContactBtn.style.display = contact ? '' : 'none';
  refreshAvatarPreview();
  closeContacts();
  contactEditOverlay.classList.add('open');
}
function closeContactEdit(){ contactEditOverlay.classList.remove('open'); }

function refreshAvatarPreview(){
  if(pendingAvatarPhoto){
    avatarPreviewImg.src = pendingAvatarPhoto;
    avatarPreviewImg.style.display = 'block';
    removePhotoBtn.style.display = '';
  } else {
    avatarPreviewImg.style.display = 'none';
    avatarPreviewImg.src = '';
    removePhotoBtn.style.display = 'none';
  }
}

document.getElementById('contactsBtn').onclick = openContacts;
document.getElementById('closeContactsBtn').onclick = closeContacts;
document.getElementById('addContactBtn').onclick = () => openContactEdit(null);
document.getElementById('cancelContactEditBtn').onclick = closeContactEdit;
avatarPickBtn.onclick = () => contactPhotoInput.click();
document.getElementById('changePhotoBtn').onclick = () => contactPhotoInput.click();
removePhotoBtn.onclick = () => { pendingAvatarPhoto = null; refreshAvatarPreview(); };

const saveContactBtn = document.getElementById('saveContactBtn');
saveContactBtn.onclick = async () => {
  const name = contactNameInput.value.trim();
  const phone = contactPhoneInput.value.trim();
  if(!name){ alert('נא להזין שם'); return; }
  if(!phone){ alert('נא להזין מספר טלפון'); return; }
  const id = editingContactId || ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c' + Date.now() + Math.random().toString(16).slice(2));
  const contact = { id, name, phone, photo: pendingAvatarPhoto || '' };
  saveContactBtn.disabled = true;
  saveContactBtn.textContent = 'שומר…';
  try{
    await saveContactToServer(contact);
    setMeContactId(contactIsMeInput.checked ? id : (getMeContactId() === id ? null : getMeContactId()));
    closeContactEdit();
    loadRecordings();
  }catch(err){
    alert('שגיאה בשמירת איש הקשר: ' + err.message);
  }finally{
    saveContactBtn.disabled = false;
    saveContactBtn.textContent = 'שמירה';
  }
};

deleteContactBtn.onclick = async () => {
  if(!editingContactId) return;
  const ok = confirm('למחוק את איש הקשר?');
  if(!ok) return;
  try{
    await deleteContactFromServer(editingContactId);
    if(getMeContactId() === editingContactId) setMeContactId(null);
    closeContactEdit();
    loadRecordings();
  }catch(err){
    alert('שגיאה במחיקת איש הקשר: ' + err.message);
  }
};

// ===== חיתוך תמונת פרופיל =====
const cropOverlay = document.getElementById('cropOverlay');
const cropStage = document.getElementById('cropStage');
const cropImg = document.getElementById('cropImg');
const cropZoom = document.getElementById('cropZoom');
const CROP_STAGE_SIZE = 260;
const CROP_OUTPUT_SIZE = 320;

let cropState = null; // { naturalW, naturalH, coverScale, zoom, x, y }

function openCropper(imageDataUrl){
  cropImg.onload = () => {
    const naturalW = cropImg.naturalWidth;
    const naturalH = cropImg.naturalHeight;
    const coverScale = CROP_STAGE_SIZE / Math.min(naturalW, naturalH);
    cropState = { naturalW, naturalH, coverScale, zoom: 1, x: 0, y: 0 };
    cropZoom.value = '1';
    applyCropTransform(true);
    cropOverlay.classList.add('open');
  };
  cropImg.src = imageDataUrl;
}
function closeCropper(){
  cropOverlay.classList.remove('open');
  cropState = null;
}

function applyCropTransform(recenter){
  if(!cropState) return;
  const s = cropState.coverScale * cropState.zoom;
  const w = cropState.naturalW * s;
  const h = cropState.naturalH * s;
  if(recenter){
    cropState.x = (CROP_STAGE_SIZE - w) / 2;
    cropState.y = (CROP_STAGE_SIZE - h) / 2;
  } else {
    const minX = CROP_STAGE_SIZE - w, maxX = 0;
    const minY = CROP_STAGE_SIZE - h, maxY = 0;
    cropState.x = Math.min(maxX, Math.max(minX, cropState.x));
    cropState.y = Math.min(maxY, Math.max(minY, cropState.y));
  }
  cropImg.style.width = w + 'px';
  cropImg.style.height = h + 'px';
  cropImg.style.transform = 'translate(' + cropState.x + 'px,' + cropState.y + 'px)';
}

cropZoom.oninput = () => {
  if(!cropState) return;
  cropState.zoom = parseFloat(cropZoom.value);
  applyCropTransform(false);
};

// גרירה לבחירת האזור הרצוי בתמונה (עכבר ומגע כאחד דרך Pointer Events)
let dragStart = null;
cropStage.addEventListener('pointerdown', (e) => {
  if(!cropState) return;
  dragStart = { x: e.clientX, y: e.clientY, origX: cropState.x, origY: cropState.y };
  cropStage.classList.add('dragging');
  cropStage.setPointerCapture(e.pointerId);
});
cropStage.addEventListener('pointermove', (e) => {
  if(!dragStart || !cropState) return;
  cropState.x = dragStart.origX + (e.clientX - dragStart.x);
  cropState.y = dragStart.origY + (e.clientY - dragStart.y);
  applyCropTransform(false);
});
function endDrag(){ dragStart = null; cropStage.classList.remove('dragging'); }
cropStage.addEventListener('pointerup', endDrag);
cropStage.addEventListener('pointercancel', endDrag);

document.getElementById('cropCancelBtn').onclick = () => {
  closeCropper();
  contactPhotoInput.value = '';
};

const cropConfirmBtn = document.getElementById('cropConfirmBtn');
cropConfirmBtn.onclick = () => {
  if(!cropState) return;
  const s = cropState.coverScale * cropState.zoom;
  const sx = -cropState.x / s;
  const sy = -cropState.y / s;
  const sSize = CROP_STAGE_SIZE / s;
  const canvas = document.createElement('canvas');
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropImg, sx, sy, sSize, sSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

  cropConfirmBtn.disabled = true;
  cropConfirmBtn.textContent = 'מעלה תמונה…';
  canvas.toBlob(async (blob) => {
    try{
      const url = await uploadToCloudinary(blob);
      pendingAvatarPhoto = url; // נשמר כ-URL של קלאודינרי, לא כ-base64
      refreshAvatarPreview();
      closeCropper();
      contactPhotoInput.value = '';
    }catch(err){
      alert('שגיאה בהעלאת התמונה: ' + err.message);
    }finally{
      cropConfirmBtn.disabled = false;
      cropConfirmBtn.textContent = 'אישור חיתוך';
    }
  }, 'image/jpeg', 0.9);
};

contactPhotoInput.onchange = () => {
  const file = contactPhotoInput.files && contactPhotoInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => openCropper(reader.result);
  reader.readAsDataURL(file);
};

