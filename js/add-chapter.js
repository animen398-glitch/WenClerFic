import {
  syncSessionWithServer,
  getStoredUser,
  onAuthChange
} from './session.js';

// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

let currentUser = null;
let ficId = null;
let chapterId = null;
let currentFic = null;
let isEditMode = false;
let currentChapter = null;
let allChapters = [];
let autoSaveTimeout = null;
let hasUnsavedChanges = false;
let writingStartTime = null;

// Constants
const MIN_WORDS = 100;
const AUTO_SAVE_INTERVAL = 120000; // 2 minutes
const WORDS_PER_MINUTE = 200; // Average reading speed

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(async () => {
    await checkAuth();
    getIdsFromUrl();
    if (ficId) {
      await loadFic();
      await loadChapters();
      if (isEditMode && chapterId) {
        await loadChapter();
      }
      setupEventListeners();
      initializeAutoSave();
      if (!isEditMode) {
        loadDraft();
      }
      updateBreadcrumbs();
      updatePageTitle();
    }
    writingStartTime = Date.now();
  }, 100);
});

// Track unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

onAuthChange((event) => {
  currentUser = event.detail?.user || null;
  if (currentUser) {
    updateUserUI();
    unlockChapterForm();
  } else {
    showLoginPrompt();
  }
});

async function checkAuth() {
  const user = getStoredUser();
  const token = localStorage.getItem('token');
  
  if (user && token) {
    currentUser = user;
    updateUserUI();
  } else {
    showLoginPrompt();
  }

  const session = await syncSessionWithServer();
  if (session?.user && session?.token) {
    currentUser = session.user;
    updateUserUI();
    unlockChapterForm();
  }
}

function unlockChapterForm() {
  const prompt = document.getElementById('login-prompt');
  if (prompt) {
    prompt.remove();
  }
  const form = document.getElementById('add-chapter-form');
  if (form) {
    form.style.opacity = '1';
    form.style.pointerEvents = 'auto';
  }
}

function showLoginPrompt() {
  const container = document.querySelector('.main-content .container');
  if (container && !document.getElementById('login-prompt')) {
    const form = document.getElementById('add-chapter-form');
    if (form) {
      const prompt = document.createElement('div');
      prompt.id = 'login-prompt';
      prompt.style.cssText = 'background: var(--surface); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; text-align: center; border: 1px solid var(--border-color);';
      prompt.innerHTML = `
        <p style="margin-bottom: 1rem; color: var(--text-primary);">
          Для добавления главы необходимо войти в систему
        </p>
        <button class="btn btn-primary" onclick="showAuthModalFromAddChapter()">
          Войти или Зарегистрироваться
        </button>
      `;
      form.parentNode.insertBefore(prompt, form);
      
      form.style.opacity = '0.5';
      form.style.pointerEvents = 'none';
    }
  }
}

window.showAuthModalFromAddChapter = function() {
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
  };
};

window.onAuthSuccess = function() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (user && token) {
    try {
      currentUser = JSON.parse(user);
      updateUserUI();
      
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
  if (currentUser && userNameEl) {
    userNameEl.textContent = currentUser.username;
  }
}

function getIdsFromUrl() {
  const path = window.location.pathname;
  
  // Режим редактирования: /fic/:id/chapter/:chapterId/edit
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

      // Update fic info display
      const ficTitleLink = document.getElementById('fic-title-link');
      const ficTitleDisplay = document.getElementById('fic-title-display');
      const ficIdDisplay = document.getElementById('fic-id-display');
      const breadcrumbFicLink = document.getElementById('breadcrumb-fic-link');
      
      if (ficTitleLink) {
        ficTitleLink.textContent = data.title;
        ficTitleLink.href = `/fic/${ficId}`;
      }
      
      if (ficIdDisplay) {
        ficIdDisplay.textContent = `#${ficId}`;
      }
      
      if (breadcrumbFicLink) {
        breadcrumbFicLink.textContent = data.title;
        breadcrumbFicLink.href = `/fic/${ficId}`;
      }
      
      const backBtn = document.getElementById('back-to-fic');
      if (backBtn) {
        backBtn.href = `/fic/${ficId}`;
      }
      
      // Update sidebar
      updateSidebarFicInfo(data);
    } else {
      showError(data.error || 'Ошибка загрузки фанфика');
    }
  } catch (error) {
    console.error('Error loading fic:', error);
    showError('Ошибка подключения к серверу');
  }
}

