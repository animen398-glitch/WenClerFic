import {
  syncSessionWithServer,
  getStoredUser,
  onAuthChange
} from './session.js';

// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  // Ждем загрузки app.js для инициализации модального окна
  setTimeout(async () => {
    await checkAuth();
    setupEventListeners();
    setupCharCounter();
  }, 100);
});

onAuthChange((event) => {
  currentUser = event.detail?.user || null;
  if (currentUser) {
    updateUserUI();
    unlockCreateForm();
  } else {
    showLoginPrompt();
  }
});

async function checkAuth() {
  const storedUser = getStoredUser();
  const token = localStorage.getItem('token');
  
  if (storedUser && token) {
    currentUser = storedUser;
    updateUserUI();
  } else {
    showLoginPrompt();
  }

  const session = await syncSessionWithServer();
  if (session?.user && session?.token) {
    currentUser = session.user;
    updateUserUI();
    unlockCreateForm();
  }
}

function unlockCreateForm() {
  const prompt = document.getElementById('login-prompt');
  if (prompt) {
    prompt.remove();
  }
  const form = document.getElementById('create-fic-form');
  if (form) {
    form.style.opacity = '1';
    form.style.pointerEvents = 'auto';
  }
}

function showLoginPrompt() {
  // Показываем сообщение, но не редиректим
  const formContainer = document.querySelector('.create-page');
  if (formContainer && !document.getElementById('login-prompt')) {
    const prompt = document.createElement('div');
    prompt.id = 'login-prompt';
    prompt.style.cssText = 'background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; text-align: center;';
    prompt.innerHTML = `
      <p style="margin-bottom: 1rem; color: var(--text-primary);">
        Для создания фанфика необходимо войти в систему
      </p>
      <button class="btn btn-primary" onclick="showAuthModalFromCreate()">
        Войти или Зарегистрироваться
      </button>
    `;
    const form = document.getElementById('create-fic-form');
    if (form && form.parentNode) {
      form.parentNode.insertBefore(prompt, form);
    } else {
      formContainer.insertBefore(prompt, formContainer.firstChild);
    }
    
    // Блокируем форму
    if (form) {
      form.style.opacity = '0.5';
      form.style.pointerEvents = 'none';
    }
  }
}

function showAuthModalFromCreate() {
  // Импортируем функцию показа модального окна из app.js
  if (window.showAuthModal) {
    window.showAuthModal();
  } else {
    // Ждем немного, чтобы app.js загрузился
    setTimeout(() => {
      if (window.showAuthModal) {
        window.showAuthModal();
      } else {
        // Если функция все еще недоступна, редиректим на главную
        window.location.href = '/';
      }
    }, 100);
  }
}

window.showAuthModalFromCreate = showAuthModalFromCreate;

// Функция вызывается после успешного входа
window.onAuthSuccess = function() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (user && token) {
    try {
      currentUser = JSON.parse(user);
      updateUserUI();
      
      // Убираем промпт и разблокируем форму
      const prompt = document.getElementById('login-prompt');
      if (prompt) {
        prompt.remove();
      }
      
      const form = document.getElementById('create-fic-form');
      if (form) {
        form.style.opacity = '1';
        form.style.pointerEvents = 'auto';
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }
};

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

  // Проверяем авторизацию перед отправкой
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (!user || !token) {
    alert('Войдите, чтобы создать фанфик');
    showAuthModalFromCreate();
    return;
  }
  
  // Обновляем currentUser на случай, если он был очищен
  if (!currentUser && user) {
    try {
      currentUser = JSON.parse(user);
    } catch (e) {
      alert('Ошибка авторизации. Пожалуйста, войдите снова.');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/';
      return;
    }
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

