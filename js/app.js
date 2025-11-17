// API Configuration
const API_BASE = 'http://localhost:3000/api';

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
  const authTabs = document.querySelectorAll('.auth-tab');
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

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (tabName === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
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
  const formData = new FormData(e.target);
  const email = e.target.querySelector('input[type="email"]').value;
  const password = e.target.querySelector('input[type="password"]').value;

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
      updateUserUI();
      document.getElementById('auth-modal').style.display = 'none';
      e.target.reset();
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
  const inputs = e.target.querySelectorAll('input');
  const username = inputs[0].value;
  const email = inputs[1].value;
  const password = inputs[2].value;
  const confirmPassword = inputs[3].value;

  if (password !== confirmPassword) {
    alert('Пароли не совпадают');
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
      e.target.reset();
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
    // Use mock data for development
    loadMockFics();
  } finally {
    spinner.style.display = 'none';
  }
}

function loadMockFics() {
  state.fics = [
    {
      id: 1,
      title: 'Приключения в магическом мире',
      author: { username: 'Author1', id: 1 },
      description: 'История о молодом волшебнике, который открывает для себя новый мир магии и приключений...',
      genre: 'fantasy',
      rating: 'PG-13',
      tags: ['магия', 'приключения', 'фэнтези'],
      views: 1250,
      likes: 89,
      chapters: 12,
      updatedAt: '2025-01-15'
    },
    {
      id: 2,
      title: 'Романтика в большом городе',
      author: { username: 'Author2', id: 2 },
      description: 'Современная история любви, разворачивающаяся на фоне городской суеты...',
      genre: 'romance',
      rating: 'PG',
      tags: ['романтика', 'современность'],
      views: 890,
      likes: 67,
      chapters: 8,
      updatedAt: '2025-01-14'
    },
    {
      id: 3,
      title: 'Тайны старого особняка',
      author: { username: 'Author3', id: 3 },
      description: 'Детективная история с элементами мистики, происходящая в заброшенном особняке...',
      genre: 'horror',
      rating: 'R',
      tags: ['ужасы', 'мистика', 'детектив'],
      views: 2100,
      likes: 145,
      chapters: 15,
      updatedAt: '2025-01-16'
    }
  ];
  renderFics();
}

function renderFics() {
  const grid = document.getElementById('fics-grid');
  const gridContainer = grid.parentElement;
  
  if (state.viewMode === 'list') {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }

  grid.innerHTML = state.fics.map(fic => `
    <div class="fic-card" onclick="window.location.href='/fic/${fic.id}'">
      <div class="fic-card-header">
        <div>
          <a href="/fic/${fic.id}" class="fic-title" onclick="event.stopPropagation()">${fic.title}</a>
          <a href="/author/${fic.author.id}" class="fic-author" onclick="event.stopPropagation()">${fic.author.username}</a>
        </div>
      </div>
      <p class="fic-description">${fic.description}</p>
      <div class="fic-tags">
        ${fic.tags.map(tag => `<span class="fic-tag">${tag}</span>`).join('')}
      </div>
      <div class="fic-meta">
        <div class="fic-stats">
          <span class="fic-stat">👁 ${fic.views}</span>
          <span class="fic-stat">❤️ ${fic.likes}</span>
          <span class="fic-stat">📖 ${fic.chapters} глав</span>
        </div>
        <div class="fic-rating">⭐ ${fic.rating}</div>
      </div>
    </div>
  `).join('');

  renderPagination();
}

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
    
    // Демо-режим: если сервер вернул пользователя напрямую
    if (data.demo && data.user) {
      state.currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      updateUserUI();
      document.getElementById('auth-modal').style.display = 'none';
      alert(`✅ ${data.message || 'Демо-авторизация успешна!'}\n\nВы вошли как: ${data.user.username}`);
      return;
    }
    
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

