// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

let ficId = null;
let chapterId = null;
let currentChapter = null;
let allChapters = [];
let currentUser = null;
let currentFic = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  getIdsFromUrl();
  if (ficId && chapterId) {
    // Сначала загружаем информацию о фанфике, потом главу
    loadFic().then(() => {
      loadChapter();
    });
  }
});

function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
      userNameEl.textContent = currentUser.username;
    }
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
    ficId = parseInt(match[1]);
    chapterId = parseInt(match[2]);
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

  document.title = `${chapter.title} - WenClerFic`;

  // Set back link
  const backLinks = document.querySelectorAll('#back-to-fic, #back-to-fic-btn');
  backLinks.forEach(link => {
    link.href = `/fic/${ficId}`;
  });
  
  // Добавляем кнопку редактирования для автора
  const isAuthor = currentUser && currentFic && currentFic.authorId === currentUser.id;
  if (isAuthor) {
    addEditButton();
  }
}

function addEditButton() {
  const chapterHeader = document.querySelector('.fic-header');
  if (!chapterHeader || document.getElementById('edit-chapter-btn')) return;
  
  const editBtn = document.createElement('a');
  editBtn.id = 'edit-chapter-btn';
  editBtn.href = `/fic/${ficId}/chapter/${chapterId}/edit`;
  editBtn.className = 'btn btn-primary';
  editBtn.style.marginTop = '1rem';
  editBtn.textContent = '✏️ Редактировать главу';
  
  const metaHeader = document.querySelector('.fic-meta-header');
  if (metaHeader) {
    metaHeader.appendChild(document.createElement('br'));
    metaHeader.appendChild(editBtn);
  }
}

function setupNavigation() {
  const sortedChapters = [...allChapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const currentIndex = sortedChapters.findIndex(c => c.id === chapterId);

  const prevBtn = document.getElementById('prev-chapter');
  const nextBtn = document.getElementById('next-chapter');

  if (currentIndex > 0) {
    prevBtn.style.display = 'block';
    prevBtn.onclick = () => {
      window.location.href = `/fic/${ficId}/chapter/${sortedChapters[currentIndex - 1].id}`;
    };
  }

  if (currentIndex < sortedChapters.length - 1) {
    nextBtn.style.display = 'block';
    nextBtn.onclick = () => {
      window.location.href = `/fic/${ficId}/chapter/${sortedChapters[currentIndex + 1].id}`;
    };
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

