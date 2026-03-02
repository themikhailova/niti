# NITI – контентная социальная сеть с персонализацией по интересам и настроению

Учебный MVP проекта студенток гр. 1307 СПбГЭТУ «ЛЭТИ»  
Михайлова Мария Александровна  
Черникова Полина Владимировна  
Санкт-Петербург, 2026

![NITI Preview](image.png)

## О проекте

**NITI** — минималистичная контентная социальная сеть для безопасного обмена вдохновляющим контентом (цитаты, эстетика, мемы, фото, мысли).  
Главные фичи:
- Регистрация / аутентификация
- Профили, поиск пользователей, подписки (follow/unfollow)
- Создание постов и досок (boards) с эмоциональным тоном (mood: Joyful, Calm, Reflective и др.)
- Лента рекомендаций с учётом подписок, интересов и настроения (цветная индикация)
- Загрузка аватаров и изображений постов
- Минималистичный адаптивный дизайн + тёмная/светлая тема
- Базовая безопасность: CSRF, rate limiting, хеширование паролей

Проект разрабатывается как дипломная работа и MVP для 10–50 тестовых пользователей.

## Технологический стек

**Frontend**  
- React 18 + TypeScript  
- Vite (быстрый dev-сервер и сборка)  
- Tailwind CSS v4 (utility-first)  
- Lucide React (иконки)  
- react-responsive-masonry (сетка досок)  
- Axios / fetch + React Hooks + Context

**Backend**  
- Flask (Python 3.12+)  
- SQLAlchemy + Flask-Migrate (ORM и миграции)  
- SQLite (dev) → PostgreSQL (prod)  
- Flask-CORS, Flask-Limiter, Flask-WTF (CSRF), Werkzeug (пароли)  
- Pillow (обработка изображений)  
- scikit-learn + NumPy (рекомендации)

## Структура проекта
niti/
├── backend/               # Flask backend
│   ├── app.py             # точка входа
│   ├── config.py
│   ├── models.py
│   ├── forms.py
│   ├── utils.py           # TfidfVectorizer и др.
│   ├── api/               # blueprints (auth, posts, users)
│   ├── migrations/
│   ├── requirements.txt
│   └── ...
├── frontend/              # React + Vite
│   ├── src/
│   ├── public/
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── ...
├── static/                # uploads/avatars, css/js
├── templates/             # Jinja2 шаблоны (если SSR)
├── .env.example
├── .gitignore
└── README.md

## Локальный запуск (Quick Start)

### Требования

- Python 3.10+  
- Node.js 18+ и npm / pnpm / yarn  
- Git

### Шаг 1: Клонирование репозитория

```bash
git clone https://github.com/themikhailova/niti.git
cd niti
```

### Шаг 2: Backend (Flask)

Создайте и активируйте виртуальное окружениеBashpython -m venv venv
```bash
# Windows:
venv\Scripts\activate
```
```bash
# macOS/Linux:
source venv/bin/activate
```

Установите зависимости

```bash
pip install -r backend/requirements.txt
```

Настройте переменные окружения

```bash
cp .env.example .env
```
Откройте .env и укажите минимум:
```bash
SECRET_KEY=your-very-long-random-secret-key
FLASK_ENV=development
DATABASE_URL=sqlite:///social_network.db   (по умолчанию)
или для PostgreSQL: postgresql://user:pass@localhost:5432/niti
```

Инициализируйте и обновите базу данных

```bash
flask db init    # только первый раз
flask db migrate -m "Initial migration"
flask db upgrade
```

Создайте необходимые директории

```bash
mkdir -p static/uploads/avatars logs
```

### Шаг 3: Frontend (React + Vite)

```bash
cd frontend
npm install          # или pnpm install / yarn
npm run dev          # запускает на http://localhost:5173
```

### Шаг 4: Запуск всего проекта

В одном терминале — backend:

```bash
cd backend
python app.py 
```

→ API доступен на http://127.0.0.1:5000

В другом терминале — frontend:

```bash
cd frontend
npm run dev
```

→ Откройте http://localhost:5173

(Frontend должен проксировать запросы к backend — проверьте vite.config.ts на proxy настройку: /api → http://localhost:5000)