import {
  syncSessionWithServer,
  getStoredUser,
  onAuthChange
} from './session.js';

// Get fic ID from URL
function getFicId() {
  const path = window.location.pathname;
  const match = path.match(/\/fic\/(\d+)/);
  return match ? match[1] : null;
}

const ficId = getFicId();
// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

let currentFic = null;
let currentUser = null;

onAuthChange((event) => {
  currentUser = event.detail?.user || null;
  updateAuthUI();
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  if (ficId) {
    loadFic(ficId);
    loadChapters(ficId);
    loadComments(ficId);
  } else {
    showError('Фанфик не найден');
  }
  setupEventListeners();
});

async function checkAuth() {
  const cached = getStoredUser();
  if (cached) {
    currentUser = cached;
    updateAuthUI();
  }

  const session = await syncSessionWithServer();
  if (session?.user) {
    currentUser = session.user;
    updateAuthUI();
  }
}

function updateAuthUI() {
  const userNameEl = document.getElementById('user-name');
  const commentFormContainer = document.getElementById('comment-form-container');
  
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
    if (commentFormContainer) {
      commentFormContainer.style.display = 'block';
    }
  } else {
    userNameEl.textContent = 'Войти';
    if (commentFormContainer) {
      commentFormContainer.style.display = 'none';
    }
  }
}

function setupEventListeners() {
  const likeBtn = document.getElementById('like-btn');
  const bookmarkBtn = document.getElementById('bookmark-btn');
  const shareBtn = document.getElementById('share-btn');
  const commentForm = document.getElementById('comment-form');
  const cancelCommentBtn = document.getElementById('cancel-comment');

  likeBtn?.addEventListener('click', handleLike);
  bookmarkBtn?.addEventListener('click', handleBookmark);
  shareBtn?.addEventListener('click', handleShare);
  commentForm?.addEventListener('submit', handleCommentSubmit);
  cancelCommentBtn?.addEventListener('click', () => {
    document.getElementById('comment-text').value = '';
  });
}

async function loadFic(id) {
  try {
    const response = await fetch(`${API_BASE}/fics/${id}`);
    const data = await response.json();

    if (response.ok) {
      currentFic = data;
      renderFic(data);
    } else {
      showError(data.error || 'Ошибка загрузки фанфика');
    }
  } catch (error) {
    console.error('Error loading fic:', error);
    showError('Ошибка подключения к серверу');
  }
}

function renderFic(fic) {
  currentFic = fic;
  document.getElementById('fic-title').textContent = fic.title;
  document.getElementById('fic-description').textContent = fic.description;
  document.getElementById('fic-id').textContent = `ID ${fic.id || '—'}`;
  document.getElementById('fic-hot').textContent = fic.isHot ? 'Горячая работа' : 'Работа автора';

  const authorName = fic.author?.username || 'Неизвестный автор';
  const authorLink = document.getElementById('fic-author-link');
  authorLink.textContent = authorName;
  authorLink.href = `/author/${fic.authorId}`;

  const authorAvatar = document.getElementById('fic-author-avatar');
  authorAvatar.src = fic.author?.avatar || 'https://via.placeholder.com/80?text=AU';
  authorAvatar.alt = authorName;
  document.getElementById('fic-author-name').textContent = authorName;

  document.getElementById('fic-rating').textContent = fic.rating || 'Без рейтинга';
  const completion = fic.status === 'completed' ? 'Завершён' : 'В процессе';
  document.getElementById('fic-completion').textContent = completion;
  document.getElementById('fic-genre').textContent = fic.genre || 'Жанр не указан';
  document.getElementById('fic-fandom').textContent = fic.fandom || 'Фэндом не указан';
  document.getElementById('fic-size').textContent = formatWords(fic.words);

  document.getElementById('fic-views').textContent = fic.views || 0;
  document.getElementById('fic-likes').textContent = fic.likes || 0;
  document.getElementById('fic-favorites').textContent = fic.favorites || 0;
  document.getElementById('fic-chapters').textContent = fic.chapters || 0;
  document.getElementById('sidebar-likes').textContent = fic.likes || 0;
  document.getElementById('sidebar-views').textContent = fic.views || 0;
  document.getElementById('sidebar-fav').textContent = fic.favorites || 0;
  
  const updatedDate = new Date(fic.updatedAt);
  document.getElementById('fic-updated').textContent = `Обновлено ${updatedDate.toLocaleDateString('ru-RU')}`;
  const publication = fic.externalLinks?.length
    ? `Также опубликовано: ${fic.externalLinks.join(', ')}`
    : 'Публикация доступна только на WenClerFic';
  document.getElementById('fic-publication').textContent = publication;

  // Render tags
  const tagsContainer = document.getElementById('fic-tags-header');
  if (fic.tags && fic.tags.length > 0) {
    tagsContainer.innerHTML = fic.tags.map(tag => 
      `<span class="fic-tag">${tag}</span>`
    ).join('');
  }

  // Add delete button if user is author
  const ficActions = document.querySelector('.fic-actions');
  const isAuthor = currentUser && fic.authorId === currentUser.id;
  if (isAuthor && !document.getElementById('delete-fic-btn')) {
    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'delete-fic-btn';
    deleteBtn.className = 'btn btn-outline';
    deleteBtn.style.color = 'var(--error)';
    deleteBtn.textContent = '🗑️ Удалить фанфик';
    deleteBtn.onclick = () => deleteFic(fic.id);
    ficActions.appendChild(deleteBtn);
  }

  // Update page title
  document.title = `${fic.title} - WenClerFic`;
}

