# Инструкция по развертыванию WenClerFic

## Проблема с GitHub Pages

GitHub Pages работает только со **статическими файлами** (HTML, CSS, JS), но наш проект использует **Node.js сервер** (Express), поэтому GitHub Pages не может его запустить.

## Решения для хостинга

### Вариант 1: Vercel (Рекомендуется - БЕСПЛАТНО)

1. Зайдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub
3. Нажмите "Add New Project"
4. Выберите репозиторий `WenClerFic`
5. Vercel автоматически определит настройки
6. Нажмите "Deploy"
7. После деплоя добавьте переменные окружения в Settings → Environment Variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (будет автоматически установлен)
   - `FACEBOOK_APP_ID` (если используете)
   - `FACEBOOK_APP_SECRET` (если используете)

**Преимущества:**
- ✅ Бесплатно
- ✅ Автоматический деплой при push в GitHub
- ✅ HTTPS по умолчанию
- ✅ Быстрая настройка

### Вариант 2: Render (БЕСПЛАТНО)

1. Зайдите на [render.com](https://render.com)
2. Войдите через GitHub
3. Нажмите "New +" → "Web Service"
4. Подключите репозиторий `WenClerFic`
5. Настройки:
   - **Name:** wenclerfic
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Добавьте переменные окружения в разделе "Environment"
7. Нажмите "Create Web Service"

**Преимущества:**
- ✅ Бесплатный план доступен
- ✅ Автоматический деплой
- ✅ HTTPS включен

### Вариант 3: Railway (БЕСПЛАТНО с ограничениями)

1. Зайдите на [railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project" → "Deploy from GitHub repo"
4. Выберите репозиторий `WenClerFic`
5. Railway автоматически определит Node.js проект
6. Добавьте переменные окружения в разделе "Variables"
7. Деплой начнется автоматически

### Вариант 4: Heroku (Платный, но есть бесплатный пробный период)

1. Установите [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Выполните:
```bash
heroku login
heroku create wenclerfic
git push heroku main
heroku config:set GOOGLE_CLIENT_ID=ваш_ключ
heroku config:set GOOGLE_CLIENT_SECRET=ваш_секрет
```

## Настройка переменных окружения

После деплоя обязательно обновите `GOOGLE_REDIRECT_URI` и `FACEBOOK_REDIRECT_URI` на URL вашего хостинга:

```
GOOGLE_REDIRECT_URI=https://ваш-домен.vercel.app/api/auth/google/callback
```

## Локальный запуск

Для локального тестирования:

```bash
npm install
npm start
```

Сайт будет доступен на `http://localhost:3000`

## Важно!

После деплоя обновите OAuth редиректы в Google/Facebook консоли разработчика на новый URL вашего хостинга.

