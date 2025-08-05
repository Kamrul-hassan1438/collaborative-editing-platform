# backend/users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=[('admin', 'Admin'), ('member', 'Member'), ('viewer', 'Viewer')],
        default='member'
    )

    class Meta:
        db_table = 'users_user'