/* script.js — fixed for the HTML you provided and pointing to Render backend */

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

// helper: build schedule array (used by saveToServer potentially)
function collectScheduleArray() {
  const schedule = [];
  document.querySelectorAll('details.subject').forEach(det => {
    const subj = (det.querySelector('.subjName')?.value || '').trim();
    const days = Array.from(det.querySelectorAll('.chip.active')).map(c => c.dataset.day || c.textContent.trim());
    const start = det.querySelector('.startTime')?.value || '';
    const end = det.querySelector('.endTime')?.value || '';
    if(subj || days.length || start || end) {
      schedule.push({ subject: subj, days, start, end });
    }
  });
  return schedule;
}

// ---------- Generate QR ----------
function generateQR() {
  if (typeof QRCode === 'undefined') {
    showToast('QR library not loaded. Check the included script.', 'error');
    return;
  }

  // match HTML IDs
  const idInput = $id("studentId");
  const nameInput = $id("name");
  const lastNameInput = $id("lastName");
  const qrcodeDiv = $id("qrcode");
  const qrTextDiv = $id("qrText");
  const qrSection = $id("qrSection");
  const dl = $id("downloadBtn");

  // basic validation
  const id = (idInput && idInput.value) ? idInput.value.trim() : '';
  const name = (nameInput && nameInput.value) ? nameInput.value.trim() : '';
  const lastName = (lastNameInput && lastNameInput.value) ? lastNameInput.value.trim() : '';
  
  if(!id || !name) {
    if(!id && idInput) markError(idInput);
    if(!name && nameInput) markError(nameInput);
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
    showToast('Some subjects are incomplete — highlighted fields indicate what\'s missing', 'warning');
  } else {
    showToast('QR generated', 'success');
  }

  const payload = `${id}|${name}|${lastName}|${subjects.join(',')}`;

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

// ---------- Download QR (local only) ----------
function downloadQRLocally() {
  const qrcodeDiv = document.getElementById('qrcode');
  if (!qrcodeDiv) { 
    showToast('QR code not found. Please generate it first.', 'error'); 
    return; 
  }

  // Get student info for filename
  const fullName = ($id('name') && $id('name').value) ? $id('name').value.trim() : '';
  const studentId = ($id('studentId') && $id('studentId').value) ? $id('studentId').value.trim() : '';
  const lastName = ($id('lastName') && $id('lastName').value) ? $id('lastName').value.trim() : '';
  
  // Create filename using last name
  let filename = 'qr_code.png'; // default
  if (lastName) {
    filename = `${lastName}_qr.png`;
  } else if (fullName) {
    // Extract last name from full name if separate field not available
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      filename = `${parts[parts.length - 1]}_qr.png`;
    } else {
      filename = `${fullName}_qr.png`;
    }
  }

  // Get QR image data
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
    showToast('No QR code found to download', 'error');
    return;
  }

  // Download the file
  try {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`QR downloaded as ${filename}`, 'success');
  } catch (err) {
    console.error('Download error:', err);
    showToast('Failed to download QR code', 'error');
  }
}

// ---------- Save to Server ----------
async function saveToServer() {
  const studentId = $id('studentId').value.trim();
  const fullName = $id('name').value.trim();
  const lastName = $id('lastName').value.trim();
  const photoData = window.studentPhoto || '';
  
  // Get QR code data
  const qrcodeDiv = $id('qrcode');
  let qrData = '';
  if (qrcodeDiv) {
    const canvas = qrcodeDiv.querySelector('canvas');
    const img = qrcodeDiv.querySelector('img');
    if (canvas) {
      try {
        qrData = canvas.toDataURL('image/png');
      } catch (err) {
        console.error('Error getting QR data from canvas:', err);
      }
    } else if (img) {
      qrData = img.src;
    }
  }

  if (!studentId || !fullName || !qrData) {
    showToast('Missing Student ID, Full Name, or QR code. Please generate first.', 'error');
    return;
  }

  // Use the provided last name or extract from full name
  let finalLastName = lastName;
  if (!finalLastName && fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length) {
      finalLastName = parts[parts.length - 1];
    }
  }
  finalLastName = finalLastName || 'attendance';

  const payload = {
    id: studentId,
    name: fullName,
    lastName: finalLastName,
    qr: qrData,
    photo: photoData
  };

  try {
    const resp = await fetch('https://tmcfi-attendace-qr-code-generator.onrender.com/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await resp.json();
    if (resp.ok) {
      showToast(result.message || 'Saved to server successfully!', 'success');
      console.log('Saved files:', result.saved);
    } else {
      showToast(`Server error: ${result.error || resp.statusText}`, 'error');
    }
  } catch (err) {
    console.error('saveToServer error:', err);
    showToast('Error saving to server. Please check your connection.', 'error');
  }
}

