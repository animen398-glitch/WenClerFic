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
  checkOAuthFallback();
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
  const avatarTrigger = document.getElementById('avatar-trigger');
  const userBtn = document.getElementById('user-btn'); // fallback
  
  if (state.currentUser) {
    if (userNameEl) userNameEl.textContent = state.currentUser.username;
    if (avatarTrigger) {
      const avatarEl = avatarTrigger.querySelector('.avatar-menu__avatar');
      if (avatarEl && state.currentUser.avatar) {
        avatarEl.style.backgroundImage = `url(${state.currentUser.avatar})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.textContent = '';
      }
    }
  } else {
    if (userNameEl) userNameEl.textContent = 'Войти';
    if (avatarTrigger) {
      const avatarEl = avatarTrigger.querySelector('.avatar-menu__avatar');
      if (avatarEl) {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = '👤';
      }
    }
  }
}

// Event Listeners
function setupEventListeners() {
  window.addEventListener('message', handleOAuthMessage);

  // User menu (новый global-header стиль)
  const avatarTrigger = document.getElementById('avatar-trigger');
  const avatarDropdown = document.getElementById('avatar-dropdown');
  const userBtn = document.getElementById('user-btn'); // fallback для старых страниц
  
  if (avatarTrigger) {
    avatarTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentUser) {
        const isOpen = avatarDropdown.getAttribute('aria-hidden') === 'false';
        avatarDropdown.setAttribute('aria-hidden', isOpen.toString());
        avatarTrigger.setAttribute('aria-expanded', (!isOpen).toString());
      } else {
        showAuthModal('login');
      }
    });

    document.addEventListener('click', (e) => {
      if (avatarDropdown && !avatarDropdown.contains(e.target) && !avatarTrigger.contains(e.target)) {
        avatarDropdown.setAttribute('aria-hidden', 'true');
        avatarTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  } else if (userBtn) {
    // Fallback для старых страниц
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
      if (userDropdown) userDropdown.style.display = 'none';
    });
  }

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

  // Search (новый global-header стиль)
  const searchInput = document.getElementById('search-input');
  const searchForm = document.querySelector('.global-header__search');
  const searchBtn = document.querySelector('.search-btn'); // fallback
  
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (searchInput && searchInput.value.trim()) {
        performSearch(searchInput.value);
      }
    });
  } else if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      performSearch(searchInput.value);
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch(searchInput.value);
      }
    });
  }
  
  setupAuthRequiredTriggers();
  
  // Устанавливаем обработчики меню после небольшой задержки, чтобы DOM точно был готов
  setTimeout(() => {
    setupMenuHandlers();
  }, 100);
}

function setupMenuHandlers() {
  // Удаляем старые обработчики, чтобы не дублировать
  const menuItems = document.querySelectorAll('.avatar-menu__item');
  menuItems.forEach(btn => {
    // Клонируем элемент, чтобы удалить все обработчики
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
  });

  // Обработчики для кнопок "Кабинет"
  document.querySelectorAll('.avatar-menu__item[data-role]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const role = btn.dataset.role;
      if (role === 'author') {
        window.location.href = '/my-fics';
      } else if (role === 'reader') {
        window.location.href = '/bookmarks';
      } else if (role === 'helper') {
        alert('Кабинет помощника - в разработке');
        // window.location.href = '/helper/cabinet';
      }
    });
  });

  // Обработчики для остальных кнопок меню
  document.querySelectorAll('.avatar-menu__item').forEach(btn => {
    const text = btn.textContent.trim();
    const href = btn.getAttribute('href');
    
    // Пропускаем кнопки, которые уже имеют href (ссылки) - они работают автоматически
    if (href) return;
    
    // Пропускаем кнопки с data-role (уже обработаны выше)
    if (btn.dataset.role) return;
    
    // Пропускаем кнопку "Выйти" (уже обработана отдельно)
    if (btn.id === 'logout-btn') return;
    
    // Пропускаем label элементы
    if (btn.classList.contains('avatar-menu__item--label')) return;
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleMenuClick(text, btn);
    });
  });
}

function handleMenuClick(menuText, button) {
  switch(menuText) {
    case 'Улучшить аккаунт':
      showPremiumModal();
      break;
    case 'Мои новости':
      window.location.href = '/news';
      break;
    case 'Мой профиль':
      window.location.href = '/profile';
      break;
    case 'Личные сообщения':
      window.location.href = '/messages';
      break;
    case 'Добавить фанфик':
      if (!state.currentUser) {
        showAuthModal('register');
      } else {
        window.location.href = '/create';
      }
      break;
    case 'Мои фанфики':
      window.location.href = '/my-fics';
      break;
    case 'Мой блог':
      window.location.href = '/blog';
      break;
    case 'Отзывы':
      window.location.href = '/reviews';
      break;
    case 'История изменений':
      window.location.href = '/history';
      break;
    case 'Сообщения об ошибках':
      window.location.href = '/error-reports';
      break;
    case 'Персональный баннер':
      window.location.href = '/profile/banner';
      break;
    case 'Купить монеты':
      showCoinsModal();
      break;
    case 'Заявки':
      window.location.href = '/requests';
      break;
    case 'Связь':
      window.location.href = '/contact';
      break;
    case 'Настройки':
      window.location.href = '/profile/settings';
      break;
    default:
      console.log('Неизвестная кнопка меню:', menuText);
      alert(`${menuText} - функция в разработке`);
  }
}

function showPremiumModal() {
  // Создаем модальное окно для премиум-аккаунта
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';
  
  modal.innerHTML = `
    <div class="modal-content" style="background: var(--surface); border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%; position: relative;">
      <span class="modal-close" style="position: absolute; top: 1rem; right: 1rem; font-size: 2rem; cursor: pointer; color: var(--text-secondary);">&times;</span>
      <h2 style="margin-bottom: 1rem; color: var(--text-primary);">✨ Улучшить аккаунт</h2>
      <div style="color: var(--text-secondary); line-height: 1.8;">
        <p style="margin-bottom: 1rem;"><strong style="color: var(--primary-color);">Премиум-аккаунт</strong> дает вам:</p>
        <ul style="margin-left: 1.5rem; margin-bottom: 1.5rem;">
          <li>🚀 Приоритетная поддержка</li>
          <li>📊 Расширенная статистика</li>
          <li>🎨 Персональный баннер</li>
          <li>📝 Неограниченное количество фанфиков</li>
          <li>🚫 Без рекламы</li>
        </ul>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Скоро будет доступно для покупки!</p>
      </div>
      <button class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;" onclick="this.closest('.modal').remove()">Понятно</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Закрытие по клику на фон
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Закрытие по кнопке X
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
}

function showCoinsModal() {
  // Создаем модальное окно для покупки монет
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';
  
  modal.innerHTML = `
    <div class="modal-content" style="background: var(--surface); border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%; position: relative;">
      <span class="modal-close" style="position: absolute; top: 1rem; right: 1rem; font-size: 2rem; cursor: pointer; color: var(--text-secondary);">&times;</span>
      <h2 style="margin-bottom: 1rem; color: var(--text-primary);">🪙 Купить монеты</h2>
      <div style="color: var(--text-secondary); line-height: 1.8;">
        <p style="margin-bottom: 1rem;">Монеты можно использовать для:</p>
        <ul style="margin-left: 1.5rem; margin-bottom: 1.5rem;">
          <li>⭐ Поднятие фанфика в топ</li>
          <li>🎁 Покупка премиум-функций</li>
          <li>💎 Специальные возможности</li>
        </ul>
        <div style="background: rgba(124, 58, 237, 0.1); border: 1px solid var(--primary-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
          <p style="margin: 0; color: var(--text-primary);"><strong>Ваш баланс: 0 монет</strong></p>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Система монет скоро будет доступна!</p>
      </div>
      <button class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;" onclick="this.closest('.modal').remove()">Понятно</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Закрытие по клику на фон
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Закрытие по кнопке X
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
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

function checkOAuthFallback() {
  // Проверяем localStorage на наличие OAuth сообщений (fallback если postMessage не сработал)
  try {
    const oauthMessage = localStorage.getItem('oauth_message');
    const oauthError = localStorage.getItem('oauth_error');
    
    if (oauthMessage) {
      localStorage.removeItem('oauth_message');
      const message = JSON.parse(oauthMessage);
      handleOAuthMessage({ data: message });
    }
    
    if (oauthError) {
      localStorage.removeItem('oauth_error');
      const error = JSON.parse(oauthError);
      handleOAuthMessage({ data: error });
    }
  } catch (e) {
    console.warn('Error checking OAuth fallback:', e);
  }
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
    const tags = (fic.tags || []).map(tag => `<span class="status-pill" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);">${tag}</span>`).join('');
    return `
    <div class="fic-card" style="background: linear-gradient(145deg, #1b0b2f, #0e0419); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 2rem; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45); cursor: pointer; transition: transform 0.2s;" onclick="window.location.href='/fic/${fic.id}'" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
      <div class="fic-card__top" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
        <span class="fic-card__badge" style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; background: rgba(255, 255, 255, 0.08); padding: 0.2rem 0.75rem; border-radius: 999px;">ID ${fic.id}</span>
        ${isAuthor ? `<button style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ef4444; padding: 0.25rem 0.75rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem;" onclick="event.stopPropagation(); deleteFic(${fic.id})" title="Удалить фанфик">🗑️</button>` : ''}
      </div>
      <h2 class="fic-card__title" style="font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1.1; margin-bottom: 1rem; color: #fff;">
        <a href="/fic/${fic.id}" onclick="event.stopPropagation()" style="color: inherit; text-decoration: none;">${fic.title || 'Без названия'}</a>
      </h2>
      <div class="fic-card__meta" style="display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: center; color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">
        <a href="/author/${fic.author?.id || fic.authorId}" onclick="event.stopPropagation()" style="color: inherit; text-decoration: none; display: flex; align-items: center; gap: 0.5rem;">
          <span>${fic.author?.username || 'Unknown'}</span>
        </a>
        <span>•</span>
        <span>${fic.genre || 'Жанр не указан'}</span>
        <span>•</span>
        <span>${fic.chapters || 0} глав</span>
      </div>
      <div class="fic-card__status" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="status-pill" style="border-radius: 999px; padding: 0.35rem 0.9rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid rgba(255, 255, 255, 0.15);">${fic.genre || 'Жанр'}</span>
        <span class="status-pill" style="border-radius: 999px; padding: 0.35rem 0.9rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid rgba(255, 255, 255, 0.15);">${fic.rating || 'Рейтинг'}</span>
        <span class="status-pill" style="border-radius: 999px; padding: 0.35rem 0.9rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid rgba(255, 255, 255, 0.15);">${fic.status === 'completed' ? 'Завершен' : 'В процессе'}</span>
      </div>
      ${tags ? `<div class="fic-card__tags" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem;">${tags}</div>` : ''}
      <p class="fic-card__description" style="color: var(--text-secondary); line-height: 1.7; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${fic.description || 'Описание отсутствует'}</p>
      <div class="fic-card__stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem; margin: 1.5rem 0;">
        <div class="fic-card__stat" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
          <span>👁</span><strong style="font-size: 1.25rem; color: #fff;">${fic.views || 0}</strong><span>просмотров</span>
        </div>
        <div class="fic-card__stat" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
          <span>❤️</span><strong style="font-size: 1.25rem; color: #fff;">${fic.likes || 0}</strong><span>лайков</span>
        </div>
        <div class="fic-card__stat" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
          <span>📚</span><strong style="font-size: 1.25rem; color: #fff;">${fic.chapters || 0}</strong><span>глав</span>
        </div>
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
  if (!grid) return;
  
  if (state.viewMode === 'list') {
    grid.style.gridTemplateColumns = '1fr';
    grid.classList.add('list-view');
  } else {
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
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
        try {
          // Проверяем localStorage на наличие OAuth сообщений (fallback)
          checkOAuthFallback();
          
          if (!oauthPopup) {
            clearInterval(oauthCheckInterval);
            oauthCheckInterval = null;
            checkAuth();
            return;
          }
          // Безопасная проверка закрытия окна
          if (oauthPopup.closed) {
            clearInterval(oauthCheckInterval);
            oauthCheckInterval = null;
            oauthPopup = null;
            // Финальная проверка localStorage перед закрытием
            checkOAuthFallback();
            checkAuth();
          }
        } catch (e) {
          // Игнорируем ошибки Cross-Origin-Opener-Policy
          // Полагаемся на postMessage и localStorage для определения закрытия окна
        }
      }, 500);
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
      const authModalEl = document.getElementById('auth-modal');
      if (authModalEl) {
        authModalEl.style.display = 'none';
      }
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
    const authModalEl = document.getElementById('auth-modal');
    if (authModalEl) {
      authModalEl.style.display = 'none';
    }
    showCompleteProfileModal(event.data);
    return;
  }

  if (event.data.type === 'oauth-error') {
    alert(event.data.error || 'Ошибка OAuth');
    closeOAuthPopup();
  }
}

function closeOAuthPopup() {
  try {
    if (oauthPopup) {
      try {
        if (!oauthPopup.closed) {
          oauthPopup.close();
        }
      } catch (e) {
        // Игнорируем ошибки Cross-Origin-Opener-Policy при проверке closed
      }
    }
  } catch (e) {
    // Игнорируем ошибки при закрытии
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

