// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE_NAME = 'wenclerfic_session';
const SESSION_DEFAULT_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSION_REMEMBER_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : null;
const PASSWORD_PLACEHOLDER_PREFIX = '__OAUTH_PENDING__';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
const PENDING_PROFILE_TTL_MINUTES = parseInt(process.env.PENDING_PROFILE_TTL_MINUTES || '15', 10);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || !allowedOrigins) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

function getCookieOptions(maxAge = SESSION_DEFAULT_TTL) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge
  };
}

async function createSessionForUser(res, userId, rememberMe = false) {
  const ttl = rememberMe ? SESSION_REMEMBER_TTL : SESSION_DEFAULT_TTL;
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  await db.createSession({ userId, token, expiresAt });
  res.cookie(SESSION_COOKIE_NAME, token, getCookieOptions(ttl));
  return token;
}

async function destroySession(res, token) {
  if (token) {
    try {
      await db.deleteSessionByToken(token);
    } catch (error) {
      console.error('Ошибка удаления сессии:', error);
    }
  }

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax'
  });
}

function serializeUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

function isPasswordHashed(value) {
  return typeof value === 'string' && value.startsWith('$2');
}

function isPendingPassword(value) {
  return typeof value === 'string' && value.startsWith(PASSWORD_PLACEHOLDER_PREFIX);
}

function generatePlaceholderPassword() {
  return `${PASSWORD_PLACEHOLDER_PREFIX}${crypto.randomBytes(12).toString('hex')}`;
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

async function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword || isPendingPassword(storedPassword)) {
    return false;
  }

  if (isPasswordHashed(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }

  return plainPassword === storedPassword;
}

async function ensureHashedPassword(userId, plainPassword, storedPassword) {
  if (!storedPassword || isPasswordHashed(storedPassword)) {
    return;
  }

  const hashed = await hashPassword(plainPassword);
  await db.updateUser(userId, { password: hashed });
}

async function generateUniqueUsername(seed) {
  const base = (seed || 'reader')
    .toLowerCase()
    .replace(/[^a-z0-9_]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || `reader_${Date.now()}`;

  let username = base;
  let counter = 1;
  while (true) {
    const existing = await db.getUserByUsername(username);
    if (!existing) return username;
    username = `${base}_${counter++}`;
  }
}

async function createPendingProfile(userId, provider, meta = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PENDING_PROFILE_TTL_MINUTES * 60 * 1000).toISOString();
  await db.deletePendingProfilesByUser(userId);
  await db.createPendingProfile({
    userId,
    token,
    provider,
    meta: JSON.stringify(meta),
    expiresAt
  });
  return { token, expiresAt };
}

function buildUsernameSeedFromProfile(profile = {}) {
  if (profile.name) return profile.name;
  if (profile.given_name || profile.family_name) {
    return `${profile.given_name || ''}_${profile.family_name || ''}`;
  }
  if (profile.email) {
    return profile.email.split('@')[0];
  }
  return 'reader';
}

function extractToken(req) {
  return req.headers.authorization?.replace('Bearer ', '') || req.cookies?.[SESSION_COOKIE_NAME];
}

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
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize database
async function initData() {
  try {
    await db.initDatabase();
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't throw - allow app to start even if DB init fails
    // It will retry on first request
  }
}

// Initialize database (non-blocking for Vercel)
// On Vercel, we initialize on first request, not on module load
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  initData().then(() => {
    console.log('Database initialized');
  }).catch(err => {
    console.error('Database initialization error:', err);
  });
}

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, rememberMe } = req.body;
    const rememberSession = rememberMe !== undefined ? Boolean(rememberMe) : true;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверяем существование пользователя
    const existingUserByEmail = await db.getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email уже используется' });
    }

    const existingUserByUsername = await db.getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await db.createUser({
      username,
      email,
      password: hashedPassword,
      isProfileComplete: 1
    });

    const savedUser = await db.getUserById(newUser.id);
    const userWithoutPassword = serializeUser(savedUser);
    const token = await createSessionForUser(res, savedUser.id, rememberSession);

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const rememberSession = rememberMe !== undefined ? Boolean(rememberMe) : false;

    const user = await db.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (isPendingPassword(user.password) || user.isProfileComplete === 0) {
      return res.status(403).json({ error: 'Завершите регистрацию через OAuth, прежде чем входить' });
    }

    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    await ensureHashedPassword(user.id, password, user.password);
    const userWithoutPassword = serializeUser(user);
    const token = await createSessionForUser(res, user.id, rememberSession);

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Сессия не найдена' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      await destroySession(res, token);
      return res.status(401).json({ error: 'Сессия недействительна' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = extractToken(req);
    await destroySession(res, token);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
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
  // Устанавливаем заголовки для работы с popup окном
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type: "oauth-error", error: "Ошибка авторизации"}, "*");
    } else {
      localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Ошибка авторизации"}));
    }
  } catch(e) {
    localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Ошибка авторизации"}));
  }
  window.close();
