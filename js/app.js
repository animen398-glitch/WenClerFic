import {
  syncSessionWithServer,
  getStoredUser,
  saveSessionData,
  clearSessionData
} from './session.js';

// API Configuration - автоматически определяет базовый URL
const API_BASE = window.location.origin + '/api';

// State
const state = {
  currentUser: null,
  fics: [],
  currentPage: 1,
  totalPages: 1,
  filters: {
    genre: '',
    rating: '',
    sort: 'newest'
  },
  viewMode: 'grid',
  pendingProfile: null
};

let oauthPopup = null;
let oauthCheckInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  await checkAuth();
  setupEventListeners();
  await loadFics();
}

// Authentication
async function checkAuth() {
  const cachedUser = getStoredUser();
  if (cachedUser) {
    state.currentUser = cachedUser;
    updateUserUI();
  }

  const session = await syncSessionWithServer();
  if (session?.user) {
    state.currentUser = session.user;
    updateUserUI();
  } else if (!cachedUser) {
    state.currentUser = null;
    updateUserUI();
  }
}

function updateUserUI() {
  const userNameEl = document.getElementById('user-name');
  const userBtn = document.getElementById('user-btn');
  
  if (state.currentUser) {
    userNameEl.textContent = state.currentUser.username;
    userBtn.style.cursor = 'pointer';
  } else {
    userNameEl.textContent = 'Войти';
    userBtn.style.cursor = 'pointer';
  }
}

// Event Listeners
function setupEventListeners() {
  window.addEventListener('message', handleOAuthMessage);

  // User menu
  const userBtn = document.getElementById('user-btn');
  const userDropdown = document.getElementById('user-dropdown');
  
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentUser) {
      userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
    } else {
      showAuthModal('login');
    }
  });

  document.addEventListener('click', () => {
    userDropdown.style.display = 'none';
  });

  // Auth modal
  const authModal = document.getElementById('auth-modal');
  const modalClose = document.getElementById('modal-close');
  const authNavLinks = document.querySelectorAll('.auth-nav-link');
  const loginPane = document.getElementById('login-section');
  const registerPane = document.getElementById('register-section');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const completeProfileModal = document.getElementById('complete-profile-modal');
  const completeProfileClose = document.getElementById('complete-profile-close');
  const completeProfileForm = document.getElementById('complete-profile-form');

  modalClose.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
      authModal.style.display = 'none';
    }
  });

  authNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = link.dataset.tab;
      setAuthTab(tabName);
    });
  });

  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  completeProfileForm?.addEventListener('submit', handleCompleteProfileSubmit);
  completeProfileClose?.addEventListener('click', closeCompleteProfileModal);
  completeProfileModal?.addEventListener('click', (e) => {
    if (e.target === completeProfileModal) {
      closeCompleteProfileModal();
    }
  });

  // OAuth buttons
  const googleLoginBtn = document.getElementById('google-login');
  const facebookLoginBtn = document.getElementById('facebook-login');
  const googleRegisterBtn = document.getElementById('google-register');
  const facebookRegisterBtn = document.getElementById('facebook-register');

  googleLoginBtn?.addEventListener('click', () => handleOAuth('google', 'login'));
  facebookLoginBtn?.addEventListener('click', () => handleOAuth('facebook', 'login'));
  googleRegisterBtn?.addEventListener('click', () => handleOAuth('google', 'register'));
  facebookRegisterBtn?.addEventListener('click', () => handleOAuth('facebook', 'register'));

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  // Filters
  const applyFiltersBtn = document.getElementById('apply-filters');
  applyFiltersBtn.addEventListener('click', () => {
    applyFilters();
  });

  // View toggle
  const viewBtns = document.querySelectorAll('.view-btn');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.viewMode = btn.dataset.view;
      updateViewMode();
    });
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.querySelector('.search-btn');
  
  searchBtn.addEventListener('click', () => {
    performSearch(searchInput.value);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
  setupAuthRequiredTriggers();
}

function showAuthModal(defaultTab = 'login') {
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.style.display = 'flex';
    setAuthTab(defaultTab);
  }
}

// Экспортируем функцию для использования в других файлах
window.showAuthModal = showAuthModal;

function setAuthTab(tabName = 'login') {
  const loginPane = document.getElementById('login-section');
  const registerPane = document.getElementById('register-section');
  const navTabs = document.querySelectorAll('.auth-nav-tab');

  navTabs.forEach(tab => {
    const link = tab.querySelector('.auth-nav-link');
    if (link?.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (loginPane && registerPane) {
    if (tabName === 'login') {
      loginPane.classList.add('active');
      registerPane.classList.remove('active');
    } else {
      loginPane.classList.remove('active');
      registerPane.classList.add('active');
    }
  }
}

function setupAuthRequiredTriggers() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-auth-required]');
    if (!trigger) {
      return;
    }

    if (state.currentUser) {
      return;
    }

    event.preventDefault();
    const desiredTab = trigger.dataset.authRequiredTab || 'register';
    showAuthModal(desiredTab);
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const rememberMe = document.getElementById('remember-me').checked;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, rememberMe })
    });

    const data = await response.json();
    
    if (response.ok) {
      state.currentUser = data.user;
      saveSessionData(data.user, data.token);
      updateUserUI();
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.style.display = 'none';
      }
      document.getElementById('login-form')?.reset();
      
      // Обновляем UI на страницах создания/добавления глав
      if (window.onAuthSuccess) {
        window.onAuthSuccess();
      }
    } else {
      alert(data.error || 'Ошибка входа');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Ошибка подключения к серверу');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-password-confirm').value;

  if (password !== confirmPassword) {
    alert('Пароли не совпадают');
    return;
  }

  if (password.length < 6) {
    alert('Пароль должен содержать минимум 6 символов');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password, rememberMe: true })
    });

    const data = await response.json();
    
    if (response.ok) {
      state.currentUser = data.user;
      saveSessionData(data.user, data.token);
      updateUserUI();
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.style.display = 'none';
      }
      document.getElementById('register-form')?.reset();
      alert('Регистрация успешна! Добро пожаловать!');
      
      // Обновляем UI на страницах создания/добавления глав
      if (window.onAuthSuccess) {
        window.onAuthSuccess();
      }
    } else {
      alert(data.error || 'Ошибка регистрации');
    }
  } catch (error) {
    console.error('Register error:', error);
    alert('Ошибка подключения к серверу');
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.warn('Logout request failed:', error);
  } finally {
    state.currentUser = null;
    clearSessionData();
    updateUserUI();
  }
}

// Load Fics
async function loadFics() {
  const spinner = document.getElementById('loading-spinner');
  const grid = document.getElementById('fics-grid');

  if (!spinner || !grid) {
    return;
  }

  spinner.style.display = 'block';

  try {
    const params = new URLSearchParams({
      page: state.currentPage,
      ...state.filters
    });

    const response = await fetch(`${API_BASE}/fics?${params}`);
    const data = await response.json();

    if (response.ok) {
      state.fics = data.fics;
      state.totalPages = data.totalPages;
      renderFics();
    } else {
      console.error('Error loading fics:', data.error);
    }
  } catch (error) {
    console.error('Error loading fics:', error);
    state.fics = [];
    renderFics();
  } finally {
    spinner.style.display = 'none';
  }
}

function renderFics() {
  const grid = document.getElementById('fics-grid');
  if (!grid) {
    return;
  }
  const gridContainer = grid.parentElement;
  if (!gridContainer) {
    return;
  }
  
  if (state.viewMode === 'list') {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }

  if (state.fics.length === 0) {
    grid.innerHTML = '<p class="no-fics">Пока нет фанфиков. Будьте первым, кто создаст фанфик!</p>';
    renderPagination();
    return;
  }

  grid.innerHTML = state.fics.map(fic => {
    const isAuthor = state.currentUser && fic.authorId === state.currentUser.id;
    return `
    <div class="fic-card" onclick="window.location.href='/fic/${fic.id}'">
      <div class="fic-card-header">
        <div>
          <a href="/fic/${fic.id}" class="fic-title" onclick="event.stopPropagation()">${fic.title}</a>
          <a href="/author/${fic.author?.id || fic.authorId}" class="fic-author" onclick="event.stopPropagation()">${fic.author?.username || 'Unknown'}</a>
        </div>
        ${isAuthor ? `<button class="fic-delete-btn" onclick="event.stopPropagation(); deleteFic(${fic.id})" title="Удалить фанфик">🗑️</button>` : ''}
      </div>
      <p class="fic-description">${fic.description || ''}</p>
      <div class="fic-tags">
        ${(fic.tags || []).map(tag => `<span class="fic-tag">${tag}</span>`).join('')}
      </div>
      <div class="fic-meta">
        <div class="fic-stats">
          <span class="fic-stat">👁 ${fic.views || 0}</span>
          <span class="fic-stat">❤️ ${fic.likes || 0}</span>
          <span class="fic-stat">📖 ${fic.chapters || 0} глав</span>
        </div>
        <div class="fic-rating">⭐ ${fic.rating || '—'}</div>
      </div>
    </div>
  `;
  }).join('');

  renderPagination();
}

async function deleteFic(ficId) {
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
      loadFics();
    } else {
      const data = await response.json();
      alert(data.error || 'Ошибка при удалении фанфика');
    }
  } catch (error) {
    console.error('Error deleting fic:', error);
    alert('Ошибка подключения к серверу');
  }
}

// Export for global access
window.deleteFic = deleteFic;

