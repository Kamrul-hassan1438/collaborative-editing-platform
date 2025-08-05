# backend/workspaces/serializers.py
from rest_framework import serializers
from .models import Workspace, WorkspaceMember, Folder, Document, Comment
from users.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class WorkspaceSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Workspace
        fields = ['id', 'name', 'owner', 'created_at']
        read_only_fields = ['owner', 'created_at']

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)

class WorkspaceMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField()
    user = UserSerializer(read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ['id', 'workspace', 'user', 'user_id', 'role']
        read_only_fields = ['workspace', 'user']

    def create(self, validated_data):
        workspace_id = self.context.get('workspace_id')
        validated_data['workspace'] = Workspace.objects.get(id=workspace_id)
        validated_data['user'] = User.objects.get(id=validated_data['user_id'])
        return super().create(validated_data)

class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ['id', 'name', 'workspace', 'parent', 'created_at']
        read_only_fields = ['workspace', 'created_at']

    def create(self, validated_data):
        workspace_id = self.context.get('workspace_id')
        validated_data['workspace'] = Workspace.objects.get(id=workspace_id)
        return super().create(validated_data)

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'title', 'workspace', 'folder', 'content', 'created_at', 'updated_at']
        read_only_fields = ['workspace', 'created_at', 'updated_at']

    def create(self, validated_data):
        workspace_id = self.context.get('workspace_id')
        validated_data['workspace'] = Workspace.objects.get(id=workspace_id)
        return super().create(validated_data)

class DocumentDetailSerializer(DocumentSerializer):
    workspace = WorkspaceSerializer(read_only=True)
    folder = FolderSerializer(read_only=True)

class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'document', 'user', 'content', 'block_id', 'created_at']
        read_only_fields = ['document', 'user', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        validated_data['document_id'] = self.context['document_id']
        return super().create(validated_data)