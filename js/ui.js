// UI helpers for глобальная шапка, уведомления и меню аватара
const STORAGE_KEYS = {
  notifications: 'wenNotificationsState',
};

const sampleNotifications = [
  {
    id: 'n1',
    icon: '💬',
    title: 'Новый комментарий',
    text: 'Пользователь MoonLight оставил отзыв к вашей работе',
    date: '2 часа назад',
    unread: true,
  },
  {
    id: 'n2',
    icon: '🔥',
    title: 'Работа в топе',
    text: '«Сердце дракона» поднялась в популярное',
    date: 'Вчера',
    unread: true,
  },
  {
    id: 'n3',
    icon: '🪙',
    title: 'Начисление монет',
    text: '+120 монет за покупку подписчиками',
    date: '3 дня назад',
    unread: false,
  },
];

const state = {
  notifications: [],
  isPanelOpen: false,
};

function initHeaderUI() {
  setupNotifications();
  setupAvatarMenu();
  wireSearchForm();
}

function setupNotifications() {
  const stored = localStorage.getItem(STORAGE_KEYS.notifications);
  state.notifications = stored ? JSON.parse(stored) : sampleNotifications;
  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notifications-panel');
  const list = document.getElementById('notifications-list');
  const badge = document.getElementById('notification-count');
  const markAllBtn = document.getElementById('mark-all-read');

  if (!bell || !panel || !list || !badge) return;

  const render = () => {
    list.innerHTML = state.notifications
      .map(
        (item) => `
        <article class="notifications-panel__item ${
          item.unread ? 'notifications-panel__item--unread' : ''
        }">
          <div class="notifications-panel__icon">${item.icon}</div>
          <div class="notifications-panel__body">
            <div class="notifications-panel__title">${item.title}</div>
            <p class="notifications-panel__description">${item.text}</p>
            <span class="notifications-panel__date">${item.date}</span>
          </div>
        </article>
      `,
      )
      .join('');

    const unreadCount = state.notifications.filter((n) => n.unread).length;
    badge.textContent = unreadCount;
    badge.hidden = unreadCount === 0;
    localStorage.setItem(
      STORAGE_KEYS.notifications,
      JSON.stringify(state.notifications),
    );
  };

  const togglePanel = (force) => {
    state.isPanelOpen = typeof force === 'boolean' ? force : !state.isPanelOpen;
    panel.classList.toggle('notifications-panel--open', state.isPanelOpen);
    panel.setAttribute('aria-hidden', (!state.isPanelOpen).toString());
  };

  bell.addEventListener('click', () => togglePanel());

  markAllBtn?.addEventListener('click', () => {
    state.notifications = state.notifications.map((n) => ({
      ...n,
      unread: false,
    }));
    render();
  });

  document.addEventListener('click', (event) => {
    if (
      state.isPanelOpen &&
      !panel.contains(event.target) &&
      !bell.contains(event.target)
    ) {
      togglePanel(false);
    }
  });

  render();
}

function setupAvatarMenu() {
  const trigger = document.getElementById('avatar-trigger');
  const dropdown = document.getElementById('avatar-dropdown');

  if (!trigger || !dropdown) return;

  const toggle = (force) => {
    const isOpen = typeof force === 'boolean'
      ? force
      : dropdown.getAttribute('aria-hidden') === 'true';
    dropdown.setAttribute('aria-hidden', (!isOpen).toString());
    trigger.setAttribute('aria-expanded', isOpen.toString());
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const shouldOpen = dropdown.getAttribute('aria-hidden') === 'true';
    toggle(shouldOpen);
  });

  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target) && !trigger.contains(event.target)) {
      toggle(false);
    }
  });
  
  // Добавляем обработчики для кнопок меню
  setupMenuButtonHandlers();
  
  // Обработчик кнопки "Выйти"
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleLogout();
    });
  }
}

async function handleLogout() {
  try {
    const API_BASE = window.location.origin + '/api';
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.warn('Logout request failed:', error);
  } finally {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  }
}

function setupMenuButtonHandlers() {
  // Получаем текущего пользователя из localStorage
  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  };

  // Обработчики для кнопок "Кабинет"
  document.querySelectorAll('.avatar-menu__item[data-role]').forEach(btn => {
    // Удаляем старые обработчики
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const role = newBtn.dataset.role;
      if (role === 'author') {
        window.location.href = '/my-fics';
      } else if (role === 'reader') {
        window.location.href = '/bookmarks';
      } else if (role === 'helper') {
        alert('Кабинет помощника - в разработке');
      }
    });
  });

  // Обработчики для остальных кнопок меню
  document.querySelectorAll('.avatar-menu__item').forEach(btn => {
    const text = btn.textContent.trim();
    const href = btn.getAttribute('href');
    
    // Пропускаем ссылки
    if (href) return;
    
    // Пропускаем кнопки с data-role (уже обработаны)
    if (btn.dataset.role) return;
    
    // Пропускаем кнопку "Выйти" (обрабатывается отдельно)
    if (btn.id === 'logout-btn') return;
    
    // Пропускаем label элементы
    if (btn.classList.contains('avatar-menu__item--label')) return;
    
    // Удаляем старые обработчики
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleMenuButtonClick(text, newBtn);
    });
  });
}

function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

function handleMenuButtonClick(menuText, button) {
  const currentUser = getCurrentUser();
  
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
      if (!currentUser) {
        if (window.showAuthModal) {
          window.showAuthModal('register');
        } else {
          window.location.href = '/';
        }
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
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-close')) {
      modal.remove();
    }
  });
}

function showCoinsModal() {
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
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-close')) {
      modal.remove();
    }
  });
}

function wireSearchForm() {
  const form = document.querySelector('.global-header__search');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.querySelector('input');
    if (input && input.value.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(input.value.trim())}`;
    }
  });
}

document.addEventListener('DOMContentLoaded', initHeaderUI);


