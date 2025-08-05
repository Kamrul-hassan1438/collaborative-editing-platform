# backend/workspaces/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Workspace, WorkspaceMember, Folder, Document, Comment
from .serializers import WorkspaceSerializer, WorkspaceMemberSerializer, FolderSerializer, DocumentSerializer, DocumentDetailSerializer, CommentSerializer
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.db import IntegrityError
import logging

logger = logging.getLogger(__name__)

class IsWorkspaceAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return WorkspaceMember.objects.filter(workspace=obj, user=request.user, role='admin').exists()

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
            WorkspaceMember.objects.create(workspace=workspace, user=request.user, role='admin')
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        logger.error(f"Workspace creation failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class WorkspaceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceAdmin]

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
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceAdmin]

    def get(self, request, workspace_id):
        members = WorkspaceMember.objects.filter(workspace_id=workspace_id)
        serializer = WorkspaceMemberSerializer(members, many=True)
        return Response(serializer.data)

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for member addition")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkspaceMemberSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save(workspace_id=workspace_id)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except IntegrityError:
                logger.error(f"Duplicate member for workspace {workspace_id}: {request.data}")
                return Response(
                    {'error': 'This user is already a member of the workspace'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        logger.error(f"Member addition failed: {serializer.errors}, data: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FolderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_id):
        try:
            Workspace.objects.get(id=workspace_id)
            folders = Folder.objects.filter(workspace_id=workspace_id)
            serializer = FolderSerializer(folders, many=True)
            return Response(serializer.data)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for folder retrieval")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for folder creation")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user, role__in=['admin', 'member']).exists():
            logger.warning(f"Permission denied for user {request.user.username} in workspace {workspace_id}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        serializer = FolderSerializer(data=request.data, context={'workspace_id': workspace_id})
        if serializer.is_valid():
            try:
                folder = serializer.save()
                return Response(FolderSerializer(folder).data, status=status.HTTP_201_CREATED)
            except IntegrityError:
                logger.error(f"Duplicate folder name in workspace {workspace_id}: {request.data}")
                return Response(
                    {'error': 'A folder with this name already exists in the specified workspace and parent folder'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                logger.error(f"Folder creation failed: {str(e)}, data: {request.data}")
                return Response(
                    {'error': f'Failed to create folder: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        logger.error(f"Folder validation failed: {serializer.errors}, data: {request.data}")
        return Response(
            {'error': serializer.errors or 'Invalid data provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

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
        if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user, role__in=['admin', 'member']).exists():
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
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['admin', 'member']).exists():
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
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role='admin').exists():
            logger.warning(f"Permission denied for user {request.user.username} on document {pk}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class AttachmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, document_id):
        document = get_object_or_404(Document, pk=document_id)
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['admin', 'member']).exists():
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
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role__in=['admin', 'member']).exists():
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
        if not WorkspaceMember.objects.filter(workspace=document.workspace, user=request.user, role='admin').exists() and comment.user != request.user:
            logger.warning(f"Permission denied for user {request.user.username} on comment {pk}")
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class JoinWorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, workspace_id):
        role = request.data.get('role', 'viewer')
        if role not in ['member', 'viewer']:
            logger.error(f"Invalid role provided: {role}")
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            workspace = Workspace.objects.get(id=workspace_id)
            if WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists():
                logger.warning(f"User {request.user.username} already a member of workspace {workspace_id}")
                return Response({'error': 'You are already a member of this workspace'}, status=status.HTTP_400_BAD_REQUEST)
            WorkspaceMember.objects.create(workspace=workspace, user=request.user, role=role)
            return Response({'message': 'Successfully joined workspace'}, status=status.HTTP_201_CREATED)
        except Workspace.DoesNotExist:
            logger.error(f"Workspace {workspace_id} not found for join request")
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
        
        