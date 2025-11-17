const API_BASE = 'http://localhost:3000/api';

let currentUser = null;
let coverFile = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  setupCharCounter();
  setupCoverUpload();
});

function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    updateUserUI();
  } else {
    // Redirect to login if not authenticated
    alert('Войдите, чтобы создать историю');
    window.location.href = '/';
  }
}

function updateUserUI() {
  const userNameEl = document.getElementById('user-name');
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
  }
}

function setupEventListeners() {
  const form = document.getElementById('create-fic-form');
  const cancelBtn = document.getElementById('cancel-btn');
  const coverUploadBtn = document.getElementById('cover-upload-btn');
  const coverInput = document.getElementById('fic-cover');
  const coverRemove = document.getElementById('cover-remove');
  const addPartBtn = document.getElementById('add-part-btn');

  form.addEventListener('submit', handleSubmit);
  cancelBtn.addEventListener('click', () => {
    if (confirm('Вы уверены? Все несохраненные данные будут потеряны.')) {
      window.location.href = '/';
    }
  });

  coverUploadBtn.addEventListener('click', () => {
    coverInput.click();
  });

  coverInput.addEventListener('change', handleCoverSelect);
  coverRemove.addEventListener('click', handleCoverRemove);
  addPartBtn.addEventListener('click', () => {
    alert('Функция добавления частей будет реализована в следующей версии');
  });
}

function setupCharCounter() {
  const descTextarea = document.getElementById('fic-description');
  const charCount = document.getElementById('desc-char-count');

  descTextarea.addEventListener('input', () => {
    charCount.textContent = descTextarea.value.length;
  });
}

function setupCoverUpload() {
  // Check if cover preview should be shown
  const coverPreview = document.getElementById('cover-preview');
  const coverImage = document.getElementById('cover-image');
  
  // This will be set when cover is selected
}

function handleCoverSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    alert('Разрешены только файлы: .jpg, .png, .webp');
    return;
  }

  if (file.size > maxSize) {
    alert('Размер файла не должен превышать 5 МБ');
    return;
  }

  coverFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const coverPreview = document.getElementById('cover-preview');
    const coverImage = document.getElementById('cover-image');
    coverImage.src = e.target.result;
    coverPreview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function handleCoverRemove() {
  coverFile = null;
  const coverInput = document.getElementById('fic-cover');
  const coverPreview = document.getElementById('cover-preview');
  coverInput.value = '';
  coverPreview.style.display = 'none';
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    alert('Войдите, чтобы создать историю');
    return;
  }

  const formData = new FormData(e.target);
  const tagsInput = document.getElementById('fic-tags').value;
  const tags = tagsInput
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);

  const ficData = {
    title: formData.get('title'),
    description: formData.get('description'),
    genre: formData.get('genre'),
    rating: formData.get('rating'),
    type: formData.get('type'),
    status: formData.get('status') || 'ongoing',
    tags: tags,
    fullHeader: formData.get('fullHeader') === 'on',
    contest: formData.get('contest') === 'on'
  };

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Создание...';

  try {
    const token = localStorage.getItem('token');
    
    // If cover is selected, upload it first
    let coverUrl = null;
    if (coverFile) {
      const coverFormData = new FormData();
      coverFormData.append('cover', coverFile);
      
      const coverResponse = await fetch(`${API_BASE}/upload/cover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: coverFormData
      });

      if (coverResponse.ok) {
        const coverData = await coverResponse.json();
        coverUrl = coverData.url;
      }
    }

    ficData.cover = coverUrl;

    const response = await fetch(`${API_BASE}/fics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(ficData)
    });

    const data = await response.json();

    if (response.ok) {
      alert('История успешно создана!');
      window.location.href = `/fic/${data.id}`;
    } else {
      alert(data.error || 'Ошибка при создании истории');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Создать историю';
    }
  } catch (error) {
    console.error('Error creating fic:', error);
    alert('Ошибка подключения к серверу');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Создать историю';
  }
}
