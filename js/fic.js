// Get fic ID from URL
function getFicId() {
  const path = window.location.pathname;
  const match = path.match(/\/fic\/(\d+)/);
  return match ? match[1] : null;
}

const ficId = getFicId();
const API_BASE = 'http://localhost:3000/api';

let currentFic = null;
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  if (ficId) {
    loadFic(ficId);
    loadChapters(ficId);
    loadComments(ficId);
  } else {
    showError('Фанфик не найден');
  }
  setupEventListeners();
});

function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
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
  document.getElementById('fic-title').textContent = fic.title;
  document.getElementById('fic-description').textContent = fic.description;
  document.getElementById('fic-author-link').textContent = fic.author?.username || 'Unknown';
  document.getElementById('fic-author-link').href = `/author/${fic.authorId}`;
  document.getElementById('fic-rating').textContent = fic.rating;
  document.getElementById('fic-status').textContent = fic.status === 'ongoing' ? 'В процессе' : 'Завершен';
  document.getElementById('fic-status').classList.add(fic.status);
  document.getElementById('fic-views').textContent = fic.views || 0;
  document.getElementById('fic-likes').textContent = fic.likes || 0;
  document.getElementById('fic-chapters').textContent = fic.chapters || 0;
  
  const updatedDate = new Date(fic.updatedAt);
  document.getElementById('fic-updated').textContent = `Обновлено ${updatedDate.toLocaleDateString('ru-RU')}`;

  // Render tags
  const tagsContainer = document.getElementById('fic-tags-header');
  if (fic.tags && fic.tags.length > 0) {
    tagsContainer.innerHTML = fic.tags.map(tag => 
      `<span class="fic-tag">${tag}</span>`
    ).join('');
  }

  // Update page title
  document.title = `${fic.title} - WenClerFic`;
}

async function loadChapters(ficId) {
  try {
    const response = await fetch(`${API_BASE}/fics/${ficId}/chapters`);
    const chapters = await response.json();

    renderChapters(chapters);
  } catch (error) {
    console.error('Error loading chapters:', error);
    // Show empty state or mock data
    renderChapters([]);
  }
}

function renderChapters(chapters) {
  const container = document.getElementById('chapters-list');
  
  if (chapters.length === 0) {
    container.innerHTML = '<p class="no-comments">Глав пока нет</p>';
    return;
  }

  container.innerHTML = chapters.map((chapter, index) => `
    <div class="chapter-item" onclick="window.location.href='/fic/${ficId}/chapter/${chapter.id}'">
      <div class="chapter-info">
        <div class="chapter-title">Глава ${index + 1}: ${chapter.title || 'Без названия'}</div>
        <div class="chapter-meta">
          ${chapter.createdAt ? new Date(chapter.createdAt).toLocaleDateString('ru-RU') : 'Дата не указана'} • 
          ${chapter.words || 0} слов
        </div>
      </div>
      <div class="chapter-actions">
        <button class="chapter-btn" onclick="event.stopPropagation(); window.location.href='/fic/${ficId}/chapter/${chapter.id}'">
          Читать
        </button>
      </div>
    </div>
  `).join('');
}

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
        </div>
        <div class="comment-text">${comment.text}</div>
      </div>
    `;
  }).join('');
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