async function loadChapters() {
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}/chapters`);
    if (response.ok) {
      allChapters = await response.json();
      renderChaptersList();
    }
  } catch (error) {
    console.error('Error loading chapters:', error);
  }
}

function renderChaptersList() {
  const chaptersList = document.getElementById('chapters-list');
  if (!chaptersList) return;
  
  if (allChapters.length === 0) {
    chaptersList.innerHTML = '<div class="sidebar-loading">Глав пока нет</div>';
    return;
  }
  
  chaptersList.innerHTML = allChapters.map((chapter, index) => {
    const date = new Date(chapter.createdAt).toLocaleDateString('ru-RU');
    return `
      <div class="chapter-item">
        <div class="chapter-item-header">
          <div style="flex: 1;">
            <div>
              <span class="chapter-item-number">#${index + 1}</span>
              <span class="chapter-item-title">${escapeHtml(chapter.title || 'Без названия')}</span>
            </div>
            <div class="chapter-item-date">${date}</div>
          </div>
          <div class="chapter-item-actions">
            <a href="/fic/${ficId}/chapter/${chapter.id}/edit" class="chapter-edit-btn">✏️</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateSidebarFicInfo(fic) {
  const sidebarFicInfo = document.getElementById('sidebar-fic-info');
  if (!sidebarFicInfo) return;
  
  const author = fic.author || { username: 'Unknown' };
  
  sidebarFicInfo.innerHTML = `
    <div class="sidebar-fic-title">${escapeHtml(fic.title)}</div>
    <div class="sidebar-fic-author">Автор: ${escapeHtml(author.username)}</div>
    <div class="sidebar-fic-stats">
      <div class="sidebar-stat">
        <span class="sidebar-stat-label">Глав:</span>
        <span class="sidebar-stat-value">${fic.chapters || 0}</span>
      </div>
      <div class="sidebar-stat">
        <span class="sidebar-stat-label">Просмотров:</span>
        <span class="sidebar-stat-value">${fic.views || 0}</span>
      </div>
      <div class="sidebar-stat">
        <span class="sidebar-stat-label">Лайков:</span>
        <span class="sidebar-stat-value">${fic.likes || 0}</span>
      </div>
    </div>
  `;
  
  // Update sidebar links
  const sidebarEditFic = document.getElementById('sidebar-edit-fic');
  const sidebarManageChapters = document.getElementById('sidebar-manage-chapters');
  
  if (sidebarEditFic) {
    sidebarEditFic.href = `/create?edit=${ficId}`;
  }
  
  if (sidebarManageChapters) {
    sidebarManageChapters.href = `/fic/${ficId}`;
  }
}

function updateBreadcrumbs() {
  const breadcrumbCurrent = document.getElementById('breadcrumb-current');
  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = isEditMode ? 'Редактировать часть' : 'Добавить часть';
  }
}

function updatePageTitle() {
  const pageTitle = document.querySelector('.page-title');
  if (pageTitle) {
    pageTitle.textContent = isEditMode ? 'Редактировать главу' : 'Добавить главу';
  }
  document.title = `${isEditMode ? 'Редактировать' : 'Добавить'} главу - WenClerFic`;
}

function setupEventListeners() {
  const form = document.getElementById('add-chapter-form');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveDraftBtn = document.getElementById('save-draft-btn');
  const previewBtn = document.getElementById('preview-btn');
  const contentTextarea = document.getElementById('chapter-content');
  const titleInput = document.getElementById('chapter-title');
  const submitBtn = document.getElementById('submit-btn');
  const copyIdBtn = document.getElementById('copy-id-btn');
  const additionalSettingsToggle = document.getElementById('additional-settings-toggle');
  const publishDateRadios = document.querySelectorAll('input[name="publishDate"]');
  const publishDateInput = document.getElementById('publish-date-input');

  // Form submission
  form.addEventListener('submit', handleSubmit);
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    if (hasUnsavedChanges) {
      if (confirm('У вас есть несохраненные изменения. Вы уверены, что хотите уйти?')) {
        window.location.href = `/fic/${ficId}`;
      }
    } else {
      window.location.href = `/fic/${ficId}`;
    }
  });
  
  // Save draft button
  saveDraftBtn.addEventListener('click', () => {
    saveDraft(true);
    showAutoSaveNotification();
  });
  
  // Preview button
  previewBtn.addEventListener('click', () => {
    showPreview();
  });
  
  // Copy ID button
  if (copyIdBtn) {
    copyIdBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(ficId.toString()).then(() => {
        copyIdBtn.innerHTML = '<span class="copy-icon">✓</span>';
        setTimeout(() => {
          copyIdBtn.innerHTML = '<span class="copy-icon">📋</span>';
        }, 2000);
      });
    });
  }
  
  // Title character count
  titleInput.addEventListener('input', () => {
    const length = titleInput.value.length;
    const counter = document.getElementById('title-char-count');
    if (counter) {
      counter.textContent = `${length}/200`;
    }
    markUnsavedChanges();
  });
  
  // Content word and character count
  contentTextarea.addEventListener('input', () => {
    updateContentStats();
    markUnsavedChanges();
  });
  
  // Formatting toolbar
  setupFormattingToolbar();
  
  // Additional settings toggle
  if (additionalSettingsToggle) {
    additionalSettingsToggle.addEventListener('click', () => {
      const content = document.getElementById('additional-settings-content');
      if (content) {
        content.classList.toggle('active');
        additionalSettingsToggle.classList.toggle('active');
      }
    });
  }
  
  // Publish date radio buttons
  publishDateRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'scheduled' && publishDateInput) {
        publishDateInput.style.display = 'block';
      } else if (publishDateInput) {
        publishDateInput.style.display = 'none';
      }
    });
  });
  
  // Update submit button text
  if (isEditMode && submitBtn) {
    submitBtn.textContent = 'Сохранить изменения';
  }
}

