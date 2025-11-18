// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

let currentUser = null;
let profileUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadProfile();
});

function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    updateUserUI();
  }
}

function updateUserUI() {
  const userNameEl = document.getElementById('user-name');
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
  }
}

function getUserIdFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/author\/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  // If on /profile, use current user
  if (path === '/profile' && currentUser) {
    return currentUser.id;
  }
  return null;
}

async function loadProfile() {
  profileUserId = getUserIdFromUrl();
  
  if (!profileUserId) {
    if (currentUser) {
      profileUserId = currentUser.id;
    } else {
      document.querySelector('.main-content').innerHTML = `
        <div class="container" style="text-align: center; padding: 3rem;">
          <h2>Войдите, чтобы просмотреть профиль</h2>
          <a href="/" class="btn btn-primary">На главную</a>
        </div>
      `;
      return;
    }
  }

  try {
    const response = await fetch(`${API_BASE}/users/${profileUserId}`);
    const data = await response.json();

    if (response.ok) {
      renderProfile(data);
    } else {
      showError(data.error || 'Ошибка загрузки профиля');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showError('Ошибка подключения к серверу');
  }
}

function renderProfile(user) {
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-email').textContent = user.email || '—';
  document.title = `${user.username} - Профиль - WenClerFic`;

  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  if (user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="${user.username}">`;
  } else {
    avatarEl.textContent = user.username.charAt(0).toUpperCase();
  }

  // Stats
  if (user.stats) {
    document.getElementById('stat-fics').textContent = user.stats.ficsCount || 0;
    document.getElementById('stat-views').textContent = user.stats.totalViews || 0;
    document.getElementById('stat-likes').textContent = user.stats.totalLikes || 0;
    document.getElementById('stat-chapters').textContent = user.stats.totalChapters || 0;
  }

  // Profile actions (if viewing own profile)
  const profileActions = document.getElementById('profile-actions');
  const isOwnProfile = currentUser && user.id === currentUser.id;
  if (isOwnProfile) {
    profileActions.innerHTML = `
      <a href="/profile/settings" class="btn btn-outline" style="background: rgba(255, 255, 255, 0.2); color: white; border-color: rgba(255, 255, 255, 0.3);">⚙️ Настройки</a>
      <button onclick="cleanupTestFics()" class="btn btn-outline" style="background: rgba(255, 255, 255, 0.2); color: white; border-color: rgba(255, 255, 255, 0.3); margin-top: 0.5rem;">🧹 Удалить тестовые фанфики</button>
    `;
  }

  // Fics count
  const ficsCount = user.fics ? user.fics.length : 0;
  document.getElementById('fics-count').textContent = `${ficsCount} ${ficsCount === 1 ? 'фанфик' : ficsCount < 5 ? 'фанфика' : 'фанфиков'}`;

  // Fics list
  const ficsList = document.getElementById('fics-list');
  if (user.fics && user.fics.length > 0) {
    ficsList.innerHTML = user.fics.map(fic => {
      const isAuthor = currentUser && fic.authorId === currentUser.id;
      return `
      <div class="fic-item">
        <div class="fic-item-info">
          <h3><a href="/fic/${fic.id}">${fic.title}</a></h3>
          <p>${fic.description || 'Нет описания'}</p>
          <div class="fic-item-meta">
            <span>👁 ${fic.views || 0}</span>
            <span>❤️ ${fic.likes || 0}</span>
            <span>📖 ${fic.chapters || 0} глав</span>
            <span>⭐ ${fic.rating || '—'}</span>
            ${fic.status ? `<span>${fic.status === 'ongoing' ? '🔄 В процессе' : '✅ Завершен'}</span>` : ''}
          </div>
        </div>
        <div class="fic-item-actions">
          <a href="/fic/${fic.id}" class="btn btn-outline">Открыть</a>
          ${isAuthor ? `<button class="btn btn-outline" onclick="deleteFicFromProfile(${fic.id})" style="color: var(--error);">🗑️</button>` : ''}
        </div>
      </div>
    `;
    }).join('');
  } else {
    ficsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">У этого автора пока нет фанфиков</p>';
  }

  // Setup tabs
  setupTabs();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.profile-tab');
  const tabContents = document.querySelectorAll('.profile-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
    });
  });
}

async function deleteFicFromProfile(ficId) {
  if (!confirm('Вы уверены, что хотите удалить этот фанфик? Это действие нельзя отменить.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/fics/${ficId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      alert('Фанфик успешно удален');
      loadProfile();
    } else {
      const data = await response.json();
      alert(data.error || 'Ошибка при удалении фанфика');
    }
  } catch (error) {
    console.error('Error deleting fic:', error);
    alert('Ошибка подключения к серверу');
  }
}

window.deleteFicFromProfile = deleteFicFromProfile;

async function cleanupTestFics() {
  if (!confirm('Вы уверены, что хотите удалить все тестовые фанфики? Это действие нельзя отменить.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/fics/cleanup/test`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || 'Тестовые фанфики успешно удалены');
      loadProfile();
      // Reload main page if we're on it
      if (window.location.pathname === '/') {
        window.location.reload();
      }
    } else {
      alert(data.error || 'Ошибка при удалении тестовых фанфиков');
    }
  } catch (error) {
    console.error('Error cleaning up test fics:', error);
    alert('Ошибка подключения к серверу');
  }
}

window.cleanupTestFics = cleanupTestFics;

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

