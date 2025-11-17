# Инструкция по загрузке в GitHub

## Шаги для загрузки проекта в репозиторий

1. **Инициализируйте git репозиторий** (если еще не инициализирован):
```bash
cd WenClerFic
git init
```

2. **Добавьте удаленный репозиторий**:
```bash
git remote add origin https://github.com/animen398-glitch/WenClerFic.git
```

3. **Добавьте все файлы**:
```bash
git add .
```

4. **Создайте первый коммит**:
```bash
git commit -m "Initial commit: WenClerFic platform"
```

5. **Загрузите в GitHub**:
```bash
git branch -M main
git push -u origin main
```

## Если репозиторий уже существует

Если в репозитории уже есть файлы, используйте force push (осторожно!):
```bash
git push -u origin main --force
```

## Настройка OAuth (для продакшена)

После загрузки в GitHub, настройте переменные окружения для OAuth:

1. Создайте файл `.env` (не загружайте его в GitHub!)
2. Добавьте ваши OAuth ключи:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/auth/facebook/callback
```

3. Установите пакет для работы с .env:
```bash
npm install dotenv
```

4. В `server.js` добавьте в начало:
```javascript
require('dotenv').config();
```

