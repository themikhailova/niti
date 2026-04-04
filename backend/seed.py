"""
seed.py — заполнение БД тестовыми данными для NITI.

Запуск из папки backend/:
    python seed.py

Что создаёт:
  - 10 пользователей (пароль у всех: Password123)
  - 40 постов (текстовые + с картинками, разные mood и теги)
  - 5 досок с постами
  - ~30 реакций (лайки, fire, love...)
  - ~20 комментариев
  - Подписки между пользователями
  - Подписки на доски

Скрипт идемпотентен — пропускает уже существующих пользователей.
"""

import os
import sys
import random
from datetime import datetime, timedelta

# Добавляем папку backend в path (если запускаем из backend/)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import (
    db, User, Post, Board, Tag, Reaction,
    Comment, MoodEnum, VisibilityEnum, ReactionTypeEnum,
    follows, board_followers, post_tags,
)

app = create_app('development')

# ─────────────────────────────────────────────────────────────────────────────
# Данные
# ─────────────────────────────────────────────────────────────────────────────

USERS = [
    {'username': 'alice_art',    'email': 'alice@niti.dev',    'bio': 'Художник и иллюстратор 🎨'},
    {'username': 'bob_photo',    'email': 'bob@niti.dev',      'bio': 'Фотограф. Люблю пейзажи и закаты 📷'},
    {'username': 'carol_writer', 'email': 'carol@niti.dev',    'bio': 'Пишу рассказы и эссе ✍️'},
    {'username': 'dan_music',    'email': 'dan@niti.dev',      'bio': 'Музыкант, гитарист 🎸'},
    {'username': 'eva_design',   'email': 'eva@niti.dev',      'bio': 'UX/UI дизайнер. Минимализм ♾️'},
    {'username': 'frank_dev',    'email': 'frank@niti.dev',    'bio': 'Backend разработчик, люблю Python 🐍'},
    {'username': 'grace_yoga',   'email': 'grace@niti.dev',    'bio': 'Инструктор йоги и медитации 🧘'},
    {'username': 'henry_cook',   'email': 'henry@niti.dev',    'bio': 'Повар-любитель. Делюсь рецептами 🍳'},
    {'username': 'iris_travel',  'email': 'iris@niti.dev',     'bio': 'Путешественница. Была в 42 странах ✈️'},
    {'username': 'jack_sci',     'email': 'jack@niti.dev',     'bio': 'Популяризатор науки 🔭'},
]

PASSWORD = 'Password123'

MOODS = [m.value for m in MoodEnum]