// ---------- Reset form (with animation) ----------
function resetForm() {
  const container = document.querySelector('.container');
  if(!container) return;
  container.classList.add('resetting');

  setTimeout(()=> {
    // clear fields (match HTML IDs)
    $id('studentId') && ($id('studentId').value = '');
    $id('name') && ($id('name').value = '');
    $id('lastName') && ($id('lastName').value = '');
    $id('subjectsArea') && ($id('subjectsArea').innerHTML = '');
    const photoInputEl = $id('photoInput');
    if(photoInputEl){ photoInputEl.value = ''; }
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
    $id('studentId') && $id('studentId').focus();
  }, 420); // wait for reset animation
}

// ---------- Photo upload wiring ----------
function wirePhoto() {
  // match HTML IDs
  const photoBtn = $id('photoBtn'),
        photoInput = $id('photoInput'),
        preview = $id('photo-preview'),
        filenameEl = $id('photoFilename'),
        removeBtn = $id('removePhoto');

  if(!photoBtn || !photoInput) return;

  // Remove any existing event listeners to prevent duplication
  photoBtn.replaceWith(photoBtn.cloneNode(true));
  photoInput.replaceWith(photoInput.cloneNode(true));
  if (removeBtn) removeBtn.replaceWith(removeBtn.cloneNode(true));
  
  // Get fresh references to the cloned elements
  const newPhotoBtn = $id('photoBtn');
  const newPhotoInput = $id('photoInput');
  const newRemoveBtn = $id('removePhoto');

  newPhotoBtn.addEventListener('click', () => newPhotoInput.click());
  newPhotoInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if(preview) preview.innerHTML = `<img src="${ev.target.result}" alt="photo">`;
      if(newRemoveBtn) newRemoveBtn.style.display = 'inline-block';
      if(filenameEl) filenameEl.textContent = f.name;
      // store to global if you use it later
      window.studentPhoto = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
  
  if(newRemoveBtn) {
    newRemoveBtn.addEventListener('click', () => {
      newPhotoInput.value = '';
      preview && (preview.innerHTML = '');
      newRemoveBtn.style.display = 'none';
      filenameEl && (filenameEl.textContent = 'No file chosen');
      window.studentPhoto = '';
    });
  }
}

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', () => {
  // wire buttons (match HTML IDs)
  const addBtn = $id('addSubject');
  const genBtn = $id('generateBtn');
  const resetBtn = $id('resetBtn');
  const dlBtn = $id('downloadBtn');
  const saveBtn = $id('saveBtn');
  const darkToggle = document.querySelector('.dark-toggle') || $id('darkToggle');

  // Remove any existing event listeners first
  const clearEventListeners = (element) => {
    if (!element) return;
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
    return newElement;
  };

  // Clear and reattach event listeners
  const newAddBtn = clearEventListeners(addBtn);
  const newGenBtn = clearEventListeners(genBtn);
  const newResetBtn = clearEventListeners(resetBtn);
  const newDlBtn = clearEventListeners(dlBtn);
  const newSaveBtn = clearEventListeners(saveBtn);
  const newDarkToggle = clearEventListeners(darkToggle);

  // Attach fresh event listeners
  newAddBtn && newAddBtn.addEventListener('click', addSubject);
  newGenBtn && newGenBtn.addEventListener('click', generateQR);
  newResetBtn && newResetBtn.addEventListener('click', resetForm);
  newDlBtn && newDlBtn.addEventListener('click', downloadQRLocally);
  newSaveBtn && newSaveBtn.addEventListener('click', saveToServer);

  // single dark-toggle handler
  newDarkToggle && newDarkToggle.addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = root.classList.toggle('dark-mode');
    document.body.classList.toggle('dark-mode', isDark);
    newDarkToggle.textContent = isDark ? '☀️' : '🌙';

    // re-render QR with new colors (if exists)
    const qrcodeDiv = $id('qrcode');
    const txt = $id('qrText') ? $id('qrText').innerText : '';
    if (qrcodeDiv && txt) {
      qrcodeDiv.innerHTML = '';
      new QRCode(qrcodeDiv, { 
        text: txt, 
        width: 160, 
        height: 160, 
        colorDark: isDark ? "#FFFFFF" : "#111111", 
        colorLight: "transparent" 
      });
    }
  });

  // photo wiring
  wirePhoto();

  // hide QR initially
  hideQRInitially();

  // page-level fade-in
  window.addEventListener('load', () => document.body.classList.add('loaded'));
});
