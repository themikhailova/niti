from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, PasswordField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, Length, ValidationError, Regexp, Optional
from models import User


class LoginForm(FlaskForm):
    """Форма входа"""
    username = StringField('Имя пользователя', 
                          validators=[DataRequired(message="Введите имя пользователя")])
    password = PasswordField('Пароль', 
                            validators=[DataRequired(message="Введите пароль")])
    submit = SubmitField('Войти')

class SearchForm(FlaskForm):
    q = StringField('Поиск', validators=[Optional()])
    submit = SubmitField('Найти')

class RegistrationForm(FlaskForm):
    """Форма регистрации"""
    username = StringField('Имя пользователя',
                          validators=[
                              DataRequired(message="Введите имя пользователя"),
                              Length(min=3, max=30, message="Имя должно быть от 3 до 30 символов"),
                              Regexp(r'^[a-zA-Z0-9_]+$', 
                                    message="Только латинские буквы, цифры и подчеркивание")
                          ])
    password = PasswordField('Пароль',
                            validators=[
                                DataRequired(message="Введите пароль"),
                                Length(min=6, max=128, message="Пароль должен быть от 6 до 128 символов")
                            ])
    submit = SubmitField('Создать аккаунт')
    
    def validate_username(self, field):
        """Проверка уникальности username"""
        if User.query.filter_by(username=field.data).first():
            raise ValidationError('Это имя уже занято')


class PostForm(FlaskForm):
    """Форма создания поста"""
    content = TextAreaField('Содержание',
                           validators=[
                               DataRequired(message="Пост не может быть пустым"),
                               Length(max=5000, message="Пост слишком длинный (максимум 5000 символов)")
                           ])
    submit = SubmitField('Опубликовать')


class EditProfileForm(FlaskForm):
    """Форма редактирования профиля"""
    avatar = FileField('Выберите фото',
                      validators=[
                          FileAllowed(['png', 'jpg', 'jpeg', 'gif', 'webp'], 
                                    'Только изображения: png, jpg, jpeg, gif, webp')
                      ])
    interests = StringField('Интересы (через запятую)', 
                          validators=[Optional(), Length(max=500)])
    submit = SubmitField('Сохранить изменения')

class EmptyForm(FlaskForm):
    submit = SubmitField('Подписаться')