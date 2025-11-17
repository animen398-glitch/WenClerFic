const API_BASE = 'http://localhost:3000/api';

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

  // Stats
  if (user.stats) {
    document.getElementById('stat-fics').textContent = user.stats.ficsCount || 0;
    document.getElementById('stat-views').textContent = user.stats.totalViews || 0;
    document.getElementById('stat-likes').textContent = user.stats.totalLikes || 0;
  }

  // Fics list
  const ficsList = document.getElementById('fics-list');
  if (user.fics && user.fics.length > 0) {
    ficsList.innerHTML = user.fics.map(fic => `
      <div class="fic-item">
        <div class="fic-item-info">
          <h3><a href="/fic/${fic.id}" style="color: var(--primary-color); text-decoration: none;">${fic.title}</a></h3>
          <p>${fic.description || 'Нет описания'}</p>
          <div style="margin-top: 0.5rem; display: flex; gap: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
            <span>👁 ${fic.views || 0}</span>
            <span>❤️ ${fic.likes || 0}</span>
            <span>📖 ${fic.chapters || 0} глав</span>
            <span>⭐ ${fic.rating || '—'}</span>
          </div>
        </div>
        <div>
          <a href="/fic/${fic.id}" class="btn btn-outline">Открыть</a>
        </div>
      </div>
    `).join('');
  } else {
    ficsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">У этого автора пока нет фанфиков</p>';
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