</script></body></html>`);
    }

    // Обменять code на токен через Google API
    if (!OAUTH_CONFIG.google.clientId || !OAUTH_CONFIG.google.clientSecret) {
      return res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type: "oauth-error", error: "OAuth не настроен. Добавьте ключи в .env"}, "*");
    } else {
      localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "OAuth не настроен. Добавьте ключи в .env"}));
    }
  } catch(e) {
    localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "OAuth не настроен. Добавьте ключи в .env"}));
  }
  window.close();
</script></body></html>`);
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
      const errorMsg = (tokenData.error || 'Ошибка получения токена').replace(/"/g, '&quot;');
      return res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type: "oauth-error", error: "${errorMsg}"}, "*");
    } else {
      localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "${errorMsg}"}));
    }
  } catch(e) {
    localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "${errorMsg}"}));
  }
  window.close();
</script></body></html>`);
    }

    // Получить информацию о пользователе
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const googleUser = await userResponse.json();

    if (!googleUser.email) {
      return res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type: "oauth-error", error: "Не удалось получить email пользователя"}, "*");
    } else {
      localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Не удалось получить email пользователя"}));
    }
  } catch(e) {
    localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Не удалось получить email пользователя"}));
  }
  window.close();
</script></body></html>`);
    }

    // Найти или создать пользователя
    let user = await db.getUserByEmail(googleUser.email);
    
    if (!user) {
      const username = await generateUniqueUsername(buildUsernameSeedFromProfile(googleUser));
      const placeholderPassword = generatePlaceholderPassword();
      const created = await db.createUser({
        username,
        email: googleUser.email,
        password: placeholderPassword,
        provider: 'google',
        avatar: googleUser.picture || null,
        isProfileComplete: 0
      });
      user = await db.getUserById(created.id);
    }

    if (user.isProfileComplete === 0 || isPendingPassword(user.password)) {
      const pending = await createPendingProfile(user.id, 'google', {
        email: googleUser.email,
        avatar: googleUser.picture || null,
        suggestedUsername: user.username
      });

      return res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  const message = {
    type: 'oauth-profile-required',
    provider: 'google',
    token: ${JSON.stringify(pending.token)},
    email: ${JSON.stringify(googleUser.email)},
    username: ${JSON.stringify(user.username)},
    avatar: ${JSON.stringify(googleUser.picture || '')}
  };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, '*');
    } else {
      localStorage.setItem('oauth_message', JSON.stringify(message));
    }
  } catch(e) {
    localStorage.setItem('oauth_message', JSON.stringify(message));
  }
  window.close();
</script></body></html>`);
    }

    const userWithoutPassword = serializeUser(user);
    const token = await createSessionForUser(res, user.id, true);

    res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  const message = {
    type: 'oauth-success',
    user: ${JSON.stringify(userWithoutPassword)},
    token: ${JSON.stringify(token)}
  };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, '*');
    } else {
      localStorage.setItem('oauth_message', JSON.stringify(message));
    }
  } catch(e) {
    localStorage.setItem('oauth_message', JSON.stringify(message));
  }
  window.close();
</script></body></html>`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    const errorMsg = error.message.replace(/"/g, '&quot;').replace(/\n/g, ' ');
    res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type: "oauth-error", error: "Ошибка сервера: ${errorMsg}"}, "*");
    } else {
      localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Ошибка сервера: ${errorMsg}"}));
    }
  } catch(e) {
    localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Ошибка сервера: ${errorMsg}"}));
  }
  window.close();
</script></body></html>`);
  }
});

app.post('/api/auth/complete-profile', async (req, res) => {
  try {
    const { token, username, password } = req.body;

    if (!token || !username || !password) {
      return res.status(400).json({ error: 'Заполните имя пользователя и пароль' });
    }

    const pending = await db.getPendingProfileByToken(token);
    if (!pending) {
      return res.status(404).json({ error: 'Запрос не найден или уже обработан' });
    }

    const expiresAt = new Date(pending.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      await db.deletePendingProfileByToken(token);
      return res.status(410).json({ error: 'Время на завершение регистрации истекло. Попробуйте войти через Google снова.' });
    }

    const user = await db.getUserById(pending.userId);
    if (!user) {
      await db.deletePendingProfileByToken(token);
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.isProfileComplete && !isPendingPassword(user.password)) {
      await db.deletePendingProfileByToken(token);
      const existingUser = serializeUser(user);
      const sessionToken = await createSessionForUser(res, user.id, true);
      return res.json({ user: existingUser, token: sessionToken });
    }

    const existingUsername = await db.getUserByUsername(username);
    if (existingUsername && existingUsername.id !== user.id) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }

    const hashedPassword = await hashPassword(password);
    await db.updateUser(user.id, {
      username,
      password: hashedPassword,
      isProfileComplete: 1
    });

    await db.deletePendingProfileByToken(token);
    const updatedUser = await db.getUserById(user.id);
    const userWithoutPassword = serializeUser(updatedUser);
    const sessionToken = await createSessionForUser(res, updatedUser.id, true);

    res.json({
      user: userWithoutPassword,
      token: sessionToken
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Не удалось завершить регистрацию' });
  }
});

app.get('/api/auth/facebook/callback', async (req, res) => {
  // Устанавливаем заголовки для работы с popup окном
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type: "oauth-error", error: "Ошибка авторизации"}, "*");
    } else {
      localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Ошибка авторизации"}));
    }
  } catch(e) {
    localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "Ошибка авторизации"}));
  }
  window.close();
</script></body></html>`);
    }

    // В продакшене обменять code на токен через Facebook API
    // Для демо создаем пользователя напрямую
    const email = `facebook_${Date.now()}@example.com`;
    const username = `FacebookUser_${Date.now()}`;
    
    let user = await db.getUserByEmail(email);
    
    if (!user) {
      const randomPassword = await hashPassword(crypto.randomBytes(16).toString('hex'));
      user = await db.createUser({
        username,
        email,
        password: randomPassword,
        provider: 'facebook',
        isProfileComplete: 1
      });
      user = await db.getUserById(user.id);
    }

    const userWithoutPassword = serializeUser(user);
    const token = await createSessionForUser(res, user.id, true);

    res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  const message = {
    type: 'oauth-success',
    user: ${JSON.stringify(userWithoutPassword)},
    token: ${JSON.stringify(token)}
  };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, '*');
    } else {
      localStorage.setItem('oauth_message', JSON.stringify(message));
    }
  } catch(e) {
    localStorage.setItem('oauth_message', JSON.stringify(message));
  }
  window.close();
</script></body></html>`);
  } catch (error) {
    const errorMsg = error.message ? error.message.replace(/"/g, '&quot;').replace(/\n/g, ' ') : 'Ошибка сервера';
    res.send(`<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body><script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({type: "oauth-error", error: "${errorMsg}"}, "*");
    } else {
      localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "${errorMsg}"}));
    }
  } catch(e) {
    localStorage.setItem('oauth_error', JSON.stringify({type: "oauth-error", error: "${errorMsg}"}));
  }
  window.close();
</script></body></html>`);
  }
});

// Fics Routes
app.get('/api/fics', async (req, res) => {
  try {
    const filters = {
      genre: req.query.genre,
      rating: req.query.rating,
      sort: req.query.sort || 'newest'
    };

    let allFics = await db.getAllFics(filters);

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const perPage = 12;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const paginatedFics = allFics.slice(start, end);

    // Add author info
    const ficsWithAuthors = await Promise.all(paginatedFics.map(async (fic) => {
      const author = await db.getUserById(fic.authorId);
      return {
        ...fic,
        author: author ? { username: author.username, id: author.id } : { username: 'Unknown', id: fic.authorId }
      };
    }));

    res.json({
      fics: ficsWithAuthors,
      total: allFics.length,
      totalPages: Math.ceil(allFics.length / perPage),
      currentPage: page
    });
  } catch (error) {
    console.error('Error loading fics:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/fics/:id', async (req, res) => {
  try {
    const fic = await db.getFicById(parseInt(req.params.id));

    if (!fic) {
      return res.status(404).json({ error: 'Фанфик не найден' });
    }

    const author = await db.getUserById(fic.authorId);
    await db.incrementFicViews(fic.id);

    res.json({
      ...fic,
      views: (fic.views || 0) + 1,
      author: author ? { username: author.username, id: author.id } : { username: 'Unknown', id: fic.authorId }
    });
  } catch (error) {
    console.error('Error loading fic:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Helper function to get user from token
async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const session = await db.getSessionByToken(token);
    if (session) {
      const expiresAt = new Date(session.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        await db.deleteSessionByToken(token);
        return null;
      }
      return await db.getUserById(session.userId);
    }
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
  }

  // Legacy tokens (оставляем для обратной совместимости)
  const match = token.match(/token_(\d+)_/);
  if (match) {
    const userId = parseInt(match[1]);
    return await db.getUserById(userId);
  }
  return null;
}

app.post('/api/fics', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const { title, description, genre, rating, tags, status } = req.body;

    if (!title || !description || !genre || !rating) {
      return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
    }

    const tagsArray = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []);

    const newFic = await db.createFic({
      title,
      description,
      genre,
      rating,
      tags: tagsArray,
      authorId: user.id,
      status: status || 'ongoing'
    });

    res.status(201).json(newFic);
  } catch (error) {
    console.error('Error creating fic:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/fics/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.id);
    const fic = await db.getFicById(ficId);

    if (!fic) {
      return res.status(404).json({ error: 'Фанфик не найден' });
    }

    if (fic.authorId !== user.id) {
      return res.status(403).json({ error: 'Вы можете удалять только свои фанфики' });
    }

    // Удаление фанфика (каскадное удаление глав и комментариев настроено в БД)
    await db.deleteFic(ficId);

    res.json({ message: 'Фанфик успешно удален' });
  } catch (error) {
    console.error('Error deleting fic:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Endpoint для удаления всех тестовых фанфиков
app.delete('/api/fics/cleanup/test', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    // Получаем всех пользователей с тестовыми email
    const allFics = await db.getAllFics({});
    const testUserIds = [];
    
    for (const fic of allFics) {
      const author = await db.getUserById(fic.authorId);
      if (author && (author.email.includes('@test.com') || author.email.includes('test@') || author.username.toLowerCase().includes('test'))) {
        if (!testUserIds.includes(fic.authorId)) {
          testUserIds.push(fic.authorId);
        }
      }
    }

    // Удаляем все фанфики тестовых пользователей
    let deletedCount = 0;
    for (const fic of allFics) {
      if (testUserIds.includes(fic.authorId)) {
        await db.deleteFic(fic.id);
        deletedCount++;
      }
    }

    res.json({ 
      message: `Удалено ${deletedCount} тестовых фанфиков`,
      deletedCount 
    });
  } catch (error) {
    console.error('Error cleaning up test fics:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Chapters Routes
app.get('/api/fics/:ficId/chapters', async (req, res) => {
  try {
    const ficChapters = await db.getChaptersByFicId(parseInt(req.params.ficId));
    res.json(ficChapters);
  } catch (error) {
    console.error('Error loading chapters:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/fics/:ficId/chapters/:chapterId', async (req, res) => {
  try {
    const chapter = await db.getChapterById(
      parseInt(req.params.ficId),
      parseInt(req.params.chapterId)
    );

    if (!chapter) {
      return res.status(404).json({ error: 'Глава не найдена' });
    }

    res.json(chapter);
  } catch (error) {
    console.error('Error loading chapter:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/fics/:ficId/chapters', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.ficId);
    const fic = await db.getFicById(ficId);

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

    const ficChapters = await db.getChaptersByFicId(ficId);
    const maxOrder = ficChapters.length > 0 ? Math.max(...ficChapters.map(c => c.order)) : 0;

    const newChapter = await db.createChapter({
      ficId,
      title: title.trim(),
      content: content.trim(),
      order: maxOrder + 1
    });

    res.status(201).json(newChapter);
  } catch (error) {
    console.error('Error creating chapter:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/fics/:ficId/chapters/:chapterId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.ficId);
    const chapterId = parseInt(req.params.chapterId);
    const fic = await db.getFicById(ficId);
    const chapter = await db.getChapterById(ficId, chapterId);

    if (!fic || !chapter) {
      return res.status(404).json({ error: 'Фанфик или глава не найдены' });
    }

    if (fic.authorId !== user.id) {
      return res.status(403).json({ error: 'Вы можете редактировать только свои главы' });
    }

    const updates = {};
    if (req.body.title) updates.title = req.body.title.trim();
    if (req.body.content) updates.content = req.body.content.trim();

    const updatedChapter = await db.updateChapter(ficId, chapterId, updates);

    res.json(updatedChapter);
  } catch (error) {
    console.error('Error updating chapter:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/fics/:ficId/chapters/:chapterId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const ficId = parseInt(req.params.ficId);
    const chapterId = parseInt(req.params.chapterId);
    const fic = await db.getFicById(ficId);
    const chapter = await db.getChapterById(ficId, chapterId);

    if (!fic || !chapter) {
      return res.status(404).json({ error: 'Фанфик или глава не найдены' });
    }

    if (fic.authorId !== user.id) {
      return res.status(403).json({ error: 'Вы можете удалять только свои главы' });
    }

    await db.deleteChapter(ficId, chapterId);

    res.json({ message: 'Глава успешно удалена' });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Comments Routes
app.get('/api/fics/:ficId/comments', async (req, res) => {
  try {
    const ficComments = await db.getCommentsByFicId(parseInt(req.params.ficId));
    res.json(ficComments);
  } catch (error) {
    console.error('Error loading comments:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/fics/:ficId/comments', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }

    const newComment = await db.createComment({
      ficId: parseInt(req.params.ficId),
      authorId: user.id,
      text: text.trim()
    });

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Serve static files
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Specific page routes (must be before catch-all)
app.get('/fic/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'fic.html'));
});

app.get('/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'create.html'));
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

app.get('/fic/:id/chapter/:chapterId/edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'add-chapter.html'));
});

// Additional routes for navigation (SPA fallback)
app.get('/fics', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Каталог
});

app.get('/authors', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Авторы
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Настройки
});

app.get('/bookmarks', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Закладки
});

// User Routes
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userFics = await db.getUserFics(userId);
    const { password: _, ...userWithoutPassword } = user;

    const stats = {
      ficsCount: userFics.length,
      totalViews: userFics.reduce((sum, f) => sum + (f.views || 0), 0),
      totalLikes: userFics.reduce((sum, f) => sum + (f.likes || 0), 0),
      totalChapters: userFics.reduce((sum, f) => sum + (f.chapters || 0), 0)
    };

    res.json({
      ...userWithoutPassword,
      stats,
      fics: userFics.map(fic => ({
        ...fic,
        author: userWithoutPassword
      }))
    });
  } catch (error) {
    console.error('Error loading user:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.patch('/api/users/me', async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const currentUser = await getUserFromToken(token);
    if (!currentUser) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const { username } = req.body;
    const newUsername = username?.trim();

    if (!newUsername || newUsername.length < 3) {
      return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 3 символа' });
    }

    const existingUser = await db.getUserByUsername(newUsername);
    if (existingUser && existingUser.id !== currentUser.id) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }

    const updatedUser = await db.updateUser(currentUser.id, { username: newUsername });
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/:id/fics', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const userFics = await db.getUserFics(userId);
    const user = await db.getUserById(userId);
    
    const ficsWithAuthors = userFics.map(fic => ({
      ...fic,
      author: user ? { username: user.username, id: user.id } : { username: 'Unknown', id: userId }
    }));

    res.json(ficsWithAuthors);
  } catch (error) {
    console.error('Error loading user fics:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Fallback for other routes - возвращаем index.html для SPA роутинга
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server (only for local development, not on Vercel)
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  initData().then(() => {
    console.log('Database initialized');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Database initialization error:', err);
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} (DB init failed)`);
    });
  });
} else {
  // On Vercel, initialize DB on first request (lazy initialization)
  let dbInitialized = false;
  app.use(async (req, res, next) => {
    if (!dbInitialized) {
      try {
        await db.initDatabase();
        dbInitialized = true;
        console.log('Database initialized on first request');
      } catch (error) {
        console.error('Database initialization error:', error);
        // Continue anyway - some routes might not need DB
      }
    }
    next();
  });
}

// Export app for Vercel serverless
module.exports = app;

