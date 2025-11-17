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

// Initialize with empty data (only real user-uploaded fics will be shown)
async function initData() {
  // Start with empty arrays - only real users and fics will be stored
  users = [];
  fics = [];
  chapters = [];
  comments = [];
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
  
  // Проверка наличия ключей
  if (!OAUTH_CONFIG.facebook.clientId || OAUTH_CONFIG.facebook.clientId === 'YOUR_FACEBOOK_APP_ID') {
    return res.status(400).json({ 
      error: 'Facebook OAuth не настроен',
      message: 'Добавьте FACEBOOK_APP_ID и FACEBOOK_APP_SECRET в файл .env'
    });
  }
  
  // Реальный OAuth URL
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

    // Обменять code на токен через Google API
    if (!OAUTH_CONFIG.google.clientId || !OAUTH_CONFIG.google.clientSecret) {
      return res.send('<script>window.opener.postMessage({type: "oauth-error", error: "OAuth не настроен. Добавьте ключи в .env"}, "*"); window.close();</script>');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: OAUTH_CONFIG.google.clientId,
        client_secret: OAUTH_CONFIG.google.clientSecret,
        redirect_uri: OAUTH_CONFIG.google.redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Token error:', tokenData);
      return res.send(`<script>window.opener.postMessage({type: "oauth-error", error: "${tokenData.error || 'Ошибка получения токена'}"}, "*"); window.close();</script>`);
    }

    // Получить информацию о пользователе
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const googleUser = await userResponse.json();

    if (!googleUser.email) {
      return res.send('<script>window.opener.postMessage({type: "oauth-error", error: "Не удалось получить email пользователя"}, "*"); window.close();</script>');
    }

    // Найти или создать пользователя
    let user = users.find(u => u.email === googleUser.email);
    
    if (!user) {
      user = {
        id: users.length + 1,
        username: googleUser.name || `GoogleUser_${Date.now()}`,
        email: googleUser.email,
        password: null,
        provider: 'google',
        avatar: googleUser.picture || null,
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
    console.error('Google OAuth error:', error);
    res.send(`<script>window.opener.postMessage({type: "oauth-error", error: "Ошибка сервера: ${error.message}"}, "*"); window.close();</script>`);
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

// Helper function to get user from token
function getUserFromToken(token) {
  if (!token) return null;
  // Simple token parsing - in production use JWT
  const match = token.match(/token_(\d+)_/);
  if (match) {
    const userId = parseInt(match[1]);
    return users.find(u => u.id === userId);
  }
  return null;
}

app.post('/api/fics', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const { title, description, genre, rating, tags, status } = req.body;

    if (!title || !description || !genre || !rating) {
      return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
    }

    const newFic = {
      id: fics.length > 0 ? Math.max(...fics.map(f => f.id)) + 1 : 1,
      title,
      description,
      genre,
      rating,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []),
      authorId: user.id,
      views: 0,
      likes: 0,
      chapters: 0,
      status: status || 'ongoing',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    fics.push(newFic);

    res.status(201).json(newFic);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/fics/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.id);
    const fic = fics.find(f => f.id === ficId);

    if (!fic) {
      return res.status(404).json({ error: 'Фанфик не найден' });
    }

    if (fic.authorId !== user.id) {
      return res.status(403).json({ error: 'Вы можете удалять только свои фанфики' });
    }

    // Remove fic and related chapters/comments
    fics = fics.filter(f => f.id !== ficId);
    chapters = chapters.filter(c => c.ficId !== ficId);
    comments = comments.filter(c => c.ficId !== ficId);

    res.json({ message: 'Фанфик успешно удален' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Chapters Routes
app.get('/api/fics/:ficId/chapters', async (req, res) => {
  try {
    const ficChapters = chapters
      .filter(c => c.ficId === parseInt(req.params.ficId))
      .sort((a, b) => a.order - b.order);
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

app.post('/api/fics/:ficId/chapters', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.ficId);
    const fic = fics.find(f => f.id === ficId);

    if (!fic) {
      return res.status(404).json({ error: 'Фанфик не найден' });
    }

    if (fic.authorId !== user.id) {
      return res.status(403).json({ error: 'Вы можете добавлять главы только к своим фанфикам' });
    }

    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Название и содержание главы обязательны' });
    }

    const ficChapters = chapters.filter(c => c.ficId === ficId);
    const maxOrder = ficChapters.length > 0 ? Math.max(...ficChapters.map(c => c.order)) : 0;

    const newChapter = {
      id: chapters.length > 0 ? Math.max(...chapters.map(c => c.id)) + 1 : 1,
      ficId,
      title: title.trim(),
      content: content.trim(),
      order: maxOrder + 1,
      words: content.trim().split(/\s+/).filter(w => w).length,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    chapters.push(newChapter);
    fic.chapters = chapters.filter(c => c.ficId === ficId).length;
    fic.updatedAt = new Date();

    res.status(201).json(newChapter);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/fics/:ficId/chapters/:chapterId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.ficId);
    const chapterId = parseInt(req.params.chapterId);
    const fic = fics.find(f => f.id === ficId);
    const chapter = chapters.find(c => c.id === chapterId && c.ficId === ficId);

    if (!fic || !chapter) {
      return res.status(404).json({ error: 'Фанфик или глава не найдены' });
    }

    if (fic.authorId !== user.id) {
      return res.status(403).json({ error: 'Вы можете редактировать только свои главы' });
    }

    const { title, content } = req.body;

    if (title) chapter.title = title.trim();
    if (content) {
      chapter.content = content.trim();
      chapter.words = content.trim().split(/\s+/).filter(w => w).length;
    }
    chapter.updatedAt = new Date();
    fic.updatedAt = new Date();

    res.json(chapter);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/fics/:ficId/chapters/:chapterId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.ficId);
    const chapterId = parseInt(req.params.chapterId);
    const fic = fics.find(f => f.id === ficId);
    const chapter = chapters.find(c => c.id === chapterId && c.ficId === ficId);

    if (!fic || !chapter) {
      return res.status(404).json({ error: 'Фанфик или глава не найдены' });
    }

    if (fic.authorId !== user.id) {
      return res.status(403).json({ error: 'Вы можете удалять только свои главы' });
    }

    chapters = chapters.filter(c => c.id !== chapterId);
    fic.chapters = Math.max(0, fic.chapters - 1);
    fic.updatedAt = new Date();

    res.json({ message: 'Глава успешно удалена' });
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

    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }

    const newComment = {
      id: comments.length > 0 ? Math.max(...comments.map(c => c.id)) + 1 : 1,
      ficId: parseInt(req.params.ficId),
      authorId: user.id,
      text: text.trim(),
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

// User Routes
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userFics = fics.filter(f => f.authorId === userId);
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      ...userWithoutPassword,
      stats: {
        ficsCount: userFics.length,
        totalViews: userFics.reduce((sum, f) => sum + (f.views || 0), 0),
        totalLikes: userFics.reduce((sum, f) => sum + (f.likes || 0), 0),
        totalChapters: userFics.reduce((sum, f) => sum + (f.chapters || 0), 0)
      },
      fics: userFics.map(fic => ({
        ...fic,
        author: userWithoutPassword
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/:id/fics', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const userFics = fics.filter(f => f.authorId === userId);
    
    const ficsWithAuthors = userFics.map(fic => ({
      ...fic,
      author: users.find(u => u.id === fic.authorId) || { username: 'Unknown', id: fic.authorId }
    }));

    res.json(ficsWithAuthors);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'profile.html'));
});

app.get('/author/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'profile.html'));
});

app.get('/my-fics', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'my-fics.html'));
});

app.get('/fic/:id/addpart', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'add-chapter.html'));
});

app.get('/fic/:id/chapter/:chapterId', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'chapter.html'));
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

