import {
  syncSessionWithServer,
  getStoredUser,
  saveSessionData,
  clearSessionData
} from './session.js';

const API_BASE = window.location.origin + '/api';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  await checkAuth();
  if (!currentUser) {
    window.location.href = '/';
    return;
  }
  loadUserData();
  setupEventListeners();
}

async function checkAuth() {
  const cachedUser = getStoredUser();
  if (cachedUser) {
    currentUser = cachedUser;
    updateUserUI();
  }

  const session = await syncSessionWithServer();
  if (session?.user) {
    currentUser = session.user;
    updateUserUI();
  } else if (!cachedUser) {
    currentUser = null;
    updateUserUI();
  }
}

function updateUserUI() {
  const userNameEl = document.getElementById('user-name');
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
  } else {
    userNameEl.textContent = 'Войти';
  }
}

function loadUserData() {
  if (!currentUser) return;

  // Заполняем форму профиля
  document.getElementById('username').value = currentUser.username || '';
  document.getElementById('email').value = currentUser.email || '';

  // Загружаем настройки из localStorage
  const settings = JSON.parse(localStorage.getItem('user_settings') || '{}');
  
  // Уведомления
  document.getElementById('notify-comments').checked = settings.notifyComments !== false;
  document.getElementById('notify-likes').checked = settings.notifyLikes !== false;
  document.getElementById('notify-updates').checked = settings.notifyUpdates !== false;

  // Приватность
  document.getElementById('profile-public').checked = settings.profilePublic !== false;
  document.getElementById('show-email').checked = settings.showEmail === true;
}

function setupEventListeners() {
  // Профиль
  const profileForm = document.getElementById('profile-form');
  profileForm.addEventListener('submit', handleProfileUpdate);

  // Пароль
  const passwordForm = document.getElementById('password-form');
  passwordForm.addEventListener('submit', handlePasswordChange);

  // Уведомления
  document.getElementById('save-notifications-btn').addEventListener('click', saveNotifications);

  // Приватность
  document.getElementById('save-privacy-btn').addEventListener('click', savePrivacy);

  // Удаление аккаунта
  document.getElementById('delete-account-btn').addEventListener('click', handleDeleteAccount);

  // User menu
  const userBtn = document.getElementById('user-btn');
  const userDropdown = document.getElementById('user-dropdown');
  
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentUser) {
      userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
    } else {
      if (window.showAuthModal) {
        window.showAuthModal('login');
      }
    }
  });

  document.addEventListener('click', () => {
    userDropdown.style.display = 'none';
  });

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById('save-profile-btn');
  const username = document.getElementById('username').value.trim();

  if (!username || username.length < 3) {
    showError('Имя пользователя должно содержать минимум 3 символа');
    return;
  }

  if (username === currentUser.username) {
    showSuccess('Изменений не было');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser.username = username;
      saveSessionData(currentUser, token);
      updateUserUI();
      showSuccess('Имя пользователя успешно обновлено!');
    } else {
      showError(data.error || 'Ошибка при обновлении профиля');
    }
  } catch (error) {
    console.error('Profile update error:', error);
    showError('Ошибка подключения к серверу');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить изменения';
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const btn = document.getElementById('save-password-btn');
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showError('Заполните все поля');
    return;
  }

  if (newPassword.length < 6) {
    showError('Пароль должен содержать минимум 6 символов');
    return;
  }

  if (newPassword !== confirmPassword) {
    showError('Пароли не совпадают');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Изменение...';

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await response.json();

    if (response.ok) {
      showSuccess('Пароль успешно изменен!');
      document.getElementById('password-form').reset();
    } else {
      showError(data.error || 'Ошибка при изменении пароля');
    }
  } catch (error) {
    console.error('Password change error:', error);
    showError('Ошибка подключения к серверу');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Изменить пароль';
  }
}

function saveNotifications() {
  const settings = {
    notifyComments: document.getElementById('notify-comments').checked,
    notifyLikes: document.getElementById('notify-likes').checked,
    notifyUpdates: document.getElementById('notify-updates').checked
  };

  const existing = JSON.parse(localStorage.getItem('user_settings') || '{}');
  localStorage.setItem('user_settings', JSON.stringify({ ...existing, ...settings }));
  showSuccess('Настройки уведомлений сохранены!');
}

function savePrivacy() {
  const settings = {
    profilePublic: document.getElementById('profile-public').checked,
    showEmail: document.getElementById('show-email').checked
  };

  const existing = JSON.parse(localStorage.getItem('user_settings') || '{}');
  localStorage.setItem('user_settings', JSON.stringify({ ...existing, ...settings }));
  showSuccess('Настройки приватности сохранены!');
}

async function handleDeleteAccount() {
  if (!confirm('Вы уверены, что хотите удалить свой аккаунт? Это действие необратимо и все ваши данные будут удалены.')) {
    return;
  }

  if (!confirm('Это последнее предупреждение. Вы действительно хотите удалить аккаунт?')) {
    return;
  }

  const confirmation = prompt('Введите "УДАЛИТЬ" для подтверждения:');
  if (confirmation !== 'УДАЛИТЬ') {
    alert('Подтверждение не совпадает. Удаление отменено.');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/users/me`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      alert('Ваш аккаунт был удален.');
      clearSessionData();
      window.location.href = '/';
    } else {
      const data = await response.json();
      showError(data.error || 'Ошибка при удалении аккаунта');
    }
  } catch (error) {
    console.error('Delete account error:', error);
    showError('Ошибка подключения к серверу');
  }
}

function showSuccess(message) {
  const alert = document.getElementById('success-alert');
  alert.textContent = message;
  alert.classList.add('show');
  setTimeout(() => {
    alert.classList.remove('show');
  }, 3000);
}

function showError(message) {
  const alert = document.getElementById('error-alert');
  alert.textContent = message;
  alert.classList.add('show');
  setTimeout(() => {
    alert.classList.remove('show');
  }, 5000);
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
    currentUser = null;
    clearSessionData();
    window.location.href = '/';
  }
}

