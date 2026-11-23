let userToken = localStorage.getItem('filebox_token');
let currentAuthMode = 'login';

if (userToken) {
  openDashboard();
}

// Switch between Login and Register tabs
function switchAuthMode(mode) {
  currentAuthMode = mode;
  document.getElementById('msg-box').innerText = '';
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('auth-submit-btn').innerText =
    mode === 'login' ? 'Sign In to Vault' : 'Create Free Account';
}

// Show / Hide password text
function togglePassword() {
  const passInput = document.getElementById('pass-field');
  const toggleBtn = document.querySelector('.toggle-pass');
  if (passInput.type === 'password') {
    passInput.type = 'text';
    toggleBtn.innerText = 'Hide';
  } else {
    passInput.type = 'password';
    toggleBtn.innerText = 'Show';
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  submitAuth(currentAuthMode);
}

async function submitAuth(action) {
  const username = document.getElementById('user-field').value;
  const password = document.getElementById('pass-field').value;
  const msgBox = document.getElementById('msg-box');

  const res = await fetch('/api/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  });

  const data = await res.json();
  if (!res.ok) {
    msgBox.style.color = '#dc2626';
    msgBox.innerText = data.error;
    return;
  }

  if (action === 'register') {
    switchAuthMode('login');
    msgBox.style.color = '#059669';
    msgBox.innerText = 'Account created! Please sign in now.';
    return;
  }

  localStorage.setItem('filebox_token', data.token);
  localStorage.setItem('filebox_username', data.username);
  userToken = data.token;
  openDashboard();
}

function openDashboard() {
  document.getElementById('login-card').classList.add('hidden');
  document.getElementById('app-card').classList.remove('hidden');
  document.getElementById('user-area').classList.remove('hidden');
  document.getElementById('display-username').innerText = '@' + localStorage.getItem('filebox_username');
  setupDragAndDrop();
  loadUserFiles();
}

function logoutUser() {
  localStorage.removeItem('filebox_token');
  localStorage.removeItem('filebox_username');
  location.reload();
}

// Drag & Drop handlers
function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateSelectedFileName();
    }
  });
}

function updateSelectedFileName() {
  const input = document.getElementById('file-input');
  const label = document.getElementById('selected-file-name');
  if (input.files.length) {
    const sizeMB = (input.files[0].size / (1024 * 1024)).toFixed(2);
    label.innerText = `Selected: ${input.files[0].name} (${sizeMB} MB)`;
    label.style.color = '#2563eb';
    label.style.fontWeight = '600';
  }
}

async function uploadSelectedFile() {
  const input = document.getElementById('file-input');
  if (!input.files.length) {
    alert('Please select or drop a file first.');
    return;
  }

  const formData = new FormData();
  formData.append('myFile', input.files[0]);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + userToken },
    body: formData
  });

  if (res.ok) {
    input.value = '';
    const label = document.getElementById('selected-file-name');
    label.innerText = 'Supports PDF, Docs, Images, Archives (Max 50 MB)';
    label.style.color = '#64748b';
    label.style.fontWeight = 'normal';
    loadUserFiles();
  } else {
    const errData = await res.json();
    alert(errData.error || 'Upload failed.');
  }
}

async function loadUserFiles() {
  const res = await fetch('/api/files', {
    headers: { 'Authorization': 'Bearer ' + userToken }
  });
  const files = await res.json();
  const tbody = document.getElementById('table-body');
  document.getElementById('file-count').innerText = files.length + (files.length === 1 ? ' file' : ' files');

  if (files.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:24px;">Your vault is empty. Upload your first file above!</td></tr>';
    return;
  }

  tbody.innerHTML = files.map(function (file) {
    const sizeKB = (file.file_size / 1024).toFixed(1);
    const dateStr = new Date(file.created_at).toLocaleDateString();
    const ext = file.file_name.includes('.') ? file.file_name.split('.').pop().toUpperCase() : 'FILE';
    return `
      <tr>
        <td><strong>${file.file_name}</strong></td>
        <td><span class="ext-badge">${ext}</span></td>
        <td>${sizeKB} KB</td>
        <td>${dateStr}</td>
        <td class="actions-group">
          <button class="btn btn-sm btn-download" onclick="downloadPrivateFile(${file.id}, '${file.file_name}')">Download</button>
          <button class="btn btn-sm btn-share" onclick="createShareLink(${file.id})">Share (24h)</button>
          <button class="btn btn-sm btn-delete" onclick="removeFile(${file.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function downloadPrivateFile(id, fileName) {
  const res = await fetch('/api/files/' + id + '/download', {
    headers: { 'Authorization': 'Bearer ' + userToken }
  });
  const blob = await res.blob();
  const tempUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = tempUrl;
  anchor.download = fileName;
  anchor.click();
}

async function createShareLink(id) {
  const res = await fetch('/api/files/' + id + '/share', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + userToken }
  });
  const data = await res.json();
  if (res.ok) {
    prompt('Copy this 24-hour public share link:', data.shareLink);
  }
}

async function removeFile(id) {
  if (!confirm('Delete this file permanently?')) return;
  await fetch('/api/files/' + id, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + userToken }
  });
  loadUserFiles();
}