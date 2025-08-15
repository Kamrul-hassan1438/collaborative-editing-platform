import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.exceptions import ObjectDoesNotExist
from asgiref.sync import sync_to_async
from workspaces.models import Document, WorkspaceMember
import difflib

class DocumentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.document_id = self.scope['url_route']['kwargs']['document_id']
        self.group_name = f'document_{self.document_id}'

        user = self.scope.get('user')
        if not user or user.is_anonymous:
            await self.close(code=4001)
            return

        try:
            document = await sync_to_async(Document.objects.get)(id=self.document_id)
            workspace = await sync_to_async(lambda: document.workspace)()
            is_member = await sync_to_async(
                lambda: WorkspaceMember.objects.filter(
                    workspace=workspace, user=user
                ).exists()
            )()
            if not is_member:
                await self.close(code=4003)
                return
        except ObjectDoesNotExist:
            await self.close(code=4004)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        user = self.scope.get('user')
        if not user or user.is_anonymous:
            await self.send(text_data=json.dumps({'error': 'Authentication required'}))
            return

        data = json.loads(text_data)
        content = data.get('content')
        user_id = data.get('user_id')
        if not content or not isinstance(content, dict) or 'blocks' not in content or not isinstance(content['blocks'], list) or not content['blocks']:
            await self.send(text_data=json.dumps({'error': 'Invalid content format: blocks must be a non-empty list'}))
            return

        try:
            document = await sync_to_async(Document.objects.get)(id=self.document_id)
            workspace = await sync_to_async(lambda: document.workspace)()
            member = await sync_to_async(
                lambda: WorkspaceMember.objects.get(workspace=workspace, user=user)
            )()
            if member.role == 'viewer':
                await self.send(text_data=json.dumps({'error': 'Viewers cannot edit documents'}))
                return

            old_content = document.content.get('blocks', [{}])[0].get('text', '') if document.content.get('blocks') else ''
            new_content = content['blocks'][0].get('text', '') if content['blocks'] else ''
            diff = list(difflib.ndiff(old_content.splitlines(), new_content.splitlines())) if old_content != new_content else []

            

            # Do not save document here; rely on explicit API calls
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'document_update',
                    'message': {
                        'content': content,
                        'diff': diff,
                        'user_id': user_id,
                        'user': user.username
                    }
                }
            )
        except ObjectDoesNotExist:
            await self.send(text_data=json.dumps({'error': 'Document or membership not found'}))
        except Exception as e:
            print(f"Error in DocumentConsumer: {str(e)}")
            await self.send(text_data=json.dumps({'error': str(e)}))

    async def document_update(self, event):
        await self.send(text_data=json.dumps(event['message']))

class CommentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.document_id = self.scope['url_route']['kwargs']['document_id']
        self.group_name = f'comments_{self.document_id}'

        user = self.scope.get('user')
        if not user or user.is_anonymous:
            await self.close(code=4001)
            return

        try:
            document = await sync_to_async(Document.objects.get)(id=self.document_id)
            workspace = await sync_to_async(lambda: document.workspace)()
            is_member = await sync_to_async(
                lambda: WorkspaceMember.objects.filter(
                    workspace=workspace, user=user
                ).exists()
            )()
            if not is_member:
                await self.close(code=4003)
                return
        except ObjectDoesNotExist:
            await self.close(code=4004)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        user = self.scope.get('user')
        if not user or user.is_anonymous:
            await self.send(text_data=json.dumps({'error': 'Authentication required'}))
            return

        data = json.loads(text_data)
        comment = data.get('comment')
        delete_comment_id = data.get('delete_comment_id')

        try:
            document = await sync_to_async(Document.objects.get)(id=self.document_id)
            workspace = await sync_to_async(lambda: document.workspace)()
            member = await sync_to_async(
                lambda: WorkspaceMember.objects.get(workspace=workspace, user=user)
            )()
            if member.role == 'viewer' and (comment or delete_comment_id):
                await self.send(text_data=json.dumps({'error': 'Viewers cannot add or delete comments'}))
                return

            if comment:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'comment_update', 'message': {'comment': comment}}
                )
            elif delete_comment_id:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'comment_update', 'message': {'delete_comment_id': delete_comment_id}}
                )
            else:
                await self.send(text_data=json.dumps({'error': 'Invalid message format'}))
        except ObjectDoesNotExist:
            await self.send(text_data=json.dumps({'error': 'Document or membership not found'}))
        except Exception as e:
            print(f"Error in CommentConsumer: {str(e)}")
            await self.send(text_data=json.dumps({'error': str(e)}))

    async def comment_update(self, event):
        await self.send(text_data=json.dumps(event['message']))