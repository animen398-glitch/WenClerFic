import { getStoredUser } from './session.js';
import { showNotification } from './app.js';

const API_BASE = window.location.origin + '/api';

let currentTab = 'drafts';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  loadMyFics();
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
      loadMyFics();
    });
  });
}

async function loadMyFics() {
  const ficsList = document.getElementById('my-fics-list');
  if (!ficsList) return;

  const user = getStoredUser();
  if (!user) return;

  ficsList.innerHTML = '<div class="loading-spinner">Загрузка фанфиков...</div>';

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/user/fics`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });

    const fics = await response.json();

    if (response.ok) {
      const filteredFics = filterFicsByTab(fics);
      renderFics(filteredFics);
      updateTabCounts(fics);
    } else {
      ficsList.innerHTML = '<p class="error-message">Ошибка загрузки фанфиков</p>';
    }
  } catch (error) {
    console.error('Error loading my fics:', error);
    ficsList.innerHTML = '<p class="error-message">Ошибка подключения к серверу</p>';
  }
}

function filterFicsByTab(fics) {
  switch (currentTab) {
    case 'drafts':
      return fics.filter(fic => fic.status === 'draft');
    case 'ongoing':
      return fics.filter(fic => fic.status === 'ongoing');
    case 'completed':
      return fics.filter(fic => fic.status === 'completed');
    case 'series':
      return fics.filter(fic => fic.isSeries);
    default:
      return fics;
  }
}

function updateTabCounts(fics) {
  document.getElementById('count-drafts').textContent = fics.filter(f => f.status === 'draft').length;
  document.getElementById('count-ongoing').textContent = fics.filter(f => f.status === 'ongoing').length;
  document.getElementById('count-completed').textContent = fics.filter(f => f.status === 'completed').length;
  document.getElementById('count-series').textContent = fics.filter(f => f.isSeries).length;
}

function renderFics(fics) {
  const ficsList = document.getElementById('my-fics-list');
  if (!ficsList) return;

  if (fics.length === 0) {
    ficsList.innerHTML = '<p class="no-fics">У вас пока нет фанфиков в этой категории</p>';
    return;
  }

  ficsList.innerHTML = fics.map(fic => {
    return `
      <div class="my-fic-card">
        <div class="my-fic-header">
          <h3 class="my-fic-title">
            <a href="/fic/${fic.id}">${fic.title || 'Без названия'}</a>
          </h3>
          <div class="my-fic-menu">
            <button class="menu-btn">⋯</button>
          </div>
        </div>
        <div class="my-fic-stats">
          <span>❤️ ${fic.likes || 0}</span>
        </div>
        <div class="my-fic-actions">
          <a href="/fic/${fic.id}/stats" class="action-link">Статистика</a>
          <a href="/fic/${fic.id}#comments" class="action-link">Отзывы (${fic.comments || 0})</a>
          <a href="/fic/${fic.id}/addpart" class="action-link">Добавить часть</a>
        </div>
        <div class="my-fic-promo">
          <button class="promo-btn" data-action="promo" data-fic-id="${fic.id}">В «ПРОМО»</button>
          <button class="promo-btn" data-action="hot-work" data-fic-id="${fic.id}">В «Горячее»</button>
        </div>
      </div>
    `;
  }).join('');
}

