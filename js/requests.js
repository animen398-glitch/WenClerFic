import { getStoredUser } from './session.js';

const API_BASE = window.location.origin + '/api';

let currentTab = 'all';
let currentPage = 1;
let totalPages = 1;
let filters = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadRequests();
});

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      currentPage = 1;
      loadRequests();
    });
  });

  // Filters
  document.querySelectorAll('[data-filter]').forEach(input => {
    input.addEventListener('change', () => {
      updateFilters();
      loadRequests();
    });
  });
}

function updateFilters() {
  filters = {};
  
  // Type filters
  const typeFilters = Array.from(document.querySelectorAll('[data-filter="type"]:checked')).map(cb => cb.value);
  if (typeFilters.length > 0) {
    filters.type = typeFilters;
  }
  
  // With works filter
  if (document.querySelector('[data-filter="with-works"]:checked')) {
    filters.withWorks = true;
  }
}

async function loadRequests() {
  const requestsList = document.getElementById('requests-list');
  if (!requestsList) return;

  requestsList.innerHTML = '<div class="loading-spinner">Загрузка заявок...</div>';

  try {
    const params = new URLSearchParams({
      tab: currentTab,
      page: currentPage,
      ...filters
    });

    const response = await fetch(`${API_BASE}/requests?${params}`);
    const data = await response.json();

    if (response.ok) {
      totalPages = data.totalPages || 1;
      renderRequests(data.requests || []);
      renderPagination();
    } else {
      requestsList.innerHTML = '<p class="error-message">Ошибка загрузки заявок</p>';
    }
  } catch (error) {
    console.error('Error loading requests:', error);
    requestsList.innerHTML = '<p class="error-message">Ошибка подключения к серверу</p>';
  }
}

function renderRequests(requests) {
  const requestsList = document.getElementById('requests-list');
  if (!requestsList) return;

  if (requests.length === 0) {
    requestsList.innerHTML = '<p class="no-requests">Заявки не найдены</p>';
    return;
  }

  requestsList.innerHTML = requests.map(request => {
    const ratings = request.ratings ? JSON.parse(request.ratings) : [];
    const directions = request.directions ? JSON.parse(request.directions) : [];
    
    return `
      <div class="request-card">
        <div class="request-header">
          <h3 class="request-title">${request.title}</h3>
          ${request.isHot ? '<span class="request-badge hot">Горячая заявка</span>' : ''}
        </div>
        <div class="request-metrics">
          <span>❤️ ${request.likes || 0}</span>
          <span>⭐ ${request.favorites || 0}</span>
          <span>💬 ${request.comments || 0}</span>
        </div>
        <div class="request-info">
          <span class="request-type">${request.type === 'original' ? 'Ориджинал' : 'Фанфик'}</span>
          ${request.fandom ? `<span class="request-fandom">${request.fandom}</span>` : ''}
          ${ratings.length > 0 ? `<span class="request-rating">${ratings.join(', ')}</span>` : ''}
          ${directions.length > 0 ? `<span class="request-direction">${directions.join(', ')}</span>` : ''}
        </div>
        ${request.tags ? `<div class="request-tags">${JSON.parse(request.tags).map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
        <p class="request-description">${request.description || ''}</p>
        <div class="request-footer">
          <span class="request-date">${new Date(request.createdAt).toLocaleDateString('ru-RU')}</span>
          <a href="/request/${request.id}" class="request-link">Подробнее →</a>
        </div>
      </div>
    `;
  }).join('');
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  if (!pagination || totalPages <= 1) {
    if (pagination) pagination.innerHTML = '';
    return;
  }

  let html = '';
  
  if (currentPage > 1) {
    html += `<button class="pagination-btn" onclick="changePage(${currentPage - 1})">‹</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  if (currentPage < totalPages) {
    html += `<button class="pagination-btn" onclick="changePage(${currentPage + 1})">›</button>`;
  }

  pagination.innerHTML = html;
}

function changePage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadRequests();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.changePage = changePage;

