// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

let currentUser = null;
let ficId = null;
let chapterId = null;
let currentFic = null;
let isEditMode = false;
let currentChapter = null;

document.addEventListener('DOMContentLoaded', () => {
  // Ждем загрузки app.js для инициализации модального окна
  setTimeout(() => {
    checkAuth();
    getIdsFromUrl();
    if (ficId) {
      loadFic();
      if (isEditMode && chapterId) {
        loadChapter();
      }
      setupEventListeners();
    }
  }, 100);
});

function checkAuth() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (user && token) {
    try {
      currentUser = JSON.parse(user);
      updateUserUI();
    } catch (e) {
      console.error('Error parsing user data:', e);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      showLoginPrompt();
    }
  } else {
    showLoginPrompt();
  }
}

function showLoginPrompt() {
  const container = document.querySelector('.main-content .container');
  if (container && !document.getElementById('login-prompt')) {
    const createPage = container.querySelector('.create-page');
    if (createPage) {
      const prompt = document.createElement('div');
      prompt.id = 'login-prompt';
      prompt.style.cssText = 'background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; text-align: center;';
      prompt.innerHTML = `
        <p style="margin-bottom: 1rem; color: var(--text-primary);">
          Для добавления главы необходимо войти в систему
        </p>
        <button class="btn btn-primary" onclick="showAuthModalFromAddChapter()">
          Войти или Зарегистрироваться
        </button>
      `;
      const form = document.getElementById('add-chapter-form');
      if (form && form.parentNode) {
        form.parentNode.insertBefore(prompt, form);
      } else {
        createPage.insertBefore(prompt, createPage.firstChild);
      }
      
      // Блокируем форму
      if (form) {
        form.style.opacity = '0.5';
        form.style.pointerEvents = 'none';
      }
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
          <h2 style="margin-bottom: 1rem;">Требуется авторизация</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">
            Для добавления главы необходимо войти в систему
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <a href="/" class="btn btn-outline">Вернуться на главную</a>
            <button class="btn btn-primary" onclick="window.showAuthModal && window.showAuthModal()">
              Войти
            </button>
          </div>
        </div>
      `;
    }
  }
}

function showAuthModalFromAddChapter() {
  if (window.showAuthModal) {
    window.showAuthModal();
  } else {
    setTimeout(() => {
      if (window.showAuthModal) {
        window.showAuthModal();
      } else {
        window.location.href = '/';
      }
    }, 100);
  }
}

window.showAuthModalFromAddChapter = showAuthModalFromAddChapter;

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
      
      const form = document.getElementById('add-chapter-form');
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

function getIdsFromUrl() {
  const path = window.location.pathname;
  
  // Проверяем режим редактирования: /fic/:id/chapter/:chapterId/edit
  const editMatch = path.match(/\/fic\/(\d+)\/chapter\/(\d+)\/edit/);
  if (editMatch) {
    ficId = editMatch[1];
    chapterId = editMatch[2];
    isEditMode = true;
    return;
  }
  
  // Режим добавления: /fic/:id/addpart
  const addMatch = path.match(/\/fic\/(\d+)\/addpart/);
  if (addMatch) {
    ficId = addMatch[1];
    isEditMode = false;
  }
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

      const ficInfo = document.getElementById('fic-info');
      const ficLink = document.getElementById('fic-link');
      ficLink.textContent = data.title;
      ficLink.href = `/fic/${ficId}`;
      
      const backBtn = document.getElementById('back-to-fic');
      backBtn.href = `/fic/${ficId}`;
      backBtn.style.display = 'block';
      
      // Обновляем заголовок страницы в зависимости от режима
      const pageTitle = document.querySelector('.page-title');
      if (isEditMode) {
        pageTitle.textContent = 'Редактировать главу';
        document.title = 'Редактировать главу - WenClerFic';
      } else {
        pageTitle.textContent = 'Добавить главу';
        document.title = 'Добавить главу - WenClerFic';
      }
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
  const titleInput = document.getElementById('chapter-title');

  form.addEventListener('submit', handleSubmit);
  cancelBtn.addEventListener('click', () => {
    if (confirm('Вы уверены? Все несохраненные данные будут потеряны.')) {
      window.location.href = `/fic/${ficId}`;
    }
  });

  // Title character count
  titleInput.addEventListener('input', () => {
    const length = titleInput.value.length;
    document.getElementById('title-char-count').textContent = `(${length}/200)`;
  });

  // Content word and character count
  contentTextarea.addEventListener('input', () => {
    const text = contentTextarea.value.trim();
    const words = text.split(/\s+/).filter(w => w).length;
    const chars = text.length;
    
    document.getElementById('content-word-count').textContent = words;
    document.getElementById('content-word-count-display').textContent = words;
    document.getElementById('content-char-count').textContent = chars;
    
    // Validate minimum words
    const submitBtn = document.getElementById('submit-btn');
    if (words < 100) {
      submitBtn.disabled = true;
      submitBtn.title = 'Минимум 100 слов для публикации';
    } else {
      submitBtn.disabled = false;
      submitBtn.title = '';
    }
  });

  // Auto-save draft to localStorage
  let saveTimeout;
  [titleInput, contentTextarea].forEach(input => {
    input.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveDraft();
      }, 2000);
    });
  });

  // Load draft on page load (только если не режим редактирования)
  if (!isEditMode) {
    loadDraft();
  }
  
  // Обновляем текст кнопки в зависимости от режима
  const submitBtn = document.getElementById('submit-btn');
  if (isEditMode) {
    submitBtn.textContent = 'Сохранить изменения';
  }
}

function saveDraft() {
  if (!ficId) return;
  const draft = {
    title: document.getElementById('chapter-title').value,
    content: document.getElementById('chapter-content').value,
    timestamp: Date.now()
  };
  localStorage.setItem(`chapter-draft-${ficId}`, JSON.stringify(draft));
}

function loadDraft() {
  if (!ficId) return;
  const draftStr = localStorage.getItem(`chapter-draft-${ficId}`);
  if (draftStr) {
    try {
      const draft = JSON.parse(draftStr);
      // Only load if draft is recent (less than 7 days old)
      if (Date.now() - draft.timestamp < 7 * 24 * 60 * 60 * 1000) {
        if (confirm('Найден черновик главы. Загрузить его?')) {
          document.getElementById('chapter-title').value = draft.title || '';
          document.getElementById('chapter-content').value = draft.content || '';
          // Trigger input event to update counts
          document.getElementById('chapter-content').dispatchEvent(new Event('input'));
        }
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
  }
}

async function loadChapter() {
  if (!chapterId || !ficId) return;
  
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}/chapters/${chapterId}`);
    const data = await response.json();

    if (response.ok) {
      currentChapter = data;
      
      // Проверяем, что пользователь - автор
      if (currentUser && currentFic && currentFic.authorId !== currentUser.id) {
        alert('Вы можете редактировать только свои главы');
        window.location.href = `/fic/${ficId}`;
        return;
      }
      
      // Заполняем форму данными главы
      document.getElementById('chapter-title').value = data.title || '';
      document.getElementById('chapter-content').value = data.content || '';
      
      // Обновляем счетчики
      document.getElementById('chapter-content').dispatchEvent(new Event('input'));
      document.getElementById('chapter-title').dispatchEvent(new Event('input'));
    } else {
      showError(data.error || 'Ошибка загрузки главы');
    }
  } catch (error) {
    console.error('Error loading chapter:', error);
    showError('Ошибка подключения к серверу');
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  // Проверяем авторизацию перед отправкой
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (!user || !token) {
    alert('Войдите, чтобы добавить главу');
    window.location.href = '/';
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
  const chapterData = {
    title: formData.get('title'),
    content: formData.get('content')
  };

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = isEditMode ? 'Сохранение...' : 'Добавление...';

  try {
    const token = localStorage.getItem('token');
    
    let response;
    if (isEditMode && chapterId) {
      // Редактирование существующей главы
      response = await fetch(`${API_BASE}/fics/${ficId}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(chapterData)
      });
    } else {
      // Добавление новой главы
      response = await fetch(`${API_BASE}/fics/${ficId}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(chapterData)
      });
    }

    const data = await response.json();

    if (response.ok) {
      // Clear draft
      localStorage.removeItem(`chapter-draft-${ficId}`);
      alert(isEditMode ? 'Глава успешно обновлена!' : 'Глава успешно добавлена!');
      window.location.href = `/fic/${ficId}`;
    } else {
      alert(data.error || (isEditMode ? 'Ошибка при обновлении главы' : 'Ошибка при добавлении главы'));
      submitBtn.disabled = false;
      submitBtn.textContent = isEditMode ? 'Сохранить изменения' : 'Опубликовать главу';
    }
  } catch (error) {
    console.error('Error saving chapter:', error);
    alert('Ошибка подключения к серверу');
    submitBtn.disabled = false;
    submitBtn.textContent = isEditMode ? 'Сохранить изменения' : 'Опубликовать главу';
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

