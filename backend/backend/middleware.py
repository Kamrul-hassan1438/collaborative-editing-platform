from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware

class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        query_params = dict(qp.split('=') for qp in query_string.split('&') if '=' in qp)
        token = query_params.get('token')

        if token:
            try:
                authenticator = JWTAuthentication()
                validated_token = await database_sync_to_async(authenticator.get_validated_token)(token)
                user = await database_sync_to_async(authenticator.get_user)(validated_token)
                scope['user'] = user
            except Exception:
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)