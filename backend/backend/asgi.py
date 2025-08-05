# backend/auth_app/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from workspaces.consumers import DocumentConsumer, CommentConsumer

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AuthMiddlewareStack(
        URLRouter([
            path('ws/documents/<int:document_id>/', DocumentConsumer.as_asgi()),
            path('ws/comments/<int:document_id>/', CommentConsumer.as_asgi()),
        ])
    ),
})