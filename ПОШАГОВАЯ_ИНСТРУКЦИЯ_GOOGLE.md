# Пошаговая инструкция: Получение Google OAuth ключей

## ⚡ Быстрый способ (РЕКОМЕНДУЕТСЯ)

**Для OAuth НЕ НУЖНО искать API в библиотеке!** Можно сразу перейти к созданию credentials.

1. В левом меню: **"APIs & Services"** → **"Credentials"**
2. Нажмите **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Если просит настроить consent screen - настройте (см. ниже)
4. Создайте OAuth Client ID

## Альтернативный способ (если требуется API)

Если Google все равно требует включить API:

1. В поисковой строке введите: **"OAuth"** или **"Google+ API"**
2. Найдите и выберите найденный API
3. Нажмите кнопку **"Enable"** (Включить)

## Шаг 2: Создать OAuth 2.0 Credentials

После включения API:

1. В левом меню нажмите **"APIs & Services"** → **"Credentials"** (Учетные данные)
2. Вверху страницы нажмите **"+ CREATE CREDENTIALS"** (Создать учетные данные)
3. Выберите **"OAuth client ID"**

## Шаг 3: Настроить OAuth Consent Screen (если еще не настроен)

Если появится предупреждение о настройке OAuth consent screen:

1. Нажмите **"CONFIGURE CONSENT SCREEN"** (Настроить экран согласия)
2. Выберите **"External"** (Внешний) → **"CREATE"**
3. Заполните форму:
   - **App name**: `WenClerFic`
   - **User support email**: ваш email
   - **Developer contact information**: ваш email
   - Нажмите **"SAVE AND CONTINUE"**
4. На странице **Scopes** (Области видимости):
   - Нажмите **"SAVE AND CONTINUE"** (можно оставить по умолчанию)
5. На странице **Test users** (Тестовые пользователи):
   - Добавьте свой email в список тестовых пользователей
   - Нажмите **"SAVE AND CONTINUE"**
6. Нажмите **"BACK TO DASHBOARD"**

## Шаг 4: Создать OAuth Client ID

1. Вернитесь в **"Credentials"** → **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. Выберите **Application type**: **"Web application"**
3. **Name**: `WenClerFic Web Client`
4. **Authorized JavaScript origins** (Разрешенные источники JavaScript):
   - Добавьте: `http://localhost:3000`
   - Для продакшена добавьте ваш домен
5. **Authorized redirect URIs** (Разрешенные URI перенаправления):
   - Добавьте: `http://localhost:3000/api/auth/google/callback`
   - Для продакшена добавьте: `https://yourdomain.com/api/auth/google/callback`
6. Нажмите **"CREATE"**

## Шаг 5: Скопировать ключи

После создания вы увидите:
- **Your Client ID** (Ваш Client ID) - скопируйте это!
- **Your Client Secret** (Ваш Client Secret) - скопируйте это!

⚠️ **Важно**: Client Secret показывается только один раз! Сохраните его сразу!

## Шаг 6: Добавить ключи в проект

1. Откройте файл `.env` в папке `WenClerFic`
2. Добавьте ключи:

```env
GOOGLE_CLIENT_ID=ваш_client_id_здесь
GOOGLE_CLIENT_SECRET=ваш_client_secret_здесь
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

3. Сохраните файл
4. Перезапустите сервер

## Где найти ключи позже?

Если забыли ключи:
1. Перейдите в **APIs & Services** → **Credentials**
2. Найдите ваш OAuth 2.0 Client ID
3. Нажмите на него
4. Client ID виден всегда, но Client Secret нужно будет создать заново (если забыли)

## Проблемы?

**Ошибка "redirect_uri_mismatch":**
- Проверьте, что redirect URI в `.env` точно совпадает с тем, что указано в Google Console

**Ошибка "access_denied":**
- Убедитесь, что ваш email добавлен в список тестовых пользователей

**Не вижу Client Secret:**
- Если вы его не сохранили, нужно создать новый OAuth Client ID