function updateViewMode() {
  const grid = document.getElementById('fics-grid');
  if (state.viewMode === 'list') {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  if (state.totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';
  
  // Previous button
  html += `<button class="pagination-btn" ${state.currentPage === 1 ? 'disabled' : ''} onclick="changePage(${state.currentPage - 1})">‹</button>`;

  // Page numbers
  for (let i = 1; i <= state.totalPages; i++) {
    if (i === 1 || i === state.totalPages || (i >= state.currentPage - 2 && i <= state.currentPage + 2)) {
      html += `<button class="pagination-btn ${i === state.currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === state.currentPage - 3 || i === state.currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  // Next button
  html += `<button class="pagination-btn" ${state.currentPage === state.totalPages ? 'disabled' : ''} onclick="changePage(${state.currentPage + 1})">›</button>`;

  pagination.innerHTML = html;
}

function changePage(page) {
  if (page < 1 || page > state.totalPages) return;
  state.currentPage = page;
  loadFics();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyFilters() {
  state.filters.genre = document.getElementById('genre-filter').value;
  state.filters.rating = document.getElementById('rating-filter').value;
  state.filters.sort = document.getElementById('sort-filter').value;
  state.currentPage = 1;
  loadFics();
}

function performSearch(query) {
  if (!query.trim()) return;
  // Implement search functionality
  console.log('Searching for:', query);
  // For now, just reload fics
  loadFics();
}

async function handleOAuth(provider, action) {
  try {
    const response = await fetch(`${API_BASE}/auth/${provider}?action=${action}`);
    const data = await response.json();
    
    if (data.authUrl) {
      const width = 500;
      const height = 600;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      closeOAuthPopup();
      oauthPopup = window.open(
        data.authUrl,
        `${provider}Auth`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!oauthPopup) {
        alert('Разрешите всплывающие окна для авторизации через Google');
        return;
      }

      if (oauthCheckInterval) {
        clearInterval(oauthCheckInterval);
      }

      oauthCheckInterval = setInterval(() => {
        if (!oauthPopup || oauthPopup.closed) {
          clearInterval(oauthCheckInterval);
          oauthCheckInterval = null;
          oauthPopup = null;
          checkAuth();
        }
      }, 1000);
    } else {
      window.location.href = `${API_BASE}/auth/${provider}?action=${action}`;
    }
  } catch (error) {
    console.error('OAuth error:', error);
    alert('Ошибка подключения к серверу OAuth');
  }
}

function handleOAuthMessage(event) {
  if (!event.data?.type) return;

  if (event.data.type === 'oauth-success') {
    if (event.data.user && event.data.token) {
      saveSessionData(event.data.user, event.data.token);
      state.currentUser = event.data.user;
      updateUserUI();
      document.getElementById('auth-modal')?.style.display = 'none';
      if (window.onAuthSuccess) {
        window.onAuthSuccess();
      }
      checkAuth();
    } else {
      checkAuth();
    }
    closeOAuthPopup();
    return;
  }

  if (event.data.type === 'oauth-profile-required') {
    closeOAuthPopup();
    document.getElementById('auth-modal')?.style.display = 'none';
    showCompleteProfileModal(event.data);
    return;
  }

  if (event.data.type === 'oauth-error') {
    alert(event.data.error || 'Ошибка OAuth');
    closeOAuthPopup();
  }
}

function closeOAuthPopup() {
  if (oauthPopup && !oauthPopup.closed) {
    oauthPopup.close();
  }
  oauthPopup = null;
  if (oauthCheckInterval) {
    clearInterval(oauthCheckInterval);
    oauthCheckInterval = null;
  }
}

function showCompleteProfileModal(data) {
  state.pendingProfile = data;
  const modal = document.getElementById('complete-profile-modal');
  if (!modal) return;

  const emailEl = document.getElementById('complete-profile-email');
  const usernameInput = document.getElementById('complete-username');
  const suggestedEl = document.getElementById('complete-profile-suggested');
  const avatarEl = document.getElementById('complete-profile-avatar');

  emailEl.textContent = data.email || '';
  usernameInput.value = data.username || '';
  suggestedEl.textContent = data.username || '';

  if (data.avatar) {
    avatarEl.src = data.avatar;
    avatarEl.style.display = 'block';
  } else {
    avatarEl.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeCompleteProfileModal() {
  const modal = document.getElementById('complete-profile-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.getElementById('complete-profile-form')?.reset();
  state.pendingProfile = null;
}

async function handleCompleteProfileSubmit(e) {
  e.preventDefault();
  if (!state.pendingProfile?.token) {
    alert('Сессия регистрации истекла. Попробуйте войти через Google ещё раз.');
    closeCompleteProfileModal();
    return;
  }

  const usernameInput = document.getElementById('complete-username');
  const passwordInput = document.getElementById('complete-password');
  const passwordConfirmInput = document.getElementById('complete-password-confirm');

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = passwordConfirmInput.value;

  if (!username) {
    alert('Имя пользователя не может быть пустым');
    return;
  }

  if (password.length < 6) {
    alert('Пароль должен быть длиннее 6 символов');
    return;
  }

  if (password !== confirmPassword) {
    alert('Пароли не совпадают');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/complete-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        token: state.pendingProfile.token,
        username,
        password
      })
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || 'Не удалось завершить регистрацию');
      if (response.status === 410 || response.status === 404) {
        closeCompleteProfileModal();
      }
      return;
    }

    state.pendingProfile = null;
    saveSessionData(data.user, data.token);
    state.currentUser = data.user;
    updateUserUI();
    closeCompleteProfileModal();

    if (window.onAuthSuccess) {
      window.onAuthSuccess();
    }
  } catch (error) {
    console.error('Complete profile error:', error);
    alert('Ошибка подключения к серверу');
  }
}

// Export for global access
window.changePage = changePage;

document.addEventListener('wenclerfic:auth-changed', (event) => {
  state.currentUser = event.detail?.user || null;
  updateUserUI();
});

