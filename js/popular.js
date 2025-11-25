const API_BASE = window.location.origin + '/api';

let currentPeriod = 'today';
let currentPage = 1;
let totalPages = 1;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadPopularFics();
});

function setupEventListeners() {
  // Period filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      currentPage = 1;
      loadPopularFics();
    });
  });
}

async function loadPopularFics() {
  const ficsList = document.getElementById('fics-list');
  if (!ficsList) return;

  ficsList.innerHTML = '<div class="loading-spinner">Загрузка популярных фанфиков...</div>';

  try {
    const params = new URLSearchParams({
      period: currentPeriod,
      page: currentPage,
      sort: 'popular'
    });

    const response = await fetch(`${API_BASE}/fics?${params}`);
    const data = await response.json();

    if (response.ok) {
      totalPages = data.totalPages || 1;
      renderFics(data.fics || []);
      renderPagination();
    } else {
      ficsList.innerHTML = '<p class="error-message">Ошибка загрузки фанфиков</p>';
    }
  } catch (error) {
    console.error('Error loading popular fics:', error);
    ficsList.innerHTML = '<p class="error-message">Ошибка подключения к серверу</p>';
  }
}

function renderFics(fics) {
  const ficsList = document.getElementById('fics-list');
  if (!ficsList) return;

  if (fics.length === 0) {
    ficsList.innerHTML = '<p class="no-fics">Популярные фанфики не найдены</p>';
    return;
  }

  ficsList.innerHTML = fics.map(fic => {
    const tags = (fic.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
    return `
      <div class="fic-item" onclick="window.location.href='/fic/${fic.id}'">
        <div class="fic-item__header">
          <h3 class="fic-item__title"><a href="/fic/${fic.id}">${fic.title || 'Без названия'}</a></h3>
          <div class="fic-item__meta">
            <a href="/author/${fic.author?.id || fic.authorId}" class="fic-item__author">${fic.author?.username || 'Unknown'}</a>
            <span>•</span>
            <span>${fic.genre || 'Жанр не указан'}</span>
            <span>•</span>
            <span>${fic.chapters || 0} глав</span>
          </div>
        </div>
        <div class="fic-item__body">
          <p class="fic-item__description">${fic.description || 'Описание отсутствует'}</p>
          ${tags ? `<div class="fic-item__tags">${tags}</div>` : ''}
        </div>
        <div class="fic-item__stats">
          <span>👁 ${fic.views || 0}</span>
          <span>❤️ ${fic.likes || 0}</span>
          <span>📚 ${fic.chapters || 0}</span>
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
  loadPopularFics();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.changePage = changePage;