async function deleteFic(id) {
  if (!confirm('Вы уверены, что хотите удалить этот фанфик? Это действие нельзя отменить.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/fics/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      alert('Фанфик успешно удален');
      window.location.href = '/';
    } else {
      const data = await response.json();
      alert(data.error || 'Ошибка при удалении фанфика');
    }
  } catch (error) {
    console.error('Error deleting fic:', error);
    alert('Ошибка подключения к серверу');
  }
}

window.deleteFic = deleteFic;

async function loadChapters(ficId) {
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}/chapters`);
    const chapters = await response.json();

    renderChapters(chapters);
    
    // Add "Add Chapter" button if user is author
    const isAuthor = currentUser && currentFic && currentFic.authorId === currentUser.id;
    const addChapterContainer = document.getElementById('add-chapter-container');
    if (isAuthor && addChapterContainer) {
      if (!addChapterContainer.querySelector('a')) {
        const addBtn = document.createElement('a');
        addBtn.href = `/fic/${ficId}/addpart`;
        addBtn.className = 'btn btn-primary';
        addBtn.textContent = '+ Добавить главу';
        addChapterContainer.appendChild(addBtn);
      }
    } else if (addChapterContainer) {
      addChapterContainer.innerHTML = '';
    }
  } catch (error) {
    console.error('Error loading chapters:', error);
    // Show empty state or mock data
    renderChapters([]);
  }
}

function renderChapters(chapters) {
  const container = document.getElementById('chapters-list');
  const isAuthor = currentUser && currentFic && currentFic.authorId === currentUser.id;
  
  if (chapters.length === 0) {
    container.innerHTML = '<p class="no-comments">Глав пока нет</p>';
    return;
  }

  container.innerHTML = chapters.map((chapter, index) => {
    const chapterDate = chapter.createdAt
      ? new Date(chapter.createdAt).toLocaleDateString('ru-RU')
      : 'Дата не указана';
    return `
      <div class="chapter-item" onclick="window.location.href='/fic/${ficId}/chapter/${chapter.id}'">
        <div class="chapter-info">
          <div class="chapter-title">Глава ${chapter.order || index + 1}: ${chapter.title || 'Без названия'}</div>
          <div class="chapter-item__meta">
            <span>${chapterDate}</span>
            <span>${chapter.words || 0} слов</span>
          </div>
        </div>
        <div class="chapter-actions">
          <button class="chapter-btn" onclick="event.stopPropagation(); window.location.href='/fic/${ficId}/chapter/${chapter.id}'">
            Читать
          </button>
          ${isAuthor ? `
            <button class="chapter-btn" onclick="event.stopPropagation(); window.location.href='/fic/${ficId}/chapter/${chapter.id}/edit'" title="Редактировать главу">
              ✏️
            </button>
            <button class="chapter-btn btn-danger" onclick="event.stopPropagation(); deleteChapter(${chapter.id})" title="Удалить главу">🗑️</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function deleteChapter(chapterId) {
  if (!confirm('Вы уверены, что хотите удалить эту главу? Это действие нельзя отменить.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/fics/${ficId}/chapters/${chapterId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      alert('Глава успешно удалена');
      loadChapters(ficId);
      loadFic(ficId);
    } else {
      const data = await response.json();
      alert(data.error || 'Ошибка при удалении главы');
    }
  } catch (error) {
    console.error('Error deleting chapter:', error);
    alert('Ошибка подключения к серверу');
  }
}

window.deleteChapter = deleteChapter;

async function loadComments(ficId) {
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}/comments`);
    const comments = await response.json();

    renderComments(comments);
  } catch (error) {
    console.error('Error loading comments:', error);
    renderComments([]);
  }
}

function renderComments(comments) {
  const container = document.getElementById('comments-list');
  const countEl = document.getElementById('comments-count');
  
  countEl.textContent = comments.length;

  if (comments.length === 0) {
    container.innerHTML = '<p class="no-comments">Пока нет комментариев. Будьте первым!</p>';
    return;
  }

  container.innerHTML = comments.map(comment => {
    const date = new Date(comment.createdAt);
    return `
      <div class="comment-item">
        <div class="comment-header">
          <div class="comment-author">
            <div class="comment-avatar">👤</div>
            <div class="comment-author-info">
              <a href="/author/${comment.authorId}" class="comment-author-name">User${comment.authorId}</a>
              <span class="comment-date">${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div class="comment-actions">
            <button class="chapter-btn" onclick="event.stopPropagation()">Ответить</button>
            <button class="chapter-btn btn-danger" onclick="event.stopPropagation()">Пожаловаться</button>
          </div>
        </div>
        <div class="comment-text">${comment.text}</div>
      </div>
    `;
  }).join('');
}

function formatWords(count = 0) {
  if (!count) return 'Размер: —';
  return `Размер: ${count.toLocaleString('ru-RU')} слов`;
}

async function handleLike() {
  if (!currentUser) {
    alert('Войдите, чтобы поставить лайк');
    return;
  }

  // TODO: Implement like functionality
  alert('Функция лайков будет реализована');
}

async function handleBookmark() {
  if (!currentUser) {
    alert('Войдите, чтобы добавить в закладки');
    return;
  }

  // TODO: Implement bookmark functionality
  alert('Функция закладок будет реализована');
}

function handleShare() {
  if (navigator.share) {
    navigator.share({
      title: currentFic?.title,
      text: currentFic?.description,
      url: window.location.href
    });
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(window.location.href);
    alert('Ссылка скопирована в буфер обмена');
  }
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  
  if (!currentUser) {
    alert('Войдите, чтобы оставить комментарий');
    return;
  }

  const text = document.getElementById('comment-text').value.trim();
  if (!text) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/fics/${ficId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('comment-text').value = '';
      loadComments(ficId);
    } else {
      alert(data.error || 'Ошибка отправки комментария');
    }
  } catch (error) {
    console.error('Error submitting comment:', error);
    alert('Ошибка подключения к серверу');
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

