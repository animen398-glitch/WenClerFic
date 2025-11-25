import { getStoredUser } from './session.js';

const API_BASE = window.location.origin + '/api';

let currentTab = 'week';
let searchQuery = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadAuthors();
});

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      loadAuthors();
    });
  });

  // Search
  const searchInput = document.getElementById('author-search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchQuery = e.target.value.trim();
      searchTimeout = setTimeout(() => {
        loadAuthors();
      }, 300);
    });
  }
}

async function loadAuthors() {
  const authorsList = document.getElementById('authors-list');
  if (!authorsList) return;

  authorsList.innerHTML = '<div class="loading-spinner">Загрузка авторов...</div>';

  try {
    const params = new URLSearchParams({
      period: currentTab,
      search: searchQuery
    });

    const response = await fetch(`${API_BASE}/authors?${params}`);
    const data = await response.json();

    if (response.ok) {
      renderAuthors(data.authors || []);
    } else {
      authorsList.innerHTML = '<p class="error-message">Ошибка загрузки авторов</p>';
    }
  } catch (error) {
    console.error('Error loading authors:', error);
    authorsList.innerHTML = '<p class="error-message">Ошибка подключения к серверу</p>';
  }
}

function renderAuthors(authors) {
  const authorsList = document.getElementById('authors-list');
  if (!authorsList) return;

  if (authors.length === 0) {
    authorsList.innerHTML = '<p class="no-authors">Авторы не найдены</p>';
    return;
  }

  authorsList.innerHTML = authors.map((author, index) => {
    const rank = index + 1;
    const isPremium = author.isPremium || false;
    
    return `
      <div class="author-card">
        <div class="author-rank">№${rank}</div>
        <div class="author-avatar">
          ${author.avatar ? `<img src="${author.avatar}" alt="${author.username}">` : '<span>👤</span>'}
        </div>
        <div class="author-info">
          <h3 class="author-name">
            <a href="/author/${author.id}">${author.username}</a>
            ${isPremium ? '<span class="author-crown">👑</span>' : ''}
          </h3>
          <div class="author-stats">
            <span class="author-subscribers">${author.subscribers || 0} подписчиков</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

