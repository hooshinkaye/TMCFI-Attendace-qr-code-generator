/* script.js — REPLACE your existing file with this */

// ---------- Helpers ----------
function mk(q){ return document.querySelector(q); }
function $id(id){ return document.getElementById(id); }

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  // Auto remove after 4s
  setTimeout(() => {
    toast.style.animation = 'fadeSlideOut 0.4s forwards';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function markError(el) {
  if(!el) return;
  el.classList.add('error','shake');
  // remove shake quickly but keep error for 5s
  setTimeout(()=> el.classList.remove('shake'), 600);
  setTimeout(()=> { if(el && el.classList) el.classList.remove('error'); }, 5000);
}

function highlightSummary(summaryEl) {
  if (!summaryEl) return;
  summaryEl.classList.add('summary-error');
  const parent = summaryEl.closest('details');
  if (parent) parent.classList.add('summary-error');
  setTimeout(()=>{
    summaryEl.classList.remove('summary-error');
    parent && parent.classList.remove('summary-error');
  }, 5000);
}

// ensure QR hidden on load
function hideQRInitially(){
  const qrSection = $id('qrSection');
  const dl = $id('downloadBtn');
  if(qrSection){ qrSection.classList.remove('show'); qrSection.style.display='none'; }
  if(dl) dl.style.display = 'none';
}

// ---------- Subject handling ----------
function addSubject() {
  const d = document.createElement('details');
  d.className = 'subject';
  d.open = true;

  d.innerHTML = `
    <summary>
      <strong>New Subject</strong>
      <div>
        <button type="button" class="remove-subject">Remove</button>
      </div>
    </summary>
    <div class="subject-body">
      <label>🏫 Subject Name</label>
      <input type="text" class="subjName" placeholder="e.g., Math">

      <label>📅 Days</label>
      <div class="days">
        ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day =>
          `<div class="chip" data-day="${day}">${day}</div>`
        ).join('')}
      </div>

      <label>⏰ Start Time</label>
      <input type="time" class="startTime">

      <label>⏰ End Time</label>
      <input type="time" class="endTime">
    </div>
  `;

  // add fade-in animation (CSS keyframes handle the visuals)
  d.style.animation = 'fadeInSubject 0.36s ease';

  const area = $id('subjectsArea');
  area.appendChild(d);

  // wire remove button with animation
  const rem = d.querySelector('.remove-subject');
  rem.addEventListener('click', () => {
    d.classList.add('removing');
    setTimeout(()=> d.remove(), 360); // match CSS timing
  });

  // wire chips
  d.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });

  // autofocus the subject name
  const firstInput = d.querySelector('.subjName');
  if(firstInput) {
    setTimeout(()=> firstInput.focus(), 80);
  }

  return d;
}

// ---------- Generate QR ----------
function generateQR() {
  const idInput = $id("studentID");
  const nameInput = $id("studentName");
  const qrcodeDiv = $id("qrcode");
  const qrTextDiv = $id("qrText");
  const qrSection = $id("qrSection");
  const dl = $id("downloadBtn");

  // basic validation
  const id = idInput.value.trim();
  const name = nameInput.value.trim();
  if(!id || !name) {
    if(!id) markError(idInput);
    if(!name) markError(nameInput);
    showToast('Please enter Student ID and Full Name', 'error');
    return;
  }

  // gather subjects
  const subjects = [];
  let hasIncomplete = false;
  document.querySelectorAll('details.subject').forEach(det => {
    const subjInput = det.querySelector('.subjName');
    const startInput = det.querySelector('.startTime');
    const endInput = det.querySelector('.endTime');
    const subj = subjInput ? subjInput.value.trim() : '';
    const daysActive = Array.from(det.querySelectorAll('.chip.active')).map(c => c.dataset.day || c.textContent.trim());
    const days = daysActive.join('');
    const start = startInput ? startInput.value : '';
    const end = endInput ? endInput.value : '';

    // ignore truly empty card
    if(!subj && !days && !start && !end) return;

    if(subj && days && start && end) {
      subjects.push(`${subj}-${days}-${start}-${end}`);
    } else {
      hasIncomplete = true;
      if(!subj) markError(subjInput);
      if(!start) startInput && markError(startInput);
      if(!end) endInput && markError(endInput);
      if(!days) {
        const summary = det.querySelector('summary');
        if(summary) highlightSummary(summary);
      }
    }
  });

  if(subjects.length === 0) {
    showToast('Please add at least one complete subject', 'error');
    return;
  }

  if(hasIncomplete) {
    showToast('Some subjects are incomplete — highlighted fields indicate what’s missing', 'warning');
  } else {
    showToast('QR generated', 'success');
  }

  const payload = `${id}|${name}|${subjects.join(',')}`;

  // render QR
  qrcodeDiv.innerHTML = '';
  const dark = document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
  new QRCode(qrcodeDiv, {
    text: payload,
    width: 160,
    height: 160,
    colorDark: dark ? "#FFFFFF" : "#111111",
    colorLight: "transparent"
  });

  // show QR area with animation
  if(qrSection) {
    qrSection.style.display = 'block';
    qrSection.classList.remove('fade-in');
    void qrSection.offsetWidth;
    qrSection.classList.add('fade-in','show');
  }
  if(qrTextDiv) qrTextDiv.innerText = payload;
  if(dl) dl.style.display = 'inline-block';

  // scroll QR into view on small screens
  setTimeout(()=> {
    qrSection && qrSection.scrollIntoView({behavior:'smooth', block:'center'});
  }, 140);
}

