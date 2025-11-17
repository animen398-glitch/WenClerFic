const API_BASE = 'http://localhost:3000/api';

let currentUser = null;
let ficId = null;
let currentFic = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  getFicId();
  if (ficId) {
    loadFic();
    setupEventListeners();
  }
});

function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    updateUserUI();
  } else {
    alert('Войдите, чтобы добавить главу');
    window.location.href = '/';
  }
}

function updateUserUI() {
  const userNameEl = document.getElementById('user-name');
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
  }
}

function getFicId() {
  const path = window.location.pathname;
  const match = path.match(/\/fic\/(\d+)\/addpart/);
  ficId = match ? match[1] : null;
}

async function loadFic() {
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}`);
    const data = await response.json();

    if (response.ok) {
      currentFic = data;
      
      // Check if user is the author
      if (currentUser && data.authorId !== currentUser.id) {
        alert('Вы можете добавлять главы только к своим фанфикам');
        window.location.href = `/fic/${ficId}`;
        return;
      }

      document.getElementById('fic-info').textContent = `Фанфик: ${data.title}`;
    } else {
      showError(data.error || 'Ошибка загрузки фанфика');
    }
  } catch (error) {
    console.error('Error loading fic:', error);
    showError('Ошибка подключения к серверу');
  }
}

function setupEventListeners() {
  const form = document.getElementById('add-chapter-form');
  const cancelBtn = document.getElementById('cancel-btn');
  const contentTextarea = document.getElementById('chapter-content');

  form.addEventListener('submit', handleSubmit);
  cancelBtn.addEventListener('click', () => {
    if (confirm('Вы уверены? Все несохраненные данные будут потеряны.')) {
      window.location.href = `/fic/${ficId}`;
    }
  });

  contentTextarea.addEventListener('input', () => {
    const words = contentTextarea.value.trim().split(/\s+/).filter(w => w).length;
    document.getElementById('content-word-count').textContent = words;
  });
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    alert('Войдите, чтобы добавить главу');
    return;
  }

  const formData = new FormData(e.target);
  const chapterData = {
    title: formData.get('title'),
    content: formData.get('content')
  };

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Добавление...';

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/fics/${ficId}/chapters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(chapterData)
    });

    const data = await response.json();

    if (response.ok) {
      alert('Глава успешно добавлена!');
      window.location.href = `/fic/${ficId}`;
    } else {
      alert(data.error || 'Ошибка при добавлении главы');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Добавить главу';
    }
  } catch (error) {
    console.error('Error adding chapter:', error);
    alert('Ошибка подключения к серверу');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Добавить главу';
  }
}

function showError(message) {
  const container = document.querySelector('.main-content .container');
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem;">
      <h2 style="color: var(--error); margin-bottom: 1rem;">Ошибка</h2>
      <p style="color: var(--text-secondary);">${message}</p>
      <a href="/" class="btn btn-primary" style="margin-top: 1rem;">Вернуться на главную</a>
    </div>
  `;
}

