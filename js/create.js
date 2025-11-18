// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  setupCharCounter();
});

function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    updateUserUI();
  } else {
    // Redirect to login if not authenticated
    alert('Войдите, чтобы создать фанфик');
    window.location.href = '/';
  }
}

function updateUserUI() {
  const userNameEl = document.getElementById('user-name');
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
  }
}

function setupEventListeners() {
  const form = document.getElementById('create-fic-form');
  const cancelBtn = document.getElementById('cancel-btn');

  form.addEventListener('submit', handleSubmit);
  cancelBtn.addEventListener('click', () => {
    if (confirm('Вы уверены? Все несохраненные данные будут потеряны.')) {
      window.location.href = '/';
    }
  });
}

function setupCharCounter() {
  const descTextarea = document.getElementById('fic-description');
  const charCount = document.getElementById('desc-char-count');

  descTextarea.addEventListener('input', () => {
    charCount.textContent = descTextarea.value.length;
  });
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    alert('Войдите, чтобы создать фанфик');
    return;
  }

  const formData = new FormData(e.target);
  const tagsInput = document.getElementById('fic-tags').value;
  const tags = tagsInput
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);

  const ficData = {
    title: formData.get('title'),
    description: formData.get('description'),
    genre: formData.get('genre'),
    rating: formData.get('rating'),
    status: formData.get('status') || 'ongoing',
    tags: tags
  };

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Создание...';

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/fics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(ficData)
    });

    const data = await response.json();

    if (response.ok) {
      alert('Фанфик успешно создан!');
      window.location.href = `/fic/${data.id}`;
    } else {
      alert(data.error || 'Ошибка при создании фанфика');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Создать фанфик';
    }
  } catch (error) {
    console.error('Error creating fic:', error);
    alert('Ошибка подключения к серверу');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Создать фанфик';
  }
}

