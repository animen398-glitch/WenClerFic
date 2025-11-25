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