POSTS_DATA = [
    # (content, title, mood, tags, post_type)
    ('Сегодня закончила новую иллюстрацию. Акварель + цифровая доработка. Давно хотела попробовать этот гибридный подход!',
     'Акварель и цифра', 'joyful', ['art', 'illustration', 'watercolor'], 'text'),

    ('Золотой час на Алтае. Вышел в 4 утра, чтобы поймать этот свет. Оно того стоило.',
     'Рассвет на Алтае', 'inspired', ['photography', 'landscape', 'nature'], 'image'),

    ('Написал новый рассказ про одиночество в большом городе. Пока не знаю, публиковать ли — но вот первый абзац: «Город гудел, как пчелиный улей, но внутри этого гула была пустота, которую не заглушить кофе и наушниками.»',
     None, 'melancholic', ['writing', 'fiction', 'city'], 'text'),

    ('Разобрал старую гитару, почистил, поменял струны. Первые аккорды после настройки — это как встреча со старым другом.',
     'Реставрация гитары', 'calm', ['music', 'guitar', 'handmade'], 'text'),

    ('Наконец-то дизайн-система которой не стыдно. 3 месяца итераций и вот — чистые компоненты, нормальные токены, полный dark mode.',
     'Design System 2.0', 'energetic', ['design', 'ux', 'figma'], 'text'),

    ('Рефакторинг 8000 строк легаси-кода. День третий. Нашёл функцию с комментарием "не трогать, работает магически". Не тронул.',
     None, 'reflective', ['coding', 'python', 'refactoring'], 'text'),

    ('Утренняя медитация у озера. 20 минут тишины и ни одной мысли о дедлайнах. Рекомендую.',
     'Тишина у воды', 'calm', ['meditation', 'mindfulness', 'nature'], 'image'),

    ('Приготовил домашний рамен с нуля — бульон варился 6 часов. Результат превзошёл ожидания. Рецепт скоро!',
     'Домашний рамен', 'joyful', ['food', 'cooking', 'ramen'], 'image'),

    ('Бали, рисовые террасы Убуда. Нет фильтров — природа сама позаботилась.',
     'Убуд без фильтров', 'inspired', ['travel', 'bali', 'nature'], 'image'),

    ('Чёрные дыры поглощают всё, включая свет. Но недавно учёные обнаружили, что они также могут "выплёвывать" материю через джеты. Вселенная продолжает удивлять.',
     'Джеты чёрных дыр', 'reflective', ['science', 'space', 'physics'], 'text'),

    ('Новая серия скетчей — городские сценки. Люди на остановке, кофейни, переулки. Карандаш + ink.',
     'Городские скетчи', 'energetic', ['art', 'sketching', 'urban'], 'image'),

    ('Закат в Исландии длится 3 часа. За это время я отснял 400 кадров и выбрал 3. Вот один из них.',
     'Исландский закат', 'melancholic', ['photography', 'iceland', 'landscape'], 'image'),

    ('Дочитала "Мастер и Маргарита" в пятый раз. Каждый раз нахожу что-то новое. Воланд становится всё более симпатичным.',
     None, 'reflective', ['books', 'literature', 'bulgakov'], 'text'),

    ('Сыграл первый концерт за 2 года. Дрожали руки до выхода на сцену, потом — чистый поток. Забыл про всё.',
     'Возвращение на сцену', 'joyful', ['music', 'live', 'concert'], 'text'),

    ('Провела UX-исследование с 12 пользователями. Главный вывод: люди не читают инструкции. Никогда.',
     'UX-инсайты', 'energetic', ['ux', 'research', 'design'], 'text'),

    ('Деплой в пятницу вечером. Конечно сломалось. Конечно починили в 23:00. Конечно пьём чай и смеёмся.',
     None, 'energetic', ['coding', 'devops', 'backend'], 'text'),

    ('Провела 7-дневный ретрит молчания. Самое сложное — первые 2 дня. Потом мозг начинает дышать.',
     'Ретрит молчания', 'calm', ['meditation', 'mindfulness', 'retreat'], 'text'),

    ('Попробовал ферментацию: кимчи, комбуча, мисо. Кухня пахнет... интересно. Жена терпит.',
     'Ферментация дома', 'joyful', ['food', 'fermentation', 'cooking'], 'text'),

    ('Патагония. Торрес-дель-Пайне. 5 дней трекинга. Ноги болят, душа поёт.',
     'Патагония W-trek', 'inspired', ['travel', 'hiking', 'patagonia'], 'image'),

    ('Квантовая запутанность: два фотона, разделённые километрами, мгновенно влияют друг на друга. Нет, это не телепатия. Это ещё интереснее.',
     'Квантовая запутанность', 'inspired', ['science', 'physics', 'quantum'], 'text'),

    ('Акварельный портрет занимает 4 часа. Цифровой — 6. Парадокс: цифра не прощает ошибок, потому что всегда можно отменить, и ты делаешь бесконечные правки.',
     'Аналог vs Цифра', 'reflective', ['art', 'illustration', 'process'], 'text'),

    ('Нашёл идеальную точку для стрит-фото: перекрёсток у старого рынка. Час съёмки — и три кадра, которые нравятся.',
     'Стрит-фото', 'energetic', ['photography', 'street', 'urban'], 'image'),

    ('Закончил повесть. 47 000 слов. 8 месяцев. Первый черновик всегда страшный — но он есть.',
     'Первый черновик', 'joyful', ['writing', 'novel', 'process'], 'text'),

    ('Джаз-сессия до 2 ночи. Незнакомые музыканты, один язык — музыка.',
     'Джем-сейшн', 'joyful', ['music', 'jazz', 'improvisation'], 'text'),

    ('Rebrand личного сайта. Минус 80% контента, плюс 200% читаемости. Меньше — лучше.',
     'Rebrand', 'calm', ['design', 'minimalism', 'portfolio'], 'image'),

    ('GraphQL vs REST: написал API на обоих для одного проекта. Спойлер: зависит от задачи.',
     'GraphQL vs REST', 'reflective', ['coding', 'api', 'backend'], 'text'),

    ('Хатха-йога в 6 утра перед рабочим днём — это не наказание, это инвестиция.',
     'Утренняя практика', 'energetic', ['yoga', 'morning', 'health'], 'text'),

    ('Сделал домашний хлеб на закваске. 3-я попытка наконец удалась. Хрустящая корочка!',
     'Хлеб на закваске', 'joyful', ['food', 'baking', 'bread'], 'image'),

    ('Марокко, Шефшауэн — голубой город. Каждый угол — готовая фотография.',
     'Голубой город', 'calm', ['travel', 'morocco', 'photography'], 'image'),

    ('Тёмная материя составляет 27% вселенной, но мы не знаем что это. Это одна из главных загадок физики.',
     'Тёмная материя', 'reflective', ['science', 'space', 'mystery'], 'text'),

    ('Нарисовала серию постеров для локального музыкального фестиваля. Про-боно, но с душой.',
     'Фестивальные постеры', 'inspired', ['art', 'poster', 'design'], 'image'),

    ('Туман над горами Грузии. Сванетия утром.',
     'Сванетия в тумане', 'melancholic', ['travel', 'georgia', 'mountains'], 'image'),

    ('Написал библиотеку для работы с геоданными. Опенсорс, MIT. Первые звёздочки на GitHub — радость непропорциональна.',
     'OpenSource релиз', 'joyful', ['coding', 'opensource', 'python'], 'text'),

    ('Инь-йога: держишь позу 5 минут. Первые 2 минуты — терпишь. Следующие 3 — медитируешь. Это работает.',
     'Инь-йога', 'calm', ['yoga', 'meditation', 'mindfulness'], 'text'),

    ('Суши-рулеты дома: с лососем, авокадо и огурцом. Выглядит не идеально, вкус — отличный.',
     'Домашние суши', 'joyful', ['food', 'sushi', 'cooking'], 'image'),

    ('Сделала 30-дневный фотопроект: один кадр в день, только телефон. Оказывается, камера не важна.',
     '30 дней фото', 'inspired', ['photography', 'challenge', 'mobile'], 'image'),

    ('Нейронные сети учатся на данных — но что если данные предвзяты? Bias в ML — серьёзная этическая проблема.',
     'Bias в машинном обучении', 'reflective', ['science', 'ai', 'ethics'], 'text'),

    ('Первая выставка работ. 20 иллюстраций, маленькая галерея, 60 гостей. Самое честное, что я делала.',
     'Первая выставка', 'joyful', ['art', 'exhibition', 'illustration'], 'text'),

    ('Дождь в Ванкувере — это не плохая погода, это стиль жизни.',
     'Ванкувер в дождь', 'melancholic', ['travel', 'canada', 'rain'], 'image'),

    ('Рефлексия после года работы в стартапе: скорость важна, но технический долг — это реальный долг.',
     'Год в стартапе', 'reflective', ['coding', 'startup', 'career'], 'text'),
]

BOARDS_DATA = [
    {
        'name': 'Аналоговое искусство',
        'description': 'Акварель, масло, карандаш — всё что создаётся руками без цифровых инструментов',
        'tags': ['art', 'analog', 'watercolor', 'sketch'],
    },
    {
        'name': 'Пейзажная фотография',
        'description': 'Горы, закаты, туманы и рассветы со всего мира',
        'tags': ['photography', 'landscape', 'nature', 'travel'],
    },
    {
        'name': 'Медленная жизнь',
        'description': 'Медитация, йога, осознанность. Замедляемся вместе',
        'tags': ['mindfulness', 'yoga', 'calm', 'meditation'],
    },
    {
        'name': 'Код и архитектура',
        'description': 'Архитектурные решения, паттерны, опенсорс и всё про backend разработку',
        'tags': ['coding', 'backend', 'python', 'architecture'],
    },
    {
        'name': 'Кухня мира',
        'description': 'Рецепты, техники, эксперименты с едой из разных уголков планеты',
        'tags': ['food', 'cooking', 'recipes', 'travel'],
    },
]

COMMENTS_POOL = [
    'Потрясающе! Давно хотел попробовать что-то похожее.',
    'Спасибо за это! Именно то что нужно было увидеть сегодня.',
    'Как долго ты этим занимаешься?',
    'Очень вдохновляет! Сохранил себе.',
    'Расскажи подробнее про процесс?',
    'Это красиво. Особенно нравится детализация.',
    'Полностью согласен с каждым словом.',
    'А я наоборот думаю, что...',
    'Отличная работа! Продолжай!',
    'Где это место? Хочу туда!',
    'Именно такой контент мне и нужен.',
    'Ты меня вдохновил попробовать самому.',
    'Давно слежу за твоими работами — каждый раз удивляешь.',
    'Это требует огромного терпения, я бы не смог.',
    'Первый раз вижу такой подход. Интересно!',
    'Подпишусь чтобы не пропустить следующее.',
    'Сколько времени ушло?',
    'Совет принят! Попробую на этой неделе.',
    'Это моё настроение прямо сейчас.',
    'Чистая магия. Без лишних слов.',
]


# ─────────────────────────────────────────────────────────────────────────────
# Seed
# ─────────────────────────────────────────────────────────────────────────────

def run():
    with app.app_context():
        print('🌱 Начинаем заполнение БД...\n')

        # ── 1. Пользователи ───────────────────────────────────────────────
        users: list[User] = []
        for u_data in USERS:
            existing = User.query.filter_by(username=u_data['username']).first()
            if existing:
                print(f'   ⏩ Пользователь {u_data["username"]} уже существует')
                users.append(existing)
                continue

            user = User(
                username=u_data['username'],
                email=u_data['email'],
                bio=u_data['bio'],
            )
            user.set_password(PASSWORD)
            db.session.add(user)
            users.append(user)
            print(f'   ✅ Создан пользователь: {u_data["username"]}')

        db.session.flush()
        print(f'\n👥 Пользователей: {len(users)}\n')

        # ── 2. Подписки между пользователями ─────────────────────────────
        follow_pairs = [
            (0, 1), (0, 2), (0, 4),   # alice → bob, carol, eva
            (1, 0), (1, 6), (1, 8),   # bob → alice, grace, iris
            (2, 0), (2, 3), (2, 9),   # carol → alice, dan, jack
            (3, 1), (3, 4), (3, 7),   # dan → bob, eva, henry
            (4, 0), (4, 5), (4, 2),   # eva → alice, frank, carol
            (5, 9), (5, 3), (5, 4),   # frank → jack, dan, eva
            (6, 7), (6, 0), (6, 8),   # grace → henry, alice, iris
            (7, 6), (7, 2), (7, 8),   # henry → grace, carol, iris
            (8, 1), (8, 0), (8, 3),   # iris → bob, alice, dan
            (9, 5), (9, 0), (9, 2),   # jack → frank, alice, carol
        ]
        follows_added = 0
        for (fi, ti) in follow_pairs:
            if fi >= len(users) or ti >= len(users):
                continue
            follower = users[fi]
            followed = users[ti]
            if not follower.is_following(followed) and follower.id != followed.id:
                follower.following.append(followed)
                follower.following_count = (follower.following_count or 0) + 1
                followed.followers_count = (followed.followers_count or 0) + 1
                follows_added += 1

        db.session.flush()
        print(f'🔗 Подписок создано: {follows_added}\n')

        # ── 3. Теги ───────────────────────────────────────────────────────
        tag_cache: dict[str, Tag] = {}
        all_tag_names = set()
        for _, _, _, tags, _ in POSTS_DATA:
            all_tag_names.update(tags)
        for bdata in BOARDS_DATA:
            all_tag_names.update(bdata['tags'])

        for name in all_tag_names:
            tag = Tag.query.filter_by(name=name).first()
            if not tag:
                tag = Tag(name=name)
                db.session.add(tag)
            tag_cache[name] = tag
        db.session.flush()

        # ── 4. Посты ──────────────────────────────────────────────────────
        posts: list[Post] = []
        base_time = datetime.utcnow() - timedelta(days=30)

        for i, (content, title, mood_str, tag_names, post_type) in enumerate(POSTS_DATA):
            author = users[i % len(users)]
            created = base_time + timedelta(
                hours=random.randint(0, 720)
            )
            try:
                mood = MoodEnum(mood_str)
            except ValueError:
                mood = None

            post = Post(
                post_type=post_type,
                content=content,
                title=title,
                mood=mood,
                visibility=VisibilityEnum.public,
                user_id=author.id,
                created_at=created,
                updated_at=created,
            )
            post.tags = [tag_cache[t] for t in tag_names if t in tag_cache]
            db.session.add(post)
            posts.append(post)
            author.posts_count = (author.posts_count or 0) + 1

        db.session.flush()
        print(f'📝 Постов создано: {len(posts)}\n')

        # ── 5. Доски ──────────────────────────────────────────────────────
        boards: list[Board] = []
        board_owners = [users[0], users[1], users[6], users[5], users[7]]
        for i, bdata in enumerate(BOARDS_DATA):
            existing = Board.query.filter_by(name=bdata['name']).first()
            if existing:
                print(f'   ⏩ Доска "{bdata["name"]}" уже существует')
                boards.append(existing)
                continue

            owner = board_owners[i % len(board_owners)]
            board = Board(
                name=bdata['name'],
                description=bdata['description'],
                tags=bdata['tags'],
                is_public=True,
                creator_id=owner.id,
            )
            db.session.add(board)
            boards.append(board)
            print(f'   ✅ Создана доска: {bdata["name"]}')

        db.session.flush()

        # Добавляем посты в доски по тегам
        for board in boards:
            btags = set(board.tags or [])
            matched = [
                p for p in posts
                if btags & {t.name for t in p.tags} and p.board_id is None
            ][:6]
            for post in matched:
                post.board_id = board.id
                board.post_count = (board.post_count or 0) + 1

        # Подписки на доски
        for user in users[1:]:
            for board in random.sample(boards, k=min(2, len(boards))):
                if not user.is_following_board(board):
                    user.followed_boards.append(board)
                    board.followers_count = (board.followers_count or 0) + 1

        db.session.flush()
        print(f'\n📋 Досок: {len(boards)}\n')

        # ── 6. Реакции ────────────────────────────────────────────────────
        reaction_types = [t.value for t in ReactionTypeEnum]
        reactions_added = 0
        for post in posts:
            # Каждый пост получает от 1 до 6 реакций от случайных пользователей
            n_reactors = random.randint(1, min(6, len(users)))
            reactors = random.sample(users, k=n_reactors)
            for user in reactors:
                if user.id == post.user_id:
                    continue
                r_type = random.choice(reaction_types)
                # Проверяем дубликат
                exists = Reaction.query.filter_by(
                    post_id=post.id, user_id=user.id, reaction_type=r_type
                ).first()
                if not exists:
                    reaction = Reaction(
                        post_id=post.id,
                        user_id=user.id,
                        reaction_type=ReactionTypeEnum(r_type),
                    )
                    db.session.add(reaction)
                    reactions_added += 1

        db.session.flush()
        print(f'❤️  Реакций создано: {reactions_added}\n')

        # ── 7. Комментарии ────────────────────────────────────────────────
        comments_added = 0
        for post in random.sample(posts, k=min(25, len(posts))):
            n_comments = random.randint(1, 3)
            commenters = random.sample(users, k=min(n_comments, len(users)))
            for user in commenters:
                comment = Comment(
                    content=random.choice(COMMENTS_POOL),
                    post_id=post.id,
                    user_id=user.id,
                )
                db.session.add(comment)
                comments_added += 1

        db.session.flush()
        print(f'💬 Комментариев создано: {comments_added}\n')

        # ── Финальный commit ──────────────────────────────────────────────
        db.session.commit()

        print('═' * 50)
        print('✅ База данных заполнена успешно!\n')
        print('Учётные данные тестовых пользователей:')
        print('  Пароль у всех: Password123')
        print()
        for u in users:
            print(f'  {u.username:<20} {u.email}')
        print()
        print('Пример входа:')
        print('  identifier: alice_art')
        print('  password:   Password123')
        print('═' * 50)


if __name__ == '__main__':
    run()
