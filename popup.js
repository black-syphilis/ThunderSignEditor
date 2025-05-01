function showError(msg) {
  const err = document.getElementById('errors');
  err.textContent = msg;
  err.classList.add('visible');
  setTimeout(() => err.classList.remove('visible'), 5000);
}

// Convert Quill classes to inline styles
function convertQuillClassesToInlineStyles(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Font sizes
  doc.querySelectorAll('.ql-size-small').forEach(el => {
    el.style.fontSize = '0.75em';
    el.classList.remove('ql-size-small');
  });
  doc.querySelectorAll('.ql-size-large').forEach(el => {
    el.style.fontSize = '1.5em';
    el.classList.remove('ql-size-large');
  });
  doc.querySelectorAll('.ql-size-huge').forEach(el => {
    el.style.fontSize = '2.5em';
    el.classList.remove('ql-size-huge');
  });

  // Fonts
  doc.querySelectorAll('.ql-font-serif').forEach(el => {
    el.style.fontFamily = 'Georgia, Times New Roman, serif';
    el.classList.remove('ql-font-serif');
  });
  doc.querySelectorAll('.ql-font-monospace').forEach(el => {
    el.style.fontFamily = 'Monaco, Courier New, monospace';
    el.classList.remove('ql-font-monospace');
  });

  // Text color
  doc.querySelectorAll('[class*="ql-color-"]').forEach(el => {
    const colorClasses = Array.from(el.classList).filter(c => c.startsWith('ql-color-'));
    colorClasses.forEach(colorClass => {
      const color = '#' + colorClass.replace('ql-color-', '');
      el.style.color = color;
      el.classList.remove(colorClass);
    });
  });

  // Background color
  doc.querySelectorAll('[class*="ql-bg-"]').forEach(el => {
    const bgClasses = Array.from(el.classList).filter(c => c.startsWith('ql-bg-'));
    bgClasses.forEach(bgClass => {
      const color = '#' + bgClass.replace('ql-bg-', '');
      el.style.backgroundColor = color;
      el.classList.remove(bgClass);
    });
  });

  // Paragraph formatting
  doc.querySelectorAll('p').forEach(p => {
    p.style.margin = "0";
    p.style.lineHeight = "1.2"; 
  });

  return doc.body.innerHTML;
}

// Sanitize HTML to prevent script injection
function sanitizeHTML(html) {
  if (/<script[\s>]/i.test(html) || /<iframe[\s>]/i.test(html)) {
    throw new Error("<script> or <iframe> tags are not allowed!");
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  if (doc.querySelector('parsererror')) {
    throw new Error("Malformed HTML!");
  }
  return html;
}

// Load available email identities
async function loadIdentities() {
  try {
    const response = await browser.runtime.sendMessage({ action: "getIdentities" });
    if (!response.success) throw new Error(response.error || "Unknown error");
    identities = response.identities;
    const select = document.getElementById('identities');
    select.innerHTML = '';
    if (!identities || identities.length === 0) {
      showError("Signature successfully applied!");
      return;
    }
    identities.forEach(id => {
      const opt = document.createElement('option');
      opt.value = id.id;
      opt.textContent = id.label || id.email;
      select.appendChild(opt);
    });
  } catch (e) {
    showError("Error during account loading: " + e.message);
    console.error(e);
  }
}

// Apply the current signature to selected identity
async function applySignature() {
  try {
    let html = quill.root.innerHTML;
    html = convertQuillClassesToInlineStyles(html);
    sanitizeHTML(html);
    const id = document.getElementById('identities').value;
    const response = await browser.runtime.sendMessage({
      action: "updateSignature",
      id: id,
      html: html
    });
    if (!response.success) throw new Error(response.error || "Unknown error");
    showError("Signature successfully applied!");
    await browser.storage.local.set({ lastSignature: html });
  } catch (e) {
    showError("Loading error: " + e.message);
  }
}

// Copy signature to clipboard
function copySignature() {
  try {
    let html = quill.root.innerHTML;
    html = convertQuillClassesToInlineStyles(html);
    sanitizeHTML(html);
    navigator.clipboard.writeText(html);
    showError("Signature copied!");
  } catch (e) {
    showError("Copy error: " + e.message);
  }
}

// Reset the editor to default state
function resetEditor() {
  quill.setContents([{ insert: '\n' }]);
}

// Load the last saved signature from local storage
async function preloadSignature() {
  try {
    const data = await browser.storage.local.get('lastSignature');
    if (data.lastSignature) {
      quill.root.innerHTML = data.lastSignature;
    }
  } catch (e) {
    showError("Error during account loading: " + e.message);
  }
}

// Prompt for an image URL and insert it
function addImageFromURL() {
  const url = prompt("Enter picture URL (Recommended HTTPS):");
  if (url && /^https?:\/\/.+\.(jpg|jpeg|png|gif|svg)$/i.test(url)) {
    quill.insertEmbed(quill.getSelection()?.index || 0, 'image', url);
  } else if (url) {
    showError("Invalid picture URL!");
  }
}

// Initialize Quill and bind UI events
document.addEventListener('DOMContentLoaded', async () => {
  quill = new Quill('#editor', {
    modules: {
      toolbar: {
        container: '#editor-toolbar'
      }
    },
    formats: ['bold', 'italic', 'underline', 'strike', 'list', 'color', 'background', 'font', 'size', 'link', 'image'],
    theme: 'snow'
  });

  // Text color picker
  document.getElementById('color-picker-btn').addEventListener('click', () => {
    let input = document.createElement('input');
    input.type = 'color';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
    input.addEventListener('input', () => {
      const range = quill.getSelection();
      if (range) {
        quill.format('color', input.value);
      }
      document.body.removeChild(input);
    });
  });

  // Background color picker
  document.getElementById('bgcolor-picker-btn').addEventListener('click', () => {
    let input = document.createElement('input');
    input.type = 'color';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
    input.addEventListener('input', () => {
      const range = quill.getSelection();
      if (range) {
        quill.format('background', input.value);
      }
      document.body.removeChild(input);
    });
  });

  await loadIdentities();
  await preloadSignature();

  // Save signature on every text change
  quill.on('text-change', async () => {
    await browser.storage.local.set({ lastSignature: quill.root.innerHTML });
  });

  document.getElementById('apply').addEventListener('click', applySignature);
  document.getElementById('copy').addEventListener('click', copySignature);
  document.getElementById('reset').addEventListener('click', resetEditor);
  document.getElementById('add-image').addEventListener('click', addImageFromURL);
});
