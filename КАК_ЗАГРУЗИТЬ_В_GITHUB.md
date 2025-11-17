# Как загрузить проект WenClerFic в GitHub

## Шаг 1: Проверьте, что все файлы на месте

Убедитесь, что в папке `WenClerFic` есть все необходимые файлы:
- index.html
- server.js
- package.json
- папка `styles/` с CSS файлами
- папка `js/` с JavaScript файлами
- папка `pages/` с HTML страницами

## Шаг 2: Инициализируйте Git репозиторий

Откройте терминал в папке `WenClerFic` и выполните:

```bash
cd C:\Users\Hiccup\Documents\LunarPortal\WenClerFic
git init
```

## Шаг 3: Добавьте удаленный репозиторий

```bash
git remote add origin https://github.com/animen398-glitch/WenClerFic.git
```

Если репозиторий уже существует и вы хотите перезаписать:
```bash
git remote set-url origin https://github.com/animen398-glitch/WenClerFic.git
```

## Шаг 4: Добавьте все файлы

```bash
git add .
```

## Шаг 5: Создайте первый коммит

```bash
git commit -m "Initial commit: WenClerFic platform with dark purple theme"
```

## Шаг 6: Загрузите в GitHub

```bash
git branch -M main
git push -u origin main
```

Если репозиторий не пустой и нужно перезаписать (ОСТОРОЖНО!):
```bash
git push -u origin main --force
```

## Альтернативный способ через GitHub Desktop

1. Откройте GitHub Desktop
2. File → Add Local Repository
3. Выберите папку `WenClerFic`
4. Нажмите "Publish repository"
5. Выберите репозиторий `animen398-glitch/WenClerFic`

## После загрузки

После успешной загрузки ваш проект будет доступен по адресу:
https://github.com/animen398-glitch/WenClerFic

