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
  viewMode: 'grid'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  checkAuth();
  setupEventListeners();
  await loadFics();
}

// Authentication
function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    state.currentUser = JSON.parse(user);
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
  // User menu
  const userBtn = document.getElementById('user-btn');
  const userDropdown = document.getElementById('user-dropdown');
  
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentUser) {
      userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
    } else {
      showAuthModal();
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
      
      // Update nav tabs
      document.querySelectorAll('.auth-nav-tab').forEach(tab => {
        tab.classList.remove('active');
      });
      link.closest('.auth-nav-tab').classList.add('active');
      
      // Update panes
      if (tabName === 'login') {
        loginPane.classList.add('active');
        registerPane.classList.remove('active');
      } else {
        loginPane.classList.remove('active');
        registerPane.classList.add('active');
      }
    });
  });

  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);

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
}

function showAuthModal() {
  const authModal = document.getElementById('auth-modal');
  authModal.style.display = 'flex';
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
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (response.ok) {
      state.currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
      updateUserUI();
      document.getElementById('auth-modal').style.display = 'none';
      loginForm.reset();
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
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();
    
    if (response.ok) {
      state.currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      updateUserUI();
      document.getElementById('auth-modal').style.display = 'none';
      registerForm.reset();
      alert('Регистрация успешна! Добро пожаловать!');
    } else {
      alert(data.error || 'Ошибка регистрации');
    }
  } catch (error) {
    console.error('Register error:', error);
    alert('Ошибка подключения к серверу');
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  updateUserUI();
}

// Load Fics
async function loadFics() {
  const spinner = document.getElementById('loading-spinner');
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
  const gridContainer = grid.parentElement;
  
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
    // Redirect to OAuth endpoint
    const response = await fetch(`${API_BASE}/auth/${provider}?action=${action}`, {
      method: 'GET'
    });
    
    const data = await response.json();
    
    if (data.authUrl) {
      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        `${provider}Auth`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth callback
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          // Check if user is logged in
          checkAuth();
        }
      }, 1000);

      // Listen for message from popup
      window.addEventListener('message', (event) => {
        if (event.data.type === 'oauth-success') {
          state.currentUser = event.data.user;
          localStorage.setItem('user', JSON.stringify(event.data.user));
          localStorage.setItem('token', event.data.token);
          updateUserUI();
          document.getElementById('auth-modal').style.display = 'none';
          popup.close();
        }
      });
    } else {
      // Fallback: direct redirect for development
      window.location.href = `${API_BASE}/auth/${provider}?action=${action}`;
    }
  } catch (error) {
    console.error('OAuth error:', error);
    alert('Ошибка подключения к серверу OAuth');
  }
}

// Export for global access
window.changePage = changePage;

