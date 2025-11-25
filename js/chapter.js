import {
  syncSessionWithServer,
  getStoredUser,
  onAuthChange
} from './session.js';

const API_BASE = window.location.origin + '/api';
const READER_SETTINGS_KEY = 'wenReaderSettings';
const CHAPTER_INTERACTION_PREFIX = 'wenChapterState_';

let ficId = null;
let chapterId = null;
let currentChapter = null;
let allChapters = [];
let currentUser = null;
let currentFic = null;
let readerSettings = {
  font: 'inter',
  size: 'm',
  theme: 'dark'
};
let chapterInteraction = {
  liked: false,
  disliked: false,
  favorite: false
};

onAuthChange((event) => {
  currentUser = event.detail?.user || null;
  const userNameEl = document.getElementById('user-name');
  if (userNameEl && currentUser) {
    userNameEl.textContent = currentUser.username;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  getIdsFromUrl();
  initReaderControls();
  if (ficId && chapterId) {
    await loadFic();
    await loadChapter();
    await loadReaderComments();
  }
});

async function checkAuth() {
  const cached = getStoredUser();
  if (cached) {
    currentUser = cached;
    updateUserName();
  }

  const session = await syncSessionWithServer();
  if (session?.user) {
    currentUser = session.user;
    updateUserName();
  }
}

function updateUserName() {
  const userNameEl = document.getElementById('user-name');
  if (userNameEl && currentUser) {
    userNameEl.textContent = currentUser.username;
  }
}

async function loadFic() {
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}`);
    const data = await response.json();
    if (response.ok) {
      currentFic = data;
      return data;
    }
  } catch (error) {
    console.error('Error loading fic:', error);
  }
  return null;
}

function getIdsFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/fic\/(\d+)\/chapter\/(\d+)/);
  if (match) {
    ficId = parseInt(match[1], 10);
    chapterId = parseInt(match[2], 10);
  }
}

async function loadChapter() {
  try {
    const [chapterResponse, chaptersResponse] = await Promise.all([
      fetch(`${API_BASE}/fics/${ficId}/chapters/${chapterId}`),
      fetch(`${API_BASE}/fics/${ficId}/chapters`)
    ]);

    const chapter = await chapterResponse.json();
    allChapters = await chaptersResponse.json();

    if (chapterResponse.ok) {
      currentChapter = chapter;
      renderChapter(chapter);
      setupNavigation();
      populateChapterNav();
      initChapterInteractions();
    } else {
      showError(chapter.error || 'Ошибка загрузки главы');
    }
  } catch (error) {
    console.error('Error loading chapter:', error);
    showError('Ошибка подключения к серверу');
  }
}

function renderChapter(chapter) {
  document.getElementById('chapter-title').textContent = chapter.title || 'Без названия';
  document.getElementById('chapter-content').textContent = chapter.content || '';

  const date = chapter.createdAt ? new Date(chapter.createdAt).toLocaleDateString('ru-RU') : '—';
  document.getElementById('chapter-info').textContent = `${date} • ${chapter.words || 0} слов`;
  document.getElementById('chapter-breadcrumbs').textContent = `${currentFic?.fandom || 'Фэндом'} • ${currentFic?.genre || 'жанр'}`;
  document.getElementById('reader-views').textContent = chapter.views || currentFic?.views || 0;
  document.getElementById('reader-likes').textContent = currentFic?.likes || 0;
  document.getElementById('reader-fav').textContent = currentFic?.favorites || 0;

  document.title = `${chapter.title} - WenClerFic`;

  const backLinks = document.querySelectorAll('#back-to-fic');
  backLinks.forEach(link => {
    link.href = `/fic/${ficId}`;
  });

  const isAuthor = currentUser && currentFic && currentFic.authorId === currentUser.id;
  if (isAuthor) {
    addEditButton();
  }
}

function addEditButton() {
  const header = document.querySelector('.chapter-reader__header');
  if (!header || document.getElementById('edit-chapter-btn')) return;

  const editBtn = document.createElement('a');
  editBtn.id = 'edit-chapter-btn';
  editBtn.href = `/fic/${ficId}/chapter/${chapterId}/edit`;
  editBtn.className = 'btn btn-primary';
  editBtn.textContent = '✏️ Редактировать';
  editBtn.style.marginLeft = 'auto';

  header.appendChild(editBtn);
}

function setupNavigation() {
  const sortedChapters = [...allChapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const currentIndex = sortedChapters.findIndex(c => c.id === chapterId);

  const prevBtn = document.getElementById('prev-chapter');
  const nextBtn = document.getElementById('next-chapter');

  prevBtn.disabled = currentIndex <= 0;
  nextBtn.disabled = currentIndex >= sortedChapters.length - 1;

  if (currentIndex > 0) {
    prevBtn.onclick = () => {
      window.location.href = `/fic/${ficId}/chapter/${sortedChapters[currentIndex - 1].id}`;
    };
  }

  if (currentIndex < sortedChapters.length - 1) {
    nextBtn.onclick = () => {
      window.location.href = `/fic/${ficId}/chapter/${sortedChapters[currentIndex + 1].id}`;
    };
  }
}

function populateChapterNav() {
  const nav = document.getElementById('chapters-nav');
  const select = document.getElementById('chapter-select');
  if (!nav || !select) return;

  const sorted = [...allChapters].sort((a, b) => (a.order || 0) - (b.order || 0));

  nav.innerHTML = sorted.map(chapter => `
    <button data-chapter="${chapter.id}" class="${chapter.id === chapterId ? 'active' : ''}">
      ${chapter.order || 1}. ${chapter.title || 'Без названия'}
    </button>
  `).join('');

  select.innerHTML = sorted.map(chapter => `
    <option value="${chapter.id}" ${chapter.id === chapterId ? 'selected' : ''}>
      ${chapter.order || 1}. ${chapter.title || 'Без названия'}
    </option>
  `).join('');

  nav.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      window.location.href = `/fic/${ficId}/chapter/${button.dataset.chapter}`;
    });
  });

  select.addEventListener('change', event => {
    window.location.href = `/fic/${ficId}/chapter/${event.target.value}`;
  });
}

function showError(message) {
  const container = document.querySelector('.reader-page');
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem;">
      <h2 style="color: var(--error); margin-bottom: 1rem;">Ошибка</h2>
      <p style="color: var(--text-secondary);">${message}</p>
      <a href="/" class="btn btn-primary" style="margin-top: 1rem;">Вернуться на главную</a>
    </div>
  `;
}

/* Настройки чтения */
function initReaderControls() {
  readerSettings = loadReaderSettings();
  applyReaderSettings();

  const optionsGroups = document.querySelectorAll('.reader-settings__options');
  optionsGroups.forEach(group => {
    group.addEventListener('click', event => {
      const button = event.target.closest('.reader-settings__btn');
      if (!button) return;
      const setting = group.dataset.setting;
      const value = button.dataset.value;
      if (readerSettings[setting] === value) return;
      readerSettings[setting] = value;
      saveReaderSettings();
      applyReaderSettings();
    });
  });

  const floatingToggle = document.getElementById('reader-floating-toggle');
  const settingsPanel = document.getElementById('reader-settings');
  floatingToggle?.addEventListener('click', () => {
    settingsPanel.classList.toggle('reader-settings--open');
    const expanded = settingsPanel.classList.contains('reader-settings--open');
    floatingToggle.setAttribute('aria-expanded', expanded.toString());
  });
}

function loadReaderSettings() {
  try {
    const stored = localStorage.getItem(READER_SETTINGS_KEY);
    if (stored) {
      return { ...readerSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Reader settings fallback', error);
  }
  return readerSettings;
}

function saveReaderSettings() {
  localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(readerSettings));
}

function applyReaderSettings() {
  const readerRoot = document.getElementById('reader-root');
  if (!readerRoot) return;
  readerRoot.dataset.font = readerSettings.font;
  readerRoot.dataset.size = readerSettings.size;
  readerRoot.dataset.theme = readerSettings.theme;

  document.querySelectorAll('.reader-settings__btn').forEach(btn => {
    const group = btn.closest('.reader-settings__options');
    if (!group) return;
    btn.classList.toggle(
      'reader-settings__btn--active',
      readerSettings[group.dataset.setting] === btn.dataset.value
    );
  });
}

/* Интерактив главы */
function initChapterInteractions() {
  const stateKey = `${CHAPTER_INTERACTION_PREFIX}${chapterId}`;
  const stored = localStorage.getItem(stateKey);
  if (stored) {
    chapterInteraction = JSON.parse(stored);
  }

  const likeBtn = document.getElementById('reader-like-btn');
  const dislikeBtn = document.getElementById('reader-dislike-btn');
  const favBtn = document.getElementById('reader-fav-btn');

  const persist = () => localStorage.setItem(stateKey, JSON.stringify(chapterInteraction));
  const updateButtons = () => {
    likeBtn?.classList.toggle('reader-actions__btn--active', chapterInteraction.liked);
    dislikeBtn?.classList.toggle('reader-actions__btn--active', chapterInteraction.disliked);
    favBtn?.classList.toggle('reader-actions__btn--active', chapterInteraction.favorite);
  };

  likeBtn?.addEventListener('click', () => {
    chapterInteraction.liked = !chapterInteraction.liked;
    if (chapterInteraction.liked) chapterInteraction.disliked = false;
    persist();
    updateButtons();
  });

  dislikeBtn?.addEventListener('click', () => {
    chapterInteraction.disliked = !chapterInteraction.disliked;
    if (chapterInteraction.disliked) chapterInteraction.liked = false;
    persist();
    updateButtons();
  });

  favBtn?.addEventListener('click', () => {
    chapterInteraction.favorite = !chapterInteraction.favorite;
    persist();
    updateButtons();
  });

  updateButtons();
}

/* Комментарии */
async function loadReaderComments() {
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}/comments`);
    const comments = await response.json();
    renderReaderComments(comments);
  } catch (error) {
    console.error('Comments error', error);
    renderReaderComments([]);
  }
}

function renderReaderComments(comments) {
  const container = document.getElementById('reader-comments-list');
  if (!container) return;
  if (!comments.length) {
    container.innerHTML = '<p class="no-comments">Пока нет комментариев</p>';
    return;
  }

  container.innerHTML = comments.map(comment => {
    const date = new Date(comment.createdAt);
    return `
      <div class="reader-comment">
        <div class="reader-comment__avatar">👤</div>
        <div class="reader-comment__bubble">
          <div class="reader-comment__meta">
            <a href="/author/${comment.authorId}">User${comment.authorId}</a>
            <span>${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p>${comment.text}</p>
          <div class="reader-comment__actions">
            <button type="button">Ответить</button>
            <button type="button">Пожаловаться</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

