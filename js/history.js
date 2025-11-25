import { getStoredUser } from './session.js';

const API_BASE = window.location.origin + '/api';

let currentTab = 'my-texts';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  loadHistory();
});

function checkAuth() {
  const user = getStoredUser();
  if (!user) {
    window.location.href = '/';
    return;
  }
}

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      loadHistory();
    });
  });
}

async function loadHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  const user = getStoredUser();
  if (!user) return;

  historyList.innerHTML = '<div class="loading-spinner">Загрузка истории...</div>';

  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      type: currentTab === 'my-texts' ? 'create_chapter,update_chapter' : 'beta'
    });

    const response = await fetch(`${API_BASE}/user/actions?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (response.ok) {
      renderHistory(data.actions || []);
    } else {
      historyList.innerHTML = '<p class="error-message">Ошибка загрузки истории</p>';
    }
  } catch (error) {
    console.error('Error loading history:', error);
    historyList.innerHTML = '<p class="error-message">Ошибка подключения к серверу</p>';
  }
}

function renderHistory(actions) {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  if (actions.length === 0) {
    historyList.innerHTML = '<p class="no-history">История изменений пуста</p>';
    return;
  }

  historyList.innerHTML = actions.map(action => {
    const date = new Date(action.createdAt).toLocaleString('ru-RU');
    let actionText = '';
    
    switch (action.actionType) {
      case 'create_chapter':
        actionText = 'Создана глава';
        break;
      case 'update_chapter':
        actionText = 'Обновлена глава';
        break;
      default:
        actionText = action.actionType;
    }

    return `
      <div class="history-item">
        <div class="history-item__header">
          <span class="history-item__action">${actionText}</span>
          <span class="history-item__date">${date}</span>
        </div>
        ${action.metadata ? `<div class="history-item__meta">${JSON.stringify(action.metadata)}</div>` : ''}
      </div>
    `;
  }).join('');
}

