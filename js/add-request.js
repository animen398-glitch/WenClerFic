import { getStoredUser } from './session.js';

const API_BASE = window.location.origin + '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuth();
});

function checkAuth() {
  const user = getStoredUser();
  if (!user) {
    window.location.href = '/requests';
    return;
  }
}

function setupEventListeners() {
  // Show/hide fandom field based on type
  document.querySelectorAll('input[name="request-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const fandomGroup = document.getElementById('fandom-group');
      if (radio.value === 'fanfic') {
        fandomGroup.style.display = 'block';
        document.getElementById('request-fandom').required = true;
      } else {
        fandomGroup.style.display = 'none';
        document.getElementById('request-fandom').required = false;
      }
    });
  });

  // Form submission
  const form = document.getElementById('add-request-form');
  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const user = getStoredUser();
  if (!user) {
    if (window.showNotification) {
      window.showNotification('Необходима авторизация', 'error');
    } else {
      alert('Необходима авторизация');
    }
    window.location.href = '/requests';
    return;
  }

  const formData = {
    title: document.getElementById('request-title').value.trim(),
    type: document.querySelector('input[name="request-type"]:checked')?.value,
    fandom: document.getElementById('request-fandom').value.trim(),
    description: document.getElementById('request-description').value.trim(),
    spoilerDescription: document.getElementById('request-spoiler').value.trim(),
    ratings: Array.from(document.querySelectorAll('input[name="ratings"]:checked')).map(cb => cb.value),
    directions: Array.from(document.querySelectorAll('input[name="directions"]:checked')).map(cb => cb.value),
    commentsAllowed: document.querySelector('input[name="comments"]:checked')?.value
  };

  // Validation
  if (!formData.title) {
    const notify = window.showNotification || alert;
    if (typeof notify === 'function') {
      notify('Заголовок обязателен', 'error');
    }
    return;
  }

  if (!formData.type) {
    const notify = window.showNotification || alert;
    if (typeof notify === 'function') {
      notify('Выберите тип заявки', 'error');
    }
    return;
  }

  if (formData.type === 'fanfic' && !formData.fandom) {
    const notify = window.showNotification || alert;
    if (typeof notify === 'function') {
      notify('Фэндом обязателен для фанфиков', 'error');
    }
    return;
  }

  if (formData.ratings.length === 0) {
    const notify = window.showNotification || alert;
    if (typeof notify === 'function') {
      notify('Выберите хотя бы один рейтинг', 'error');
    }
    return;
  }

  if (formData.directions.length === 0) {
    const notify = window.showNotification || alert;
    if (typeof notify === 'function') {
      notify('Выберите хотя бы одну направленность', 'error');
    }
    return;
  }

  if (!formData.commentsAllowed) {
    const notify = window.showNotification || alert;
    if (typeof notify === 'function') {
      notify('Выберите настройки комментариев', 'error');
    }
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    const notify = window.showNotification || alert;
    if (response.ok) {
      if (typeof notify === 'function') {
        notify('Заявка успешно добавлена', 'success');
      }
      setTimeout(() => {
        window.location.href = '/requests';
      }, 1500);
    } else {
      if (typeof notify === 'function') {
        notify(data.error || 'Ошибка при добавлении заявки', 'error');
      }
    }
  } catch (error) {
    console.error('Error adding request:', error);
    const notify = window.showNotification || alert;
    if (typeof notify === 'function') {
      notify('Ошибка подключения к серверу', 'error');
    }
  }
}

