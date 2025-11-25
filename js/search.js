const API_BASE = window.location.origin + '/api';

let currentPage = 1;
let totalPages = 1;
let filters = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

function setupEventListeners() {
  // Collapse/Expand controls
  document.getElementById('collapse-all')?.addEventListener('click', () => {
    document.querySelectorAll('.collapsible').forEach(section => {
      section.classList.add('collapsed');
    });
  });

  document.getElementById('expand-all')?.addEventListener('click', () => {
    document.querySelectorAll('.collapsible').forEach(section => {
      section.classList.remove('collapsed');
    });
  });

  document.getElementById('reset-all')?.addEventListener('click', () => {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[type="text"]').forEach(input => input.value = '');
    document.querySelectorAll('select').forEach(select => select.value = '');
    filters = {};
    performSearch();
  });

  // Filter changes
  document.querySelectorAll('[data-filter]').forEach(input => {
    input.addEventListener('change', () => {
      updateFilters();
      performSearch();
    });
  });

  document.querySelectorAll('.filter-input, .filter-select').forEach(input => {
    let timeout;
    input.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        updateFilters();
        performSearch();
      }, 500);
    });
  });
}

function updateFilters() {
  filters = {};
  
  // Type
  const types = Array.from(document.querySelectorAll('[data-filter="type"]:checked')).map(cb => cb.value);
  if (types.length > 0) filters.type = types;
  
  // Additional
  if (document.querySelector('[data-filter="unread"]:checked')) filters.unread = true;
  if (document.querySelector('[data-filter="read"]:checked')) filters.read = true;
  if (document.querySelector('[data-filter="by-request"]:checked')) filters.byRequest = true;
  if (document.querySelector('[data-filter="hot"]:checked')) filters.hot = true;
  
  // Direction
  const directions = Array.from(document.querySelectorAll('[data-filter="direction"]:checked')).map(cb => cb.value);
  if (directions.length > 0) filters.direction = directions;
  
  // Text inputs
  const fandom = document.getElementById('fandom-search')?.value.trim();
  if (fandom) filters.fandom = fandom;
  
  const pairing = document.getElementById('pairing-search')?.value.trim();
  if (pairing) filters.pairing = pairing;
  
  // Selects
  const status = document.getElementById('status-filter')?.value;
  if (status) filters.status = status;
  
  const popularity = document.getElementById('popularity-filter')?.value;
  if (popularity) filters.popularity = popularity;
}

async function performSearch() {
  const results = document.getElementById('search-results');
  if (!results) return;

  results.innerHTML = '<div class="loading-spinner">Поиск...</div>';

  try {
    const params = new URLSearchParams({
      page: currentPage,
      ...filters
    });

    const response = await fetch(`${API_BASE}/fics/search?${params}`);
    const data = await response.json();

    if (response.ok) {
      totalPages = data.totalPages || 1;
      renderResults(data.fics || []);
      renderPagination();
    } else {
      results.innerHTML = '<p class="error-message">Ошибка поиска</p>';
    }
  } catch (error) {
    console.error('Error performing search:', error);
    results.innerHTML = '<p class="error-message">Ошибка подключения к серверу</p>';
  }
}

function renderResults(fics) {
  const results = document.getElementById('search-results');
  if (!results) return;

  if (fics.length === 0) {
    results.innerHTML = '<p class="no-results">Фанфики не найдены</p>';
    return;
  }

  results.innerHTML = fics.map(fic => {
    const tags = (fic.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
    return `
      <div class="search-result-item" onclick="window.location.href='/fic/${fic.id}'">
        <h3 class="result-title"><a href="/fic/${fic.id}">${fic.title || 'Без названия'}</a></h3>
        <div class="result-meta">
          <a href="/author/${fic.author?.id || fic.authorId}">${fic.author?.username || 'Unknown'}</a>
          <span>•</span>
          <span>${fic.genre || 'Жанр не указан'}</span>
          <span>•</span>
          <span>${fic.chapters || 0} глав</span>
        </div>
        <p class="result-description">${fic.description || 'Описание отсутствует'}</p>
        ${tags ? `<div class="result-tags">${tags}</div>` : ''}
        <div class="result-stats">
          <span>👁 ${fic.views || 0}</span>
          <span>❤️ ${fic.likes || 0}</span>
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
  performSearch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.changePage = changePage;