function setupFormattingToolbar() {
  const toolbar = document.getElementById('formatting-toolbar');
  if (!toolbar) return;
  
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.toolbar-btn');
    if (!btn) return;
    
    const format = btn.dataset.format;
    const textarea = document.getElementById('chapter-content');
    
    if (!textarea) return;
    
    if (format === 'preview') {
      showPreview();
      return;
    }
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let replacement = '';
    
    switch (format) {
      case 'bold':
        replacement = selectedText ? `**${selectedText}**` : '****';
        break;
      case 'italic':
        replacement = selectedText ? `*${selectedText}*` : '**';
        break;
      case 'link':
        replacement = selectedText ? `[${selectedText}](url)` : '[текст](url)';
        break;
    }
    
    if (replacement) {
      textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      textarea.focus();
      const newPos = format === 'bold' ? start + 2 : start + 1;
      textarea.setSelectionRange(newPos, newPos + (selectedText ? selectedText.length : 0));
      updateContentStats();
      markUnsavedChanges();
    }
  });
}

function updateContentStats() {
  const textarea = document.getElementById('chapter-content');
  if (!textarea) return;
  
  const text = textarea.value.trim();
  const words = text.split(/\s+/).filter(w => w).length;
  const chars = text.length;
  const readingTime = Math.ceil(words / WORDS_PER_MINUTE);
  
  const wordCountEl = document.getElementById('content-word-count');
  const charCountEl = document.getElementById('content-char-count');
  const readingTimeEl = document.getElementById('reading-time');
  const requirementEl = document.getElementById('word-requirement');
  const submitBtn = document.getElementById('submit-btn');
  
  if (wordCountEl) wordCountEl.textContent = words;
  if (charCountEl) charCountEl.textContent = chars;
  if (readingTimeEl) readingTimeEl.textContent = `~${readingTime} мин`;
  
  // Update requirement status
  if (requirementEl) {
    if (words >= MIN_WORDS) {
      requirementEl.classList.add('fulfilled');
      requirementEl.querySelector('.stat-value').textContent = '✓ Выполнено';
    } else {
      requirementEl.classList.remove('fulfilled');
      requirementEl.querySelector('.stat-value').textContent = `${MIN_WORDS} слов`;
    }
  }
  
  // Update submit button
  if (submitBtn) {
    if (words < MIN_WORDS) {
      submitBtn.disabled = true;
      submitBtn.title = `Минимум ${MIN_WORDS} слов для публикации`;
    } else {
      submitBtn.disabled = false;
      submitBtn.title = '';
    }
  }
  
  // Validate textarea
  if (words < MIN_WORDS) {
    textarea.classList.add('error');
  } else {
    textarea.classList.remove('error');
  }
}

function initializeAutoSave() {
  const titleInput = document.getElementById('chapter-title');
  const contentTextarea = document.getElementById('chapter-content');
  
  [titleInput, contentTextarea].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
          saveDraft(false);
          showAutoSaveNotification();
        }, AUTO_SAVE_INTERVAL);
      });
    }
  });
}

function saveDraft(manual = false) {
  if (!ficId || isEditMode) return;
  
  const draft = {
    title: document.getElementById('chapter-title').value,
    content: document.getElementById('chapter-content').value,
    authorNote: document.getElementById('author-note')?.value || '',
    warnings: Array.from(document.querySelectorAll('input[name="warnings"]:checked')).map(cb => cb.value),
    timestamp: Date.now()
  };
  
  localStorage.setItem(`chapter-draft-${ficId}`, JSON.stringify(draft));
  hasUnsavedChanges = false;
}

function loadDraft() {
  if (!ficId || isEditMode) return;
  
  const draftStr = localStorage.getItem(`chapter-draft-${ficId}`);
  if (draftStr) {
    try {
      const draft = JSON.parse(draftStr);
      // Only load if draft is recent (less than 7 days old)
      if (Date.now() - draft.timestamp < 7 * 24 * 60 * 60 * 1000) {
        if (confirm('Найден черновик главы. Загрузить его?')) {
          document.getElementById('chapter-title').value = draft.title || '';
          document.getElementById('chapter-content').value = draft.content || '';
          if (draft.authorNote && document.getElementById('author-note')) {
            document.getElementById('author-note').value = draft.authorNote;
          }
          if (draft.warnings) {
            draft.warnings.forEach(warning => {
              const checkbox = document.getElementById(`warning-${warning}`);
              if (checkbox) checkbox.checked = true;
            });
          }
          updateContentStats();
          document.getElementById('chapter-title').dispatchEvent(new Event('input'));
        } else {
          localStorage.removeItem(`chapter-draft-${ficId}`);
        }
      } else {
        localStorage.removeItem(`chapter-draft-${ficId}`);
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
  }
}

function showAutoSaveNotification() {
  const notification = document.getElementById('auto-save-notification');
  if (notification) {
    notification.classList.add('show');
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}

function markUnsavedChanges() {
  hasUnsavedChanges = true;
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
      updateContentStats();
      document.getElementById('chapter-title').dispatchEvent(new Event('input'));
    } else {
      showError(data.error || 'Ошибка загрузки главы');
    }
  } catch (error) {
    console.error('Error loading chapter:', error);
    showError('Ошибка подключения к серверу');
  }
}

function showPreview() {
  const title = document.getElementById('chapter-title').value;
  const content = document.getElementById('chapter-content').value;
  const authorNote = document.getElementById('author-note')?.value || '';
  
  if (!title || !content) {
    alert('Заполните название и содержание главы для предпросмотра');
    return;
  }
  
  const previewModal = document.getElementById('preview-modal');
  const previewTitle = document.getElementById('preview-chapter-title');
  const previewAuthorNote = document.getElementById('preview-author-note');
  const previewContent = document.getElementById('preview-content');
  
  if (previewTitle) previewTitle.textContent = title;
  
  if (authorNote && previewAuthorNote) {
    previewAuthorNote.textContent = authorNote;
    previewAuthorNote.style.display = 'block';
  } else if (previewAuthorNote) {
    previewAuthorNote.style.display = 'none';
  }
  
  if (previewContent) {
    previewContent.innerHTML = formatMarkdown(content);
  }
  
  if (previewModal) {
    previewModal.style.display = 'flex';
  }
  
  // Setup preview modal close handlers
  const previewClose = document.getElementById('preview-close');
  const previewCloseBtn = document.getElementById('preview-close-btn');
  const previewPublishBtn = document.getElementById('preview-publish-btn');
  
  if (previewClose) {
    previewClose.onclick = () => {
      previewModal.style.display = 'none';
    };
  }
  
  if (previewCloseBtn) {
    previewCloseBtn.onclick = () => {
      previewModal.style.display = 'none';
    };
  }
  
  if (previewPublishBtn) {
    previewPublishBtn.onclick = () => {
      previewModal.style.display = 'none';
      document.getElementById('add-chapter-form').dispatchEvent(new Event('submit', { cancelable: true }));
    };
  }
  
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      previewModal.style.display = 'none';
    }
  });
}

function formatMarkdown(text) {
  // Simple markdown formatting
  return text
    .split('\n\n')
    .map(paragraph => {
      if (!paragraph.trim()) return '<br>';
      
      // Bold: **text**
      paragraph = paragraph.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      
      // Italic: *text*
      paragraph = paragraph.replace(/\*(.+?)\*/g, '<em>$1</em>');
      
      // Links: [text](url)
      paragraph = paragraph.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
      
      return `<p>${paragraph}</p>`;
    })
    .join('');
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
  const title = formData.get('title');
  const content = formData.get('content');
  
  // Validation
  if (!title || !content) {
    alert('Заполните все обязательные поля');
    return;
  }
  
  const words = content.trim().split(/\s+/).filter(w => w).length;
  if (words < MIN_WORDS) {
    alert(`Минимум ${MIN_WORDS} слов для публикации. Сейчас: ${words} слов.`);
    return;
  }
  
  const chapterData = {
    title,
    content
  };

  const submitBtn = document.getElementById('submit-btn');
  const originalText = submitBtn.textContent;
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
      hasUnsavedChanges = false;
      alert(isEditMode ? 'Глава успешно обновлена!' : 'Глава успешно добавлена!');
      window.location.href = `/fic/${ficId}`;
    } else {
      alert(data.error || (isEditMode ? 'Ошибка при обновлении главы' : 'Ошибка при добавлении главы'));
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  } catch (error) {
    console.error('Error saving chapter:', error);
    alert('Ошибка подключения к серверу');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

function showError(message) {
  const container = document.querySelector('.main-content .container');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <h2 style="color: var(--error); margin-bottom: 1rem;">Ошибка</h2>
        <p style="color: var(--text-secondary);">${escapeHtml(message)}</p>
        <a href="/" class="btn btn-primary" style="margin-top: 1rem;">Вернуться на главную</a>
      </div>
    `;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
