let userToken = localStorage.getItem('filebox_token');

if (userToken) {
  openDashboard();
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
    msgBox.style.color = '#c0392b';
    msgBox.innerText = data.error;
    return;
  }

  if (action === 'register') {
    msgBox.style.color = '#27ae60';
    msgBox.innerText = 'Registered successfully! Now click Login.';
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
  document.getElementById('display-username').innerText = 'User: ' + localStorage.getItem('filebox_username') + ' ';
  loadUserFiles();
}

function logoutUser() {
  localStorage.removeItem('filebox_token');
  localStorage.removeItem('filebox_username');
  location.reload();
}

async function uploadSelectedFile() {
  const input = document.getElementById('file-input');
  if (!input.files.length) {
    alert('Please select a file first.');
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

  if (files.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No files uploaded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = files.map(function (file) {
    const sizeKB = (file.file_size / 1024).toFixed(1);
    const dateStr = new Date(file.created_at).toLocaleDateString();
    return `
      <tr>
        <td>${file.file_name}</td>
        <td>${sizeKB} KB</td>
        <td>${dateStr}</td>
        <td class="actions-group">
          <button class="btn btn-blue" onclick="downloadPrivateFile(${file.id}, '${file.file_name}')">Download</button>
          <button class="btn btn-green" onclick="createShareLink(${file.id})">Share (24h)</button>
          <button class="btn btn-red" onclick="removeFile(${file.id})">Delete</button>
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