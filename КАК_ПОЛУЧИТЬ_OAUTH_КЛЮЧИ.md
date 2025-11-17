# Как получить OAuth ключи для Google и Facebook

## 🔵 Google OAuth

### Шаг 1: Создайте проект в Google Cloud Console

1. Перейдите на https://console.cloud.google.com/
2. Войдите в свой Google аккаунт
3. Нажмите на выпадающий список проектов (вверху слева)
4. Нажмите "New Project" (Новый проект)
5. Введите название проекта: `WenClerFic`
6. Нажмите "Create" (Создать)

### Шаг 2: Включите Google+ API

1. В меню слева выберите "APIs & Services" → "Library"
2. Найдите "Google+ API" или "Google Identity API"
3. Нажмите "Enable" (Включить)

### Шаг 3: Создайте OAuth 2.0 credentials

1. Перейдите в "APIs & Services" → "Credentials"
2. Нажмите "Create Credentials" → "OAuth client ID"
3. Если появится запрос, настройте OAuth consent screen:
   - User Type: External (Внешний)
   - App name: `WenClerFic`
   - User support email: ваш email
   - Developer contact: ваш email
   - Нажмите "Save and Continue"
   - Scopes: оставьте по умолчанию, нажмите "Save and Continue"
   - Test users: добавьте свой email, нажмите "Save and Continue"
   - Нажмите "Back to Dashboard"

4. Создайте OAuth Client ID:
   - Application type: "Web application"
   - Name: `WenClerFic Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://yourdomain.com` (для продакшена)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback`
     - `https://yourdomain.com/api/auth/google/callback` (для продакшена)
   - Нажмите "Create"

5. **Скопируйте Client ID и Client Secret** - они понадобятся!

### Шаг 4: Добавьте ключи в проект

Создайте файл `.env` в папке `WenClerFic` (НЕ загружайте его в GitHub!):

```env
GOOGLE_CLIENT_ID=ваш_client_id_здесь
GOOGLE_CLIENT_SECRET=ваш_client_secret_здесь
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

---

## 🔵 Facebook OAuth

### Шаг 1: Создайте приложение в Facebook Developers

1. Перейдите на https://developers.facebook.com/
2. Войдите в свой Facebook аккаунт
3. Нажмите "My Apps" → "Create App"
4. Выберите тип: "Consumer" или "None"
5. Введите:
   - App Display Name: `WenClerFic`
   - App Contact Email: ваш email
6. Нажмите "Create App"

### Шаг 2: Добавьте Facebook Login

1. В Dashboard приложения найдите "Add a Product"
2. Найдите "Facebook Login" и нажмите "Set Up"
3. Выберите "Web" платформу

### Шаг 3: Настройте Facebook Login

1. В настройках Facebook Login перейдите в "Settings"
2. В "Valid OAuth Redirect URIs" добавьте:
   - `http://localhost:3000/api/auth/facebook/callback`
   - `https://yourdomain.com/api/auth/facebook/callback` (для продакшена)
3. Нажмите "Save Changes"

### Шаг 4: Получите App ID и App Secret

1. В Dashboard приложения перейдите в "Settings" → "Basic"
2. **Скопируйте App ID и App Secret** - они понадобятся!

### Шаг 5: Добавьте ключи в проект

Добавьте в файл `.env`:

```env
FACEBOOK_APP_ID=ваш_app_id_здесь
FACEBOOK_APP_SECRET=ваш_app_secret_здесь
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/auth/facebook/callback
```

---

## 📝 Настройка сервера для работы с .env

### Шаг 1: Установите dotenv

```bash
cd C:\Users\Hiccup\Documents\LunarPortal\WenClerFic
npm install dotenv
```

### Шаг 2: Обновите server.js

Добавьте в самое начало файла `server.js` (после require):

```javascript
require('dotenv').config();
```

### Шаг 3: Обновите OAUTH_CONFIG в server.js

Замените:
```javascript
const OAUTH_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    // ...
  },
  // ...
};
```

На:
```javascript
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
```

### Шаг 4: Убедитесь, что .env в .gitignore

Проверьте файл `.gitignore` - там должна быть строка:
```
.env
```

Это важно, чтобы не загрузить секретные ключи в GitHub!

---

## ✅ Проверка работы

1. Запустите сервер:
```bash
npm start
```

2. Откройте http://localhost:3000
3. Нажмите "Войти" → выберите Google или Facebook
4. Должно открыться окно авторизации

---

## ⚠️ Важные замечания

- **НЕ загружайте файл `.env` в GitHub!** Он содержит секретные ключи
- Для продакшена используйте реальный домен в redirect URIs
- Google OAuth требует верификации приложения для продакшена
- Facebook OAuth требует проверки приложения для публичного использования

---

## 🆘 Проблемы?

**Ошибка "redirect_uri_mismatch":**
- Проверьте, что redirect URI в коде точно совпадает с тем, что указано в настройках OAuth

**Ошибка "invalid_client":**
- Проверьте правильность Client ID и Client Secret
- Убедитесь, что файл `.env` загружается правильно

**Ошибка "access_denied":**
- Пользователь отменил авторизацию
- Проверьте настройки OAuth consent screen

