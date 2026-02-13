import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, render_template, request, redirect, url_for, session, flash, g, abort
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import func, or_
from functools import wraps

from config import config
from models import db, User, Post
from forms import LoginForm, RegistrationForm, PostForm, EditProfileForm, SearchForm, EmptyForm
from utils import save_avatar, delete_avatar, get_avatar_url, RecommendationEngine
from flask_wtf.csrf import CSRFProtect, generate_csrf


def create_app(config_name='default'):
    """Application factory"""
    app = Flask(__name__)
    csrf = CSRFProtect(app)

    # Загружаем конфигурацию
    app.config.from_object(config[config_name])
    
    # Инициализируем расширения
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # Rate limiting
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri=app.config['RATELIMIT_STORAGE_URL']
    )
    
    # Создаём папки если их нет
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    
    # Настраиваем логирование
    if not app.debug and not app.testing:
        file_handler = RotatingFileHandler(
            'logs/social_network.log',
            maxBytes=10240000,  # 10MB
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('NITI Social Network startup')
    
    # Декоратор для проверки авторизации
    def login_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if g.current_user is None:
                flash('Пожалуйста, войдите в систему.', 'warning')
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated_function
    
    # Before request - загружаем пользователя
    @app.before_request
    def load_current_user():
        g.current_user = None
        
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
            if user:
                g.current_user = user
            else:
                session.clear()
    
    # Context processor для шаблонов
    @app.context_processor
    def utility_processor():
        return dict(
        avatar_url=get_avatar_url,
        csrf_token=generate_csrf  
    )
    
    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        return render_template('errors/404.html'), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return render_template('errors/500.html'), 500
    
    @app.errorhandler(403)
    def forbidden_error(error):
        return render_template('errors/403.html'), 403
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        flash('Файл слишком большой. Максимальный размер: 4MB', 'error')
        return redirect(request.url)
    
    # ============ РОУТЫ ============
    
    @app.route('/')
    def home():
        if g.current_user:
            return redirect(url_for('feed'))
        return redirect(url_for('login'))
    
    @app.route('/register', methods=['GET', 'POST'])
    # @limiter.limit("3 per hour")
    def register():
        if g.current_user:
            return redirect(url_for('feed'))
        
        form = RegistrationForm()
        
        if form.validate_on_submit():
            username = form.username.data.strip()
            password = form.password.data
            
            is_valid, error = User.validate_username(username)
            if not is_valid:
                flash(error, 'error')
                return render_template('register.html', form=form)
            
            is_valid, error = User.validate_password(password)
            if not is_valid:
                flash(error, 'error')
                return render_template('register.html', form=form)
            
            try:
                new_user = User(username=username)
                new_user.set_password(password)
                db.session.add(new_user)
                db.session.commit()
                
                app.logger.info(f'Новый пользователь зарегистрирован: {username}')
                flash('Регистрация успешна! Войдите в систему.', 'success')
                return redirect(url_for('login'))
                
            except Exception as e:
                db.session.rollback()
                app.logger.error(f'Ошибка при регистрации: {e}')
                flash('Произошла ошибка. Попробуйте другое имя пользователя.', 'error')
        
        return render_template('register.html', form=form)
    
    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if g.current_user:
            return redirect(url_for('feed'))
        
        form = LoginForm()
        
        if form.validate_on_submit():
            username = form.username.data.strip()
            password = form.password.data
            
            user = User.query.filter_by(username=username).first()
            
            if user and user.check_password(password):
                session.clear()
                session.permanent = True
                session['user_id'] = user.id
                session['username'] = user.username
                
                app.logger.info(f'Пользователь вошел: {username}')
                flash('Вход выполнен!', 'success')
                
                next_page = request.args.get('next')
                if next_page and next_page.startswith('/'):
                    return redirect(next_page)
                return redirect(url_for('feed'))
            else:
                app.logger.warning(f'Неудачная попытка входа для: {username}')
                flash('Неверное имя или пароль', 'error')
        
        return render_template('login.html', form=form)
    
    @app.route('/logout')
    def logout():
        if g.current_user:
            app.logger.info(f'Пользователь вышел: {g.current_user.username}')
        session.clear()
        flash('Выход выполнен!', 'success')
        return redirect(url_for('login'))
    
    @app.route('/feed')
    @login_required
    def feed():
        page = request.args.get('page', 1, type=int)
        mode = request.args.get('mode', 'balanced')  # режим рекомендаций
        
        # Получаем базовые посты (подписки + свои)
        followed_ids = [u.id for u in g.current_user.following.all()]
        
        # Запрос с eager loading
        all_posts_query = Post.query.filter(
            Post.user_id.in_(followed_ids + [g.current_user.id])
        ).options(
            db.joinedload(Post.user)
        ).order_by(Post.created_at.desc())
        
        # Получаем все посты для рекомендаций (ограничим последние 100)
        all_posts = all_posts_query.limit(100).all()
        
        # Применяем AI-рекомендации
        if all_posts:
            recommended_posts = RecommendationEngine.get_recommended_posts(
                g.current_user, 
                all_posts, 
                mode=mode
            )
        else:
            recommended_posts = []
        
        # Пагинация уже отсортированных постов
        start_idx = (page - 1) * app.config['POSTS_PER_PAGE']
        end_idx = start_idx + app.config['POSTS_PER_PAGE']
        posts = recommended_posts[start_idx:end_idx]
        
        # Создаем объект пагинации вручную
        total_posts = len(recommended_posts)
        total_pages = (total_posts + app.config['POSTS_PER_PAGE'] - 1) // app.config['POSTS_PER_PAGE']
        
        class SimplePagination:
            def __init__(self, page, per_page, total):
                self.page = page
                self.per_page = per_page
                self.total = total
                self.pages = total_pages
                self.has_prev = page > 1
                self.has_next = page < total_pages
                self.prev_num = page - 1 if self.has_prev else None
                self.next_num = page + 1 if self.has_next else None
                self.items = posts
        
        pagination = SimplePagination(page, app.config['POSTS_PER_PAGE'], total_posts)
        
        # Получаем "пузыри" для режима исследования
        bubbles = RecommendationEngine.get_filter_bubbles(posts) if mode == 'bubbles' else {}
        
        form = PostForm()
        
        return render_template('feed.html',
                             form=form,
                             posts=posts,
                             pagination=pagination,
                             bubbles=bubbles,
                             current_mode=mode)
    
    @app.route('/post', methods=['POST'])
    @login_required
    # @limiter.limit("30 per hour")
    def create_post():
        form = PostForm()
        
        if form.validate_on_submit():
            content = form.content.data.strip()
            
            is_valid, error = Post.validate_content(content)
            if not is_valid:
                flash(error, 'error')
                return redirect(url_for('feed'))
            
            try:
                new_post = Post(content=content, user_id=g.current_user.id)
                db.session.add(new_post)
                g.current_user.posts_count += 1
                db.session.commit()
                flash('Пост создан!', 'success')
                
            except Exception as e:
                db.session.rollback()
                app.logger.error(f'Ошибка при создании поста: {e}')
                flash('Ошибка при создании поста.', 'error')
        else:
            for field, errors in form.errors.items():
                for error in errors:
                    flash(error, 'error')
        
        return redirect(url_for('feed'))
    
    @app.route('/post/<int:post_id>/delete', methods=['POST'])
    @login_required
    def delete_post(post_id):
        post = Post.query.get_or_404(post_id)
        
        if post.user_id != g.current_user.id:
            abort(403)
        
        try:
            db.session.delete(post)
            g.current_user.posts_count -= 1
            db.session.commit()
            flash('Пост удалён.', 'success')
        except Exception as e:
            db.session.rollback()
            app.logger.error(f'Ошибка при удалении поста: {e}')
            flash('Ошибка при удалении поста.', 'error')
        
        return redirect(request.referrer or url_for('feed'))
    
    @app.route('/profile/<username>')
    @login_required
    def profile(username):
        user = User.query.filter_by(username=username).first_or_404()
        page = request.args.get('page', 1, type=int)
        
        pagination = Post.query.filter_by(user_id=user.id)\
                              .order_by(Post.created_at.desc())\
                              .paginate(
                                  page=page,
                                  per_page=app.config['POSTS_PER_PAGE'],
                                  error_out=False
                              )
        follow_form = EmptyForm()
        posts = pagination.items
        is_following = g.current_user.is_following(user)
        
        return render_template('profile.html', 
                             user=user, 
                             posts=posts,
                             pagination=pagination,
                             is_following=is_following, 
                             current_user=g.current_user,
                             follow_form=follow_form)
    
    @app.route('/edit_profile', methods=['GET', 'POST'])
    @login_required
    def edit_profile():
        form = EditProfileForm()
        
        if form.validate_on_submit():
            # Обработка аватара
            if form.avatar.data:
                filename, error = save_avatar(form.avatar.data, g.current_user.username)
                
                if error:
                    flash(error, 'error')
                else:
                    delete_avatar(g.current_user.avatar)
                    g.current_user.avatar = filename
            
            # Обработка интересов
            if form.interests.data:
                interests_raw = form.interests.data
                interests_list = [i.strip() for i in interests_raw.split(',') if i.strip()]
                g.current_user.interests = interests_list[:20]  # Максимум 20 интересов
            else:
                g.current_user.interests = []
            
            try:
                db.session.commit()
                app.logger.info(f'Пользователь {g.current_user.username} обновил профиль')
                flash('Профиль обновлён!', 'success')
                return redirect(url_for('profile', username=g.current_user.username))
            except Exception as e:
                db.session.rollback()
                app.logger.error(f'Ошибка при обновлении профиля: {e}')
                flash('Ошибка при сохранении.', 'error')
        
        # Предзаполняем форму
        if not form.is_submitted():
            if g.current_user.interests:
                form.interests.data = ', '.join(g.current_user.interests)
        
        return render_template('edit_profile.html', form=form, user=g.current_user)
    
    @app.route('/follow/<username>', methods=['POST'])
    @login_required
    def follow(username):
        user = User.query.filter_by(username=username).first_or_404()
        
        if user == g.current_user:
            flash('Нельзя подписаться на себя.', 'error')
            return redirect(url_for('profile', username=username))
        
        try:
            if g.current_user.follow(user):
                db.session.commit()
                flash(f'Вы подписались на {username}!', 'success')
            else:
                flash('Вы уже подписаны на этого пользователя.', 'info')
        except Exception as e:
            db.session.rollback()
            app.logger.error(f'Ошибка при подписке: {e}')
            flash('Ошибка при подписке.', 'error')
        
        return redirect(url_for('profile', username=username))
    
    @app.route('/unfollow/<username>', methods=['POST'])
    @login_required
    def unfollow(username):
        user = User.query.filter_by(username=username).first_or_404()
        
        try:
            if g.current_user.unfollow(user):
                db.session.commit()
                flash(f'Вы отписались от {username}.', 'success')
            else:
                flash('Вы не подписаны на этого пользователя.', 'info')
        except Exception as e:
            db.session.rollback()
            app.logger.error(f'Ошибка при отписке: {e}')
            flash('Ошибка при отписке.', 'error')
        
        return redirect(url_for('profile', username=username))
    
    @app.route('/search')
    @login_required
    # @limiter.limit("60 per hour")
    def search():
        form = SearchForm()
        query = request.args.get('q', '').strip()
        page = request.args.get('page', 1, type=int)
        
        if not query:
            popular_users = User.query.order_by(
                User.followers_count.desc()
            ).limit(6).all()
            
            return render_template('search.html', 
                                 users=[], 
                                 popular_users=popular_users,
                                 query="",
                                 pagination=None)
        
        pagination = User.query.filter(
            User.username.ilike(f'{query}%')
        ).paginate(
            page=page,
            per_page=app.config['USERS_PER_PAGE'],
            error_out=False
        )
        
        return render_template('search.html',
                             form=form,
                             users=pagination.items,
                             popular_users=[],
                             query=query,
                             pagination=pagination)
    
    return app


# Создаём приложение
app = create_app(os.getenv('FLASK_ENV', 'development'))


if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'])