// ---------- Download QR ----------
async function downloadQR() {
  const notify = (msg, type='info') => {
    if (typeof showToast === 'function') showToast(msg, type); else console.log(type, msg);
  };

  try {
    const qrcodeDiv = document.getElementById('qrcode');
    if (!qrcodeDiv) { notify('QR container (#qrcode) not found', 'error'); return; }

    // qrcodejs may render canvas or img
    const canvas = qrcodeDiv.querySelector('canvas');
    const img = qrcodeDiv.querySelector('img');
    let dataURL = '';

    if (canvas) {
      try {
        dataURL = canvas.toDataURL('image/png');
      } catch (err) {
        console.error('canvas.toDataURL error:', err);
      }
    }
    if (!dataURL && img) {
      dataURL = img.src;
    }
    if (!dataURL) {
      notify('No QR found to download', 'error');
      return;
    }

    // get student info from inputs (try many ids)
    const nameIds = ['fullName','studentName','full-name','name','full_name'];
    let fullName = '';
    for (const id of nameIds) {
      const el = document.getElementById(id);
      if (el && el.value && el.value.trim()) { fullName = el.value.trim(); break; }
    }
    // also check qrText payload if available
    if (!fullName) {
      const qrTextEl = document.getElementById('qrText') || document.querySelector('.payload') || null;
      if (qrTextEl) {
        const txt = (qrTextEl.textContent || qrTextEl.innerText || '').trim();
        if (txt) {
          const parts = txt.split('|');
          if (parts.length >= 2) fullName = parts[1].trim();
        }
      }
    }

    const idEl = document.getElementById('studentId') || document.getElementById('studentID') || document.getElementById('id');
    const studentId = idEl && idEl.value ? idEl.value.trim() : '';

    if (!fullName || !studentId) {
      notify('Student name or ID missing. Please fill them before saving.', 'error');
      // still allow local download, but warn
    }

    // determine last name
    let lastName = 'attendance';
    if (fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length) lastName = parts[parts.length - 1];
    }
    lastName = lastName.replace(/[^a-zA-Z0-9-_]/g, '') || 'attendance';
    const filename = `${lastName}_qr.png`;

    // 1) Download locally immediately
    try {
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify(`QR downloaded as ${filename}`, 'success');
    } catch (err) {
      console.error('local download error', err);
      notify('Local download failed (see console)', 'error');
    }

    // 2) POST to backend
    // get photo from global variable (your upload script should set window.studentPhoto)
    const photoData = window.studentPhoto || '';

    const payload = {
      id: studentId,
      name: fullName,
      lastName: lastName,
      qr: dataURL,
      photo: photoData
    };

    console.log('DEBUG: Sending payload to backend:', payload);
    // Use your backend URL
    const backendUrl = 'http://127.0.0.1:5000/save';

    // fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

    let resp;
    try {
      resp = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (err) {
      console.error('Network/fetch error sending to backend:', err);
      notify('Network error: could not contact backend. Make sure server is running and page served via http.', 'error');
      return;
    }

    const result = await resp.json().catch(e => {
      console.error('Error parsing JSON response:', e);
      return null;
    });
    console.log('DEBUG: backend response', resp, result);

    if (resp.ok) {
      notify(result && result.message ? result.message : 'Saved to backend', 'success');
      console.log('Saved files:', result.saved || result);
    } else {
      notify(`Backend error: ${result && result.error ? result.error : resp.statusText}`, 'error');
    }

  } catch (err) {
    console.error('downloadQR unexpected error', err);
    notify('Unexpected error (see console)', 'error');
  }
}

// ---------- Reset form (with animation) ----------
function resetForm() {
  const container = document.querySelector('.container');
  if(!container) return;
  container.classList.add('resetting');

  setTimeout(()=> {
    // clear fields
    $id('studentID').value = '';
    $id('studentName').value = '';
    $id('subjectsArea').innerHTML = '';
    const photoInput = $id('photo');
    if(photoInput){ photoInput.value = ''; }
    $id('photo-preview') && ($id('photo-preview').innerHTML = '');
    $id('photoFilename') && ($id('photoFilename').textContent = 'No file chosen');

    // clear QR
    $id('qrcode') && ($id('qrcode').innerHTML = '');
    $id('qrText') && ($id('qrText').innerText = '');
    const qrSection = $id('qrSection');
    if(qrSection){ qrSection.classList.remove('show','fade-in'); qrSection.style.display = 'none'; }

    const dl = $id('downloadBtn');
    if(dl) dl.style.display = 'none';

    container.classList.remove('resetting');
    showToast('Form reset', 'info');
    // focus
    $id('studentID') && $id('studentID').focus();
  }, 420); // wait for reset animation
}

