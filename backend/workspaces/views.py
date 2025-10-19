from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Workspace, WorkspaceMember, Folder, Document, Comment
from .serializers import WorkspaceSerializer, WorkspaceMemberSerializer, FolderSerializer, DocumentSerializer, DocumentDetailSerializer, CommentSerializer
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.db import IntegrityError
import logging
from rest_framework.pagination import PageNumberPagination
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from .serializers import DocumentVersionSerializer
from .models import DocumentVersion
from pymongo import MongoClient
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from bson import ObjectId
from .utils import generate_invite_token, verify_invite_token



logger = logging.getLogger(__name__)

class IsWorkspaceOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return WorkspaceMember.objects.filter(workspace=obj, user=request.user, role='owner').exists()

class WorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        workspaces = Workspace.objects.filter(members__user=request.user)
        serializer = WorkspaceSerializer(workspaces, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WorkspaceSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            workspace = serializer.save()
            WorkspaceMember.objects.create(workspace=workspace, user=request.user, role='owner')
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        logger.error(f"Workspace creation failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class WorkspaceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceOwner]

    def get(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk)
        serializer = WorkspaceSerializer(workspace)
        return Response(serializer.data)

    def put(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk)
        serializer = WorkspaceSerializer(workspace, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        logger.error(f"Workspace update failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk)
        workspace.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class WorkspaceMemberView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceOwner]

    def get(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for member retrieval")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        members = WorkspaceMember.objects.filter(workspace_id=workspace_id)
        serializer = WorkspaceMemberSerializer(members, many=True)
        return Response(serializer.data)

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for member addition")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkspaceMemberSerializer(data=request.data, context={'workspace_id': workspace_id})
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except IntegrityError:
                logger.error(f"Duplicate member for workspace {workspace_id}: {request.data}")
                return Response(
                    {'error': 'This user is already a member of the workspace'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        logger.error(f"Member addition failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)





class WorkspaceInviteLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceOwner]

    def post(self, request, workspace_id):
        role = request.data.get("role", "viewer")
        if role not in ["viewer", "editor"]:
            return Response({"error": "Invalid role"}, status=400)

        token = generate_invite_token(workspace_id, role)
        invite_link = f"{settings.FRONTEND_URL}/workspaces/join?token={token}"

        return Response({"invite_link": invite_link})



class FolderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
            if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists():
                logger.warning(f"Permission denied for user {request.user.username} in workspace {workspace_id}")
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            folders = Folder.objects.filter(workspace_id=workspace_id)
            serializer = FolderSerializer(folders, many=True, context={'workspace_id': workspace_id})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for folder retrieval")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
            if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user, role__in=['owner', 'editor']).exists():
                logger.warning(f"Permission denied for user {request.user.username} in workspace {workspace_id}")
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            data = request.data.copy()
            data['workspace'] = workspace.id
            serializer = FolderSerializer(data=data, context={'workspace_id': workspace_id})
            if serializer.is_valid():
                folder = serializer.save()
                logger.info(f"Folder created: {folder.name} in workspace {workspace_id} by user {request.user.username}")
                return Response(FolderSerializer(folder).data, status=status.HTTP_201_CREATED)
            logger.error(f"Folder validation failed: {serializer.errors}, data: {request.data}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for folder creation")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        except IntegrityError:
            logger.error(f"Duplicate folder name in workspace {workspace_id}: {request.data}")
            return Response(
                {'error': 'A folder with this name already exists in the specified workspace and parent folder'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Folder creation failed: {str(e)}, data: {request.data}")
            return Response({'error': f'Failed to create folder: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

class FolderDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, workspace_id, folder_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
            if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user, role__in=['owner', 'editor']).exists():
                logger.warning(f"Permission denied for user {request.user.username} in workspace {workspace_id}")
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            folder = Folder.objects.get(id=folder_id, workspace_id=workspace_id)
            if Folder.objects.filter(parent=folder).exists() or Document.objects.filter(folder=folder).exists():
                logger.warning(f"Cannot delete folder {folder_id}: contains subfolders or documents")
                return Response(
                    {'error': 'Cannot delete folder with subfolders or documents'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            folder.delete()
            logger.info(f"Folder {folder_id} deleted in workspace {workspace_id} by user {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for folder deletion")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        except Folder.DoesNotExist:
            logger.error(f"Folder {folder_id} not found in workspace {workspace_id}")
            return Response({'error': 'Folder not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Folder deletion failed: {str(e)}")
            return Response({'error': f'Failed to delete folder: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

class DocumentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for document retrieval")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists():
            logger.warning(f"Permission denied for user {request.user.username} in workspace {workspace_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        documents = Document.objects.filter(workspace_id=workspace_id)
        serializer = DocumentDetailSerializer(documents, many=True)
        return Response(serializer.data)

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for document creation")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user, role__in=['owner', 'editor']).exists():
            logger.warning(f"Permission denied for user {request.user.username} in workspace {workspace_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DocumentSerializer(data=request.data, context={'workspace_id': workspace_id})
        if serializer.is_valid():
            try:
                document = serializer.save()
                return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Document creation failed: {str(e)}, data: {request.data}")
                return Response(
                    {'error': f'Failed to create document: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        logger.error(f"Document validation failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DocumentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {pk}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DocumentDetailSerializer(document)
        return Response(serializer.data)

    def put(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['owner', 'editor']).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {pk}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DocumentSerializer(document, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        logger.error(f"Document update failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role='owner').exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {pk}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class AttachmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, document_id):
        document = get_object_or_404(Document, pk=document_id)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['owner', 'editor']).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {document_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        file = request.FILES.get('file')
        if not file:
            logger.error("No file provided for attachment upload")
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        if file.size > 5 * 1024 * 1024:  # 5MB limit
            logger.error(f"File too large: {file.size} bytes")
            return Response({'error': 'File too large'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            file_path = default_storage.save(f'documents/{document_id}/{file.name}', file)
            return Response({'file_url': default_storage.url(file_path)}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Attachment upload failed: {str(e)}")
            return Response({'error': f'Failed to upload file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

class CommentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, document_id):
        document = get_object_or_404(Document, pk=document_id)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {document_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        comments = Comment.objects.filter(document_id=document_id)
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    def post(self, request, document_id):
        document = get_object_or_404(Document, pk=document_id)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['owner', 'editor']).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {document_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        serializer = CommentSerializer(data=request.data, context={'request': request, 'document_id': document_id})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        logger.error(f"Comment creation failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CommentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        document = comment.document
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role='owner').exists() and comment.user != request.user:
            logger.warning(f"Permission denied for user {request.user.username} on comment {pk}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JoinWorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")
        data = verify_invite_token(token)
        if not data:
            return Response({"error": "Invalid or expired invite link"}, status=400)

        workspace_id = data["workspace_id"]
        role = data["role"]

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({"error": "Workspace not found"}, status=404)

        if WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists():
            return Response({"error": "Already a member"}, status=400)

        WorkspaceMember.objects.create(workspace=workspace, user=request.user, role=role)
        return Response({"message": f"Successfully joined as {role}"}, status=201)


class LastFivePagination(PageNumberPagination):
    page_size = 5
    page_size_query_param = 'page_size'
    max_page_size = 50

class DocumentVersionView(APIView, LastFivePagination):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, document_id):
        document = get_object_or_404(Document, pk=document_id)

        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user).exists():
            logger.warning(
                f"Permission denied for user {request.user.username} on document {document_id}"
            )
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        versions_qs = DocumentVersion.objects.filter(document_id=document_id).order_by('-created_at')

        # Use DRF pagination
        results = self.paginate_queryset(versions_qs, request, view=self)
        serializer = DocumentVersionSerializer(results, many=True)
        return self.get_paginated_response(serializer.data)


class DocumentVersionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, document_id, version_id):
        document = get_object_or_404(Document, pk=document_id)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {document_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        version = get_object_or_404(DocumentVersion, pk=version_id, document_id=document_id)
        serializer = DocumentVersionSerializer(version)
        return Response(serializer.data)


class DocumentSaveVersionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, document_id):
        document = get_object_or_404(Document, pk=document_id)
        if not document.workspace.members.filter(user=request.user, role__in=['owner', 'editor']).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {document_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        content = request.data.get('content')
        logger.info(f"Received save version request for document {document_id}: {content}")
        
        if not content or not isinstance(content, dict) or not content.get('blocks') or not content['blocks'][0].get('text', '').strip():
            logger.error(f"Invalid or empty content for document {document_id}: {content}")
            return Response({'error': 'Content cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            client = MongoClient(settings.MONGO_URI)
            db = client[settings.MONGO_DB_NAME]
            mongo_version_id = db['document_versions'].insert_one({
                'document_id': document_id,
                'content': content,
                'user_id': request.user.id,
                'created_at': document._get_current_time()
            }).inserted_id
            client.close()
            
            version_number = DocumentVersion.objects.filter(document_id=document_id).count() + 1
            version = DocumentVersion.objects.create(
                document=document,
                user=request.user,
                version_number=version_number,
                mongo_version_id=str(mongo_version_id)
            )
            
            document.content = content
            document._user = request.user
            document.save(create_version=False)
            
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'document_{document_id}',
                {
                    'type': 'document_update',
                    'message': {
                        'content': content,
                        'version_id': version.id,
                        'version_number': version_number,
                        'user_id': request.user.id,
                        'user': request.user.username,
                        'created_at': version.created_at.isoformat()
                    }
                }
            )
            
            logger.info(f"Version {version_number} saved for document {document_id}")
            return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error saving version for document {document_id}: {str(e)}")
            return Response({'error': 'Failed to save version'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class DocumentRevertView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, document_id, version_id):
        document = get_object_or_404(Document, pk=document_id)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['owner', 'editor']).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {document_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        version = get_object_or_404(DocumentVersion, pk=version_id, document_id=document_id)
        try:
            client = MongoClient(settings.MONGO_URI)
            db = client[settings.MONGO_DB_NAME]
            version_data = db['document_versions'].find_one({'_id': ObjectId(version.mongo_version_id)})
            client.close()
            if not version_data or 'content' not in version_data:
                logger.error(f"Version {version_id} content not found in MongoDB")
                return Response({'error': 'Version content not found'}, status=status.HTTP_404_NOT_FOUND)
            
            content = version_data['content']
            document.content = (
                content if isinstance(content, str) 
                else content.get('blocks', [{}])[0].get('text', '')
            )
            document._user = request.user
            document.save(create_version=False)
            
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'document_{document_id}',
                {
                    'type': 'document_update',
                    'message': {
                        'content': document.content,
                        'version_number': version.version_number,
                        'user_id': request.user.id,
                        'user': request.user.username,
                    }
                }
            )
            
            return Response(DocumentSerializer(document).data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Revert error for version {version_id}: {str(e)}")
            return Response({'error': 'Failed to revert version'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)





class SaveDocumentVersionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['owner', 'editor']).exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {pk}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        content = request.data.get('content', document.content)
        if not isinstance(content, dict) or 'blocks' not in content or not isinstance(content['blocks'], list) or not content['blocks']:
            return Response({'error': 'Invalid content format'}, status=status.HTTP_400_BAD_REQUEST)
        
        document.content = content
        document.save(create_version=True, user=request.user)
        
        version = document.versions.order_by('-version_number').first()
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'document_{pk}',
            {
                'type': 'document_update',
                'message': {
                    'content': document.content,
                    'version_number': version.version_number,
                    'version_id': version.id,
                    'user': version.user.username if version.user else 'Unknown',
                    'created_at': version.created_at.isoformat()
                }
            }
        )
        
        return Response(DocumentVersionSerializer(version).data, status=status.HTTP_200_OK)
    
    