# tests/test_app.py
import pytest
from faker import Faker
from flask import url_for
from io import BytesIO
from PIL import Image
from app import create_app, db
from models import User, Post
from utils import validate_image
from werkzeug.security import generate_password_hash, check_password_hash

fake = Faker('ru_RU')


@pytest.fixture(scope='module')
def app():
    app = create_app('testing')
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(scope='function')
def test_user(app):
    with app.app_context():
        username = fake.user_name()[:20]
        plain_password = 'test123456'
        hashed = generate_password_hash(plain_password)
        user = User(
            username=username,
            password_hash=hashed
        )
        db.session.add(user)
        db.session.commit()
        # Возвращаем свежий объект
        return User.query.filter_by(username=username).first()


@pytest.fixture
def logged_in_client(client, app, test_user):
    with app.app_context():
        rv = client.post('/login', data={
            'username': test_user.username,
            'password': 'test123456'  # plain text для теста
        }, follow_redirects=True)
        assert rv.status_code == 200, f"Логин не удался: {rv.data.decode('utf-8')[:300]}"
        yield client


@pytest.fixture
def test_posts(app, test_user):
    with app.app_context():
        posts = []
        for i in range(5):
            post = Post(
                content=fake.text(max_nb_chars=200),
                user_id=test_user.id
            )
            db.session.add(post)
            posts.append(post)
        db.session.commit()
        return [{'id': p.id, 'content': p.content} for p in posts]


def test_register(client, app):
    username = fake.user_name()[:20]
    password = 'test123456'

    rv = client.post('/register', data={
        'username': username,
        'password': password
    }, follow_redirects=True)

    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert any(word in html for word in ['Регистрация успешна', 'Лента', 'Вход'])


def test_register_duplicate_username(client, test_user):
    rv = client.post('/register', data={
        'username': test_user.username,
        'password': 'test123456'
    }, follow_redirects=True)

    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'Это имя уже занято' in html or 'занято' in html.lower()


def test_login_success(client, test_user):
    rv = client.post('/login', data={
        'username': test_user.username,
        'password': 'test123456'
    }, follow_redirects=True)

    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert any(word in html for word in ['Лента', 'Посты', 'Привет'])


def test_login_invalid(client):
    rv = client.post('/login', data={
        'username': 'invaliduser123',
        'password': 'wrongpass'
    }, follow_redirects=True)

    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'Неверное имя или пароль' in html


def test_logout(logged_in_client):
    rv = logged_in_client.get('/logout', follow_redirects=True)
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert any(word in html for word in ['Выход выполнен', 'Вход', 'Регистрация'])


def test_create_post(logged_in_client, app):
    content = fake.text(max_nb_chars=100)

    rv = logged_in_client.post('/post', data={
        'content': content
    }, follow_redirects=True)

    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert any(word in html for word in ['Пост создан', content])

    with app.app_context():
        assert Post.query.filter_by(content=content).first() is not None


def test_feed_unauthorized(client):
    rv = client.get('/feed', follow_redirects=True)
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'Вход' in html


def test_feed_authorized(logged_in_client, app, test_posts):
    with app.app_context():
        first_content = test_posts[0]['content']

    rv = logged_in_client.get('/feed')
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert first_content in html


def test_profile(logged_in_client, test_user):
    rv = logged_in_client.get(url_for('profile', username=test_user.username))
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert test_user.username in html


def test_follow_unfollow(logged_in_client, app, test_user):
    with app.app_context():
        another_username = fake.user_name()[:20]
        another_user = User(
            username=another_username,
            password_hash=generate_password_hash('test123456')
        )
        db.session.add(another_user)
        db.session.commit()
        another_user = User.query.filter_by(username=another_username).first()  # свежий объект

    rv = logged_in_client.post(
        url_for('follow', username=another_user.username),
        follow_redirects=True
    )
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'Вы подписались' in html

    with app.app_context():
        fresh_user = User.query.get(test_user.id)
        fresh_target = User.query.get(another_user.id)
        assert fresh_user.is_following(fresh_target)

    rv = logged_in_client.post(
        url_for('unfollow', username=another_user.username),
        follow_redirects=True
    )
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'Вы отписались' in html

    with app.app_context():
        fresh_user = User.query.get(test_user.id)
        fresh_target = User.query.get(another_user.id)
        assert not fresh_user.is_following(fresh_target)


def test_search(logged_in_client):
    rv = logged_in_client.get('/search?q=test')
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'Поиск пользователей' in html


def test_edit_profile(logged_in_client, app):
    image_data = BytesIO(b'test image data')
    rv = logged_in_client.post('/edit_profile', data={
        'avatar': (image_data, 'test.jpg'),
        'interests': 'тест,интересы'
    }, content_type='multipart/form-data', follow_redirects=True)

    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert any(word in html for word in ['Сохранено', 'Профиль', 'обновлён'])


def test_delete_post(logged_in_client, app, test_posts):
    with app.app_context():
        post_id = test_posts[0]['id']

    rv = logged_in_client.post(url_for('delete_post', post_id=post_id), follow_redirects=True)
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert any(word in html for word in ['удалён', 'удалить', 'удалено'])

    with app.app_context():
        assert Post.query.get(post_id) is None


def test_pagination_feed(logged_in_client, app, test_user):
    with app.app_context():
        for i in range(30):
            post = Post(content=f'Пост {i}', user_id=test_user.id)
            db.session.add(post)
        db.session.commit()

    rv = logged_in_client.get('/feed?page=2')
    assert rv.status_code == 200
    html = rv.data.decode('utf-8')
    assert 'Страница 2' in html


def test_utils_functions(app):
    with app.app_context():
        image_data = BytesIO()
        Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(image_data, format='PNG')
        image_data.seek(0)
        valid, msg = validate_image(image_data)
        assert valid is True, f"Ошибка в PNG: {msg}"

        invalid_data = BytesIO(b'not an image')
        valid, msg = validate_image(invalid_data)
        assert valid is False
