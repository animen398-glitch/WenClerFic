// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// OAuth configuration
const OAUTH_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`
  },
  facebook: {
    clientId: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || `http://localhost:${PORT}/api/auth/facebook/callback`
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory database (для демо, в продакшене использовать реальную БД)
let users = [];
let fics = [];
let chapters = [];
let comments = [];

// Initialize with sample data
async function initData() {
  // Sample users
  users = [
    { id: 1, username: 'Author1', email: 'author1@test.com', password: 'password123', createdAt: new Date() },
    { id: 2, username: 'Author2', email: 'author2@test.com', password: 'password123', createdAt: new Date() },
    { id: 3, username: 'Author3', email: 'author3@test.com', password: 'password123', createdAt: new Date() }
  ];

  // Sample fics
  fics = [
    {
      id: 1,
      title: 'Приключения в магическом мире',
      authorId: 1,
      description: 'История о молодом волшебнике, который открывает для себя новый мир магии и приключений. Вместе с друзьями он отправляется в опасное путешествие, чтобы спасти королевство от темных сил.',
      genre: 'fantasy',
      rating: 'PG-13',
      tags: ['магия', 'приключения', 'фэнтези', 'дружба'],
      views: 1250,
      likes: 89,
      chapters: 12,
      status: 'ongoing',
      createdAt: new Date('2024-12-01'),
      updatedAt: new Date('2025-01-15')
    },
    {
      id: 2,
      title: 'Романтика в большом городе',
      authorId: 2,
      description: 'Современная история любви, разворачивающаяся на фоне городской суеты. Два незнакомца встречаются случайно и их жизни переплетаются самым неожиданным образом.',
      genre: 'romance',
      rating: 'PG',
      tags: ['романтика', 'современность', 'любовь'],
      views: 890,
      likes: 67,
      chapters: 8,
      status: 'completed',
      createdAt: new Date('2024-11-15'),
      updatedAt: new Date('2025-01-14')
    },
    {
      id: 3,
      title: 'Тайны старого особняка',
      authorId: 3,
      description: 'Детективная история с элементами мистики, происходящая в заброшенном особняке. Группа друзей решает провести ночь в старом доме, но быстро понимает, что они не одни...',
      genre: 'horror',
      rating: 'R',
      tags: ['ужасы', 'мистика', 'детектив', 'триллер'],
      views: 2100,
      likes: 145,
      chapters: 15,
      status: 'ongoing',
      createdAt: new Date('2024-10-20'),
      updatedAt: new Date('2025-01-16')
    },
    {
      id: 4,
      title: 'Космическая одиссея',
      authorId: 1,
      description: 'Эпическая сага о космических путешественниках, исследующих далекие галактики. Они сталкиваются с невероятными цивилизациями и опасностями космоса.',
      genre: 'adventure',
      rating: 'PG-13',
      tags: ['космос', 'научная фантастика', 'приключения'],
      views: 1567,
      likes: 112,
      chapters: 20,
      status: 'ongoing',
      createdAt: new Date('2024-09-10'),
      updatedAt: new Date('2025-01-17')
    },
    {
      id: 5,
      title: 'Смех сквозь слезы',
      authorId: 2,
      description: 'Комедийная история о неудачливом актере, который пытается найти свое место в мире развлечений. Полна забавных ситуаций и неожиданных поворотов.',
      genre: 'comedy',
      rating: 'PG',
      tags: ['комедия', 'юмор', 'современность'],
      views: 743,
      likes: 54,
      chapters: 6,
      status: 'completed',
      createdAt: new Date('2024-12-20'),
      updatedAt: new Date('2025-01-10')
    }
  ];
}

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email уже используется' });
    }

    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }

    const newUser = {
      id: users.length + 1,
      username,
      email,
      password, // В продакшене хешировать пароль!
      createdAt: new Date()
    };

    users.push(newUser);

    const { password: _, ...userWithoutPassword } = newUser;
    const token = `token_${newUser.id}_${Date.now()}`; // Простой токен для демо

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const { password: _, ...userWithoutPassword } = user;
    const token = `token_${user.id}_${Date.now()}`;

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// OAuth Routes
app.get('/api/auth/google', (req, res) => {
  const action = req.query.action || 'login';
  // В продакшене использовать реальный OAuth URL
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${OAUTH_CONFIG.google.clientId}&` +
    `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.google.redirectUri)}&` +
    `response_type=code&` +
    `scope=email profile&` +
    `state=${action}`;
  
  res.json({ authUrl });
});

app.get('/api/auth/facebook', (req, res) => {
  const action = req.query.action || 'login';
  // В продакшене использовать реальный OAuth URL
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${OAUTH_CONFIG.facebook.clientId}&` +
    `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.facebook.redirectUri)}&` +
    `scope=email&` +
    `state=${action}`;
  
  res.json({ authUrl });
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.send('<script>window.opener.postMessage({type: "oauth-error", error: "Ошибка авторизации"}, "*"); window.close();</script>');
    }

    // В продакшене обменять code на токен через Google API
    // Для демо создаем пользователя напрямую
    const email = `google_${Date.now()}@example.com`;
    const username = `GoogleUser_${Date.now()}`;
    
    let user = users.find(u => u.email === email);
    
    if (!user) {
      user = {
        id: users.length + 1,
        username,
        email,
        password: null,
        provider: 'google',
        createdAt: new Date()
      };
      users.push(user);
    }

    const { password: _, ...userWithoutPassword } = user;
    const token = `token_${user.id}_${Date.now()}`;

    res.send(`
      <script>
        window.opener.postMessage({
          type: 'oauth-success',
          user: ${JSON.stringify(userWithoutPassword)},
          token: '${token}'
        }, '*');
        window.close();
      </script>
    `);
  } catch (error) {
    res.send('<script>window.opener.postMessage({type: "oauth-error", error: "Ошибка сервера"}, "*"); window.close();</script>');
  }
});

app.get('/api/auth/facebook/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.send('<script>window.opener.postMessage({type: "oauth-error", error: "Ошибка авторизации"}, "*"); window.close();</script>');
    }

    // В продакшене обменять code на токен через Facebook API
    // Для демо создаем пользователя напрямую
    const email = `facebook_${Date.now()}@example.com`;
    const username = `FacebookUser_${Date.now()}`;
    
    let user = users.find(u => u.email === email);
    
    if (!user) {
      user = {
        id: users.length + 1,
        username,
        email,
        password: null,
        provider: 'facebook',
        createdAt: new Date()
      };
      users.push(user);
    }

    const { password: _, ...userWithoutPassword } = user;
    const token = `token_${user.id}_${Date.now()}`;

    res.send(`
      <script>
        window.opener.postMessage({
          type: 'oauth-success',
          user: ${JSON.stringify(userWithoutPassword)},
          token: '${token}'
        }, '*');
        window.close();
      </script>
    `);
  } catch (error) {
    res.send('<script>window.opener.postMessage({type: "oauth-error", error: "Ошибка сервера"}, "*"); window.close();</script>');
  }
});

// Fics Routes
app.get('/api/fics', async (req, res) => {
  try {
    let filteredFics = [...fics];

    // Apply filters
    if (req.query.genre) {
      filteredFics = filteredFics.filter(f => f.genre === req.query.genre);
    }

    if (req.query.rating) {
      filteredFics = filteredFics.filter(f => f.rating === req.query.rating);
    }

    // Sort
    const sortBy = req.query.sort || 'newest';
    switch (sortBy) {
      case 'newest':
        filteredFics.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        break;
      case 'popular':
        filteredFics.sort((a, b) => b.views - a.views);
        break;
      case 'rating':
        filteredFics.sort((a, b) => b.likes - a.likes);
        break;
      case 'views':
        filteredFics.sort((a, b) => b.views - a.views);
        break;
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const perPage = 12;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const paginatedFics = filteredFics.slice(start, end);

    // Add author info
    const ficsWithAuthors = paginatedFics.map(fic => ({
      ...fic,
      author: users.find(u => u.id === fic.authorId) || { username: 'Unknown', id: fic.authorId }
    }));

    res.json({
      fics: ficsWithAuthors,
      total: filteredFics.length,
      totalPages: Math.ceil(filteredFics.length / perPage),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/fics/:id', async (req, res) => {
  try {
    const fic = fics.find(f => f.id === parseInt(req.params.id));

    if (!fic) {
      return res.status(404).json({ error: 'Фанфик не найден' });
    }

    const author = users.find(u => u.id === fic.authorId);
    fic.views++;

    res.json({
      ...fic,
      author: author || { username: 'Unknown', id: fic.authorId }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/fics', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { title, description, genre, rating, tags } = req.body;

    const newFic = {
      id: fics.length + 1,
      title,
      description,
      genre,
      rating,
      tags: Array.isArray(tags) ? tags : [],
      authorId: 1, // В реальном приложении извлекать из токена
      views: 0,
      likes: 0,
      chapters: 0,
      status: 'ongoing',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    fics.push(newFic);

    res.status(201).json(newFic);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Chapters Routes
app.get('/api/fics/:ficId/chapters', async (req, res) => {
  try {
    const ficChapters = chapters.filter(c => c.ficId === parseInt(req.params.ficId));
    res.json(ficChapters);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/fics/:ficId/chapters/:chapterId', async (req, res) => {
  try {
    const chapter = chapters.find(
      c => c.ficId === parseInt(req.params.ficId) && c.id === parseInt(req.params.chapterId)
    );

    if (!chapter) {
      return res.status(404).json({ error: 'Глава не найдена' });
    }

    res.json(chapter);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Comments Routes
app.get('/api/fics/:ficId/comments', async (req, res) => {
  try {
    const ficComments = comments.filter(c => c.ficId === parseInt(req.params.ficId));
    res.json(ficComments);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/fics/:ficId/comments', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { text } = req.body;

    const newComment = {
      id: comments.length + 1,
      ficId: parseInt(req.params.ficId),
      authorId: 1, // Из токена
      text,
      createdAt: new Date()
    };

    comments.push(newComment);

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Serve static files
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// Serve index.html for root and other routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/fic/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'fic.html'));
});

app.get('/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'create.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'profile.html'));
});

// Fallback for other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize and start server
initData().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