// ---------- Photo upload wiring ----------
function wirePhoto() {
  const photoBtn = $id('photoBtn'), photoInput = $id('photo'), preview = $id('photo-preview'), filenameEl = $id('photoFilename'), removeBtn = $id('removePhoto');
  if(!photoBtn || !photoInput) return;

  photoBtn.addEventListener('click', ()=> photoInput.click());
  photoInput.addEventListener('change', (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if(preview) preview.innerHTML = `<img src="${ev.target.result}" alt="photo">`;
      if(removeBtn) removeBtn.style.display = 'inline-block';
      if(filenameEl) filenameEl.textContent = f.name;
      // store to global if you use it later
      window.studentPhoto = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
  if(removeBtn) removeBtn.addEventListener('click', ()=>{
    photoInput.value = '';
    preview && (preview.innerHTML = '');
    removeBtn.style.display = 'none';
    filenameEl && (filenameEl.textContent = 'No file chosen');
    window.studentPhoto = '';
  });
}

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', () => {
  // wire buttons
  const addBtn = $id('addSubject');
  const genBtn = $id('generateQR');
  const resetBtn = $id('resetBtn');
  const dlBtn = $id('downloadBtn');
  const darkToggle = document.querySelector('.dark-toggle');

  addBtn && addBtn.addEventListener('click', addSubject);
  genBtn && genBtn.addEventListener('click', generateQR);
  resetBtn && resetBtn.addEventListener('click', resetForm);
  dlBtn && dlBtn.addEventListener('click', downloadQR);
  darkToggle && darkToggle.addEventListener('click', ()=>{
    document.documentElement.classList.toggle('dark-mode');
    document.body.classList.toggle('dark-mode');
    darkToggle && darkToggle.addEventListener('click', ()=>{
  const root = document.documentElement;
  const isDark = root.classList.toggle('dark-mode');
  document.body.classList.toggle('dark-mode', isDark);

  // Add a temporary "mode-transition" class for smooth fade
  document.body.classList.add('mode-transition');
  setTimeout(()=> document.body.classList.remove('mode-transition'), 500);

  // Update icon
  darkToggle.textContent = isDark ? '☀️' : '🌙';
});

    // re-generate QR colors if qrcode exists (simple way: hide and show)
    const qrcodeDiv = $id('qrcode');
    if(qrcodeDiv && qrcodeDiv.childNodes.length > 0) {
      const old = qrcodeDiv.innerHTML;
      qrcodeDiv.innerHTML = '';
      // small delay then re-generate with same text
      setTimeout(()=> {
        const txt = $id('qrText') ? $id('qrText').innerText : '';
        if(txt) new QRCode(qrcodeDiv, { text: txt, width: 220, height: 220, colorDark: document.documentElement.classList.contains('dark-mode') ? "#FFFFFF" : "#111111", colorLight: "transparent" });
      }, 80);
    }
  });

  // photo wiring
  wirePhoto();

  // hide QR initially
  hideQRInitially();

  // page-level fade-in
  window.addEventListener('load', ()=> document.body.classList.add('loaded'));
});

darkToggle.addEventListener('click', () => {
  const root = document.documentElement;
  const setDark = !root.classList.contains('dark-mode');

  // Spin effect for button
  darkToggle.classList.add('spin');
  setTimeout(() => darkToggle.classList.remove('spin'), 400);

  if (setDark) {
    root.classList.add('dark-mode');
    darkToggle.textContent = '☀️';
    try { localStorage.setItem('attendance_dark', '1'); } catch (e) {}
  } else {
    root.classList.remove('dark-mode');
    darkToggle.textContent = '🌙';
    try { localStorage.setItem('attendance_dark', '0'); } catch (e) {}
  }
});

// Run after DOM is ready (put inside DOMContentLoaded or at end of script)
document.querySelectorAll('.container .topbar').forEach(tb => {
  const toggle = tb.querySelector('.dark-toggle') || tb.querySelector('#darkToggle');
  const title = tb.querySelector('h1');
  if (title) {
    // ensure title can shrink in a flex layout
    title.style.minWidth = '0';
    title.style.whiteSpace = 'nowrap';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
  }
  if (toggle && tb.lastElementChild !== toggle) {
    // move toggle to be the last child so it sits at the far right
    tb.appendChild(toggle);
  }
});

saveToServer(studentId, fullName, scheduleData, photoBase64, qrBase64);

async function saveToServer(id, name, schedule, photoBase64, qrBase64) {
  try {
    const response = await fetch("http://127.0.0.1:5000/save_student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id,
        name: name,
        schedule: schedule,
        photo: photoBase64,
        qr: qrBase64
      })
    });
    const result = await response.json();
    console.log(result);
    alert("Student record saved successfully!");
  } catch (err) {
    console.error(err);
    alert("Error saving student record.");
  }

}
