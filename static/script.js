/* script.js — Complete fixed version */
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing...');
  
  // ---------- Helpers ----------
  function mk(q) { return document.querySelector(q); }
  function $id(id) { return document.getElementById(id); }

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
    if (!el) return;
    el.classList.add('error', 'shake');
    // remove shake quickly but keep error for 5s
    setTimeout(() => el.classList.remove('shake'), 600);
    setTimeout(() => { if (el && el.classList) el.classList.remove('error'); }, 5000);
  }

  function highlightSummary(summaryEl) {
    if (!summaryEl) return;
    summaryEl.classList.add('summary-error');
    const parent = summaryEl.closest('details');
    if (parent) parent.classList.add('summary-error');
    setTimeout(() => {
      summaryEl.classList.remove('summary-error');
      parent && parent.classList.remove('summary-error');
    }, 5000);
  }

  // ensure QR hidden on load
  function hideQRInitially() {
    const qrSection = $id('qrSection');
    const dl = $id('downloadBtn');
    if (qrSection) { qrSection.classList.remove('show'); qrSection.style.display = 'none'; }
    if (dl) dl.style.display = 'none';
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
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day =>
      `<div class="chip" data-day="${day}">${day}</div>`
    ).join('')}
        </div>

        <label>⏰ Start Time</label>
        <input type="time" class="startTime">

        <label>⏰ End Time</label>
        <input type="time" class="endTime">
      </div>
    `;

    // add fade-in animation
    d.style.animation = 'fadeInSubject 0.36s ease';

    const area = $id('subjectsArea');
    area.appendChild(d);

    // wire remove button with animation
    const rem = d.querySelector('.remove-subject');
    rem.addEventListener('click', () => {
      d.classList.add('removing');
      setTimeout(() => d.remove(), 360);
    });

    // wire chips
    d.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('active'));
    });

    // autofocus the subject name
    const firstInput = d.querySelector('.subjName');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 80);
    }

    return d;
  }

  // helper: build schedule array
  function collectScheduleArray() {
    const schedule = [];
    document.querySelectorAll('details.subject').forEach(det => {
      const subj = (det.querySelector('.subjName')?.value || '').trim();
      const days = Array.from(det.querySelectorAll('.chip.active')).map(c => c.dataset.day || c.textContent.trim());
      const start = det.querySelector('.startTime')?.value || '';
      const end = det.querySelector('.endTime')?.value || '';
      if (subj || days.length || start || end) {
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
    const qrcodeDiv = $id("qrcode");
    const qrTextDiv = $id("qrText");
    const qrSection = $id("qrSection");
    const dl = $id("downloadBtn");

    // basic validation
    const id = (idInput && idInput.value) ? idInput.value.trim() : '';
    const name = (nameInput && nameInput.value) ? nameInput.value.trim() : '';
    if (!id || !name) {
      if (!id && idInput) markError(idInput);
      if (!name && nameInput) markError(nameInput);
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
      if (!subj && !days && !start && !end) return;

      if (subj && days && start && end) {
        subjects.push(`${subj}-${days}-${start}-${end}`);
      } else {
        hasIncomplete = true;
        if (!subj) markError(subjInput);
        if (!start) startInput && markError(startInput);
        if (!end) endInput && markError(endInput);
        if (!days) {
          const summary = det.querySelector('summary');
          if (summary) highlightSummary(summary);
        }
      }
    });

    if (subjects.length === 0) {
      showToast('Please add at least one complete subject', 'error');
      return;
    }

    if (hasIncomplete) {
      showToast('Some subjects are incomplete — highlighted fields indicate what\'s missing', 'warning');
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
    if (qrSection) {
      qrSection.style.display = 'block';
      qrSection.classList.remove('fade-in');
      void qrSection.offsetWidth;
      qrSection.classList.add('fade-in', 'show');
    }
    if (qrTextDiv) qrTextDiv.innerText = payload;
    if (dl) dl.style.display = 'inline-block';

    // scroll QR into view on small screens
    setTimeout(() => {
      qrSection && qrSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // Create filename using last name or fallback
    let filename = 'qr_code.png';
    if (fullName) {
      // Extract last name from full name
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        filename = `${parts[parts.length - 1]}_qr.png`;
      } else {
        filename = `${fullName}_qr.png`;
      }
    } else if (studentId) {
      filename = `${studentId}_qr.png`;
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
    try {
      // Get form values
      const studentId = $id('studentId') ? $id('studentId').value.trim() : '';
      const fullName = $id('name') ? $id('name').value.trim() : '';
      const photoData = window.studentPhoto || '';

      // Get QR code data
      const qrcodeDiv = $id('qrcode');
      let qrData = '';
      if (qrcodeDiv) {
        const canvas = qrcodeDiv.querySelector('canvas');
        const img = qrcodeDiv.querySelector('img');
        if (canvas) {
          qrData = canvas.toDataURL('image/png');
        } else if (img) {
          qrData = img.src;
        }
      }

      // Validation
      if (!studentId || !fullName) {
        showToast('Student ID and Full Name are required.', 'error');
        return;
      }

      if (!qrData) {
        showToast('Please generate a QR code first.', 'error');
        return;
      }

      // Extract last name from full name
      let lastName = 'attendance';
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      if (nameParts.length > 0) {
        lastName = nameParts[nameParts.length - 1];
      }

      const payload = {
        id: studentId,
        name: fullName,
        lastName: lastName,
        qr: qrData,
        photo: photoData
      };

      console.log('Saving to server:', payload);

      // Send to server
      showToast('Saving to server...', 'info');
      
      const response = await fetch('https://tmcfi-attendace-qr-code-generator.onrender.com/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        showToast(result.message || 'Saved successfully!', 'success');
        console.log('Server response:', result);
      } else {
        showToast(result.error || 'Error saving to server', 'error');
      }

      return result;
    } catch (error) {
      console.error('Error saving to server:', error);
      showToast('Failed to save to server. Please try again.', 'error');
      throw error;
    }
  }

  // ---------- Reset form ----------
  function resetForm() {
    const container = document.querySelector('.container');
    if (!container) return;
    container.classList.add('resetting');

    setTimeout(() => {
      // clear fields
      if ($id('studentId')) $id('studentId').value = '';
      if ($id('name')) $id('name').value = '';
      if ($id('subjectsArea')) $id('subjectsArea').innerHTML = '';
      
      const photoInputEl = $id('photoInput');
      if (photoInputEl) photoInputEl.value = '';
      
      if ($id('photo-preview')) $id('photo-preview').innerHTML = '';
      if ($id('photoFilename')) $id('photoFilename').textContent = 'No file chosen';

      // clear QR
      if ($id('qrcode')) $id('qrcode').innerHTML = '';
      if ($id('qrText')) $id('qrText').innerText = '';
      
      const qrSection = $id('qrSection');
      if (qrSection) {
        qrSection.classList.remove('show', 'fade-in');
        qrSection.style.display = 'none';
      }

      const dl = $id('downloadBtn');
      if (dl) dl.style.display = 'none';

      container.classList.remove('resetting');
      showToast('Form reset', 'info');
      
      // focus on first field
      if ($id('studentId')) $id('studentId').focus();
    }, 420);
  }

  // ---------- Photo upload wiring ----------
  function wirePhoto() {
    const photoBtn = $id('photoBtn');
    const photoInput = $id('photoInput');
    const preview = $id('photo-preview');
    const filenameEl = $id('photoFilename');
    const removeBtn = $id('removePhoto');

    if (!photoBtn || !photoInput) return;

    photoBtn.addEventListener('click', () => photoInput.click());
    
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (preview) preview.innerHTML = `<img src="${event.target.result}" alt="Student photo">`;
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (filenameEl) filenameEl.textContent = file.name;
        window.studentPhoto = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        if (photoInput) photoInput.value = '';
        if (preview) preview.innerHTML = '';
        if (removeBtn) removeBtn.style.display = 'none';
        if (filenameEl) filenameEl.textContent = 'No file chosen';
        window.studentPhoto = '';
      });
    }
  }

  // ---------- Initialize everything ----------
  function initializeApp() {
    console.log('Initializing app...');
    
    // Wire up all buttons
    const addBtn = $id('addSubject');
    const genBtn = $id('generateBtn');
    const resetBtn = $id('resetBtn');
    const dlBtn = $id('downloadBtn');
    const saveBtn = $id('saveBtn');

    if (addBtn) {
      addBtn.addEventListener('click', addSubject);
      console.log('Add subject button wired');
    }

    if (genBtn) {
      genBtn.addEventListener('click', generateQR);
      console.log('Generate QR button wired');
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetForm);
      console.log('Reset button wired');
    }

    if (dlBtn) {
      dlBtn.addEventListener('click', downloadQRLocally);
      console.log('Download button wired');
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', saveToServer);
      console.log('Save button wired');
    }

    // Dark mode toggle
    const darkToggle = document.querySelector('.dark-toggle') || $id('darkToggle');
    if (darkToggle) {
      darkToggle.addEventListener('click', () => {
        const root = document.documentElement;
        const isDark = root.classList.toggle('dark-mode');
        document.body.classList.toggle('dark-mode', isDark);
        darkToggle.textContent = isDark ? '☀️' : '🌙';

        // Re-render QR with new colors if it exists
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
    }

    // Photo upload functionality
    wirePhoto();
    console.log('Photo upload wired');

    // Hide QR initially
    hideQRInitially();
    console.log('QR hidden initially');

    // Add one initial subject
    addSubject();
    
    // Page loaded animation
    document.body.classList.add('loaded');
    console.log('App initialized successfully');
  }

  // Start the app
  initializeApp();
});
