from rest_framework import serializers
from .models import Workspace, WorkspaceMember, Folder, Document, Comment
from users.models import User
from .models import DocumentVersion
from pymongo import MongoClient
from django.conf import settings

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
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'parent': {'required': False, 'allow_null': True}
        }

    def validate(self, data):
        workspace_id = self.context.get('workspace_id')
        if not workspace_id:
            raise serializers.ValidationError("Workspace ID is required in context.")
        
        if data.get('workspace').id != int(workspace_id):
            raise serializers.ValidationError("Folder must belong to the specified workspace.")
        
        if 'parent' not in data or data['parent'] is None:
            data['parent'] = None
        else:
            if data['parent'].workspace.id != int(workspace_id):
                raise serializers.ValidationError("Parent folder must belong to the same workspace.")
        
        existing_folder = Folder.objects.filter(
            workspace_id=workspace_id,
            parent=data['parent'],
            name=data['name']
        ).exists()
        if existing_folder:
            raise serializers.ValidationError(
                "A folder with this name already exists in the specified workspace and parent folder."
            )
        
        return data

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'title', 'workspace', 'folder', 'content', 'created_at', 'updated_at']
        read_only_fields = ['workspace', 'created_at', 'updated_at']

    def validate_content(self, value):
        if not isinstance(value, dict) or 'blocks' not in value or not isinstance(value['blocks'], list) or not value['blocks']:
            return {"blocks": [{"text": ""}]}
        return value

    def create(self, validated_data):
        workspace_id = self.context.get('workspace_id')
        validated_data['workspace'] = Workspace.objects.get(id=workspace_id)
        if 'content' not in validated_data or not validated_data['content']:
            validated_data['content'] = {"blocks": [{"text": ""}]}
        return super().create(validated_data)

    def update(self, instance, validated_data):
        instance.title = validated_data.get('title', instance.title)
        instance.content = self.validate_content(validated_data.get('content', instance.content))
        instance.save(create_version=False)
        return instance

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

class DocumentVersionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    content = serializers.SerializerMethodField()

    class Meta:
        model = DocumentVersion
        fields = ['id', 'document', 'user', 'version_number', 'content', 'created_at']
        read_only_fields = ['document', 'user', 'version_number', 'created_at']

    def get_content(self, obj):
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        version_data = db['document_versions'].find_one({'_id': obj.mongo_version_id})
        client.close()
        return version_data['content'] if version_data else {"blocks": [{"text": ""}]}
    