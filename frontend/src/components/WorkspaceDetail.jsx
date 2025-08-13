import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../axios';

function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('editor');
  const [shareRole, setShareRole] = useState('viewer');
  const [shareLink, setShareLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const [workspaceRes, foldersRes, documentsRes, membersRes] = await Promise.all([
          axios.get(`http://localhost:8000/api/workspaces/${id}/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          }),
          axios.get(`http://localhost:8000/api/workspaces/${id}/folders/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          }),
          axios.get(`http://localhost:8000/api/workspaces/${id}/documents/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          }),
          axios.get(`http://localhost:8000/api/workspaces/${id}/members/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          }),
        ]);
        setWorkspace(workspaceRes.data);
        setFolders(foldersRes.data);
        setDocuments(documentsRes.data);
        setMembers(membersRes.data);
        setNewWorkspaceName(workspaceRes.data.name);
        setShareLink(`${window.location.origin}/workspaces/${id}/join?role=${shareRole}`);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load workspace');
        if (err.response?.status === 404) {
          navigate('/workspaces');
        }
      }
    };
    fetchWorkspace();
  }, [id, shareRole, navigate]);

  const handleFolderSubmit = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }
    try {
      const response = await axios.post(
        `http://localhost:8000/api/workspaces/${id}/folders/`,
        { name: folderName, parent: null }, // Add parent: null
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setFolders([...folders, response.data]);
      setFolderName('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create folder');
    }
  };

  const handleFolderDelete = async (folderId) => {
    if (window.confirm('Are you sure you want to delete this folder?')) {
      try {
        await axios.delete(`http://localhost:8000/api/workspaces/${id}/folders/${folderId}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        setFolders(folders.filter((folder) => folder.id !== folderId));
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete folder');
      }
    }
  };

  const handleDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!documentTitle.trim()) {
      setError('Document title cannot be empty');
      return;
    }
    try {
      const response = await axios.post(
        `http://localhost:8000/api/workspaces/${id}/documents/`,
        { title: documentTitle, content: { blocks: [] } },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setDocuments([...documents, response.data]);
      setDocumentTitle('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create document');
    }
  };

  const handleWorkspaceUpdate = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) {
      setError('Workspace name cannot be empty');
      return;
    }
    try {
      const response = await axios.put(
        `http://localhost:8000/api/workspaces/${id}/`,
        { name: newWorkspaceName },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setWorkspace(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update workspace');
    }
  };

  const handleWorkspaceDelete = async () => {
    if (window.confirm('Are you sure you want to delete this workspace?')) {
      try {
        await axios.delete(`http://localhost:8000/api/workspaces/${id}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        navigate('/workspaces');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete workspace');
      }
    }
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) {
      setError('Member email cannot be empty');
      return;
    }
    try {
      const userResponse = await axios.get('http://localhost:8000/api/users/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        params: { email: memberEmail },
      });
      if (userResponse.data.length === 0) {
        setError('User with this email does not exist');
        return;
      }
      const userId = userResponse.data[0].id;
      const response = await axios.post(
        `http://localhost:8000/api/workspaces/${id}/members/`,
        { user_id: userId, role: memberRole },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setMembers([...members, response.data]);
      setMemberEmail('');
      setMemberRole('editor');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => alert('Share link copied to clipboard!'))
      .catch(() => alert('Failed to copy link'));
  };

  if (!workspace && error) return <div className="error text-center">{error}</div>;
  if (!workspace) return <div className="text-center p-6 text-gray-500">Loading...</div>;

  return (
    <div className="container py-8">
      <div className="card">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">{workspace.name}</h2>
        {error && <p className="error">{error}</p>}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Update Workspace</h3>
          <form onSubmit={handleWorkspaceUpdate} className="mb-6">
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Workspace Name</label>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                className="input"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full">Update Workspace</button>
          </form>
          <button onClick={handleWorkspaceDelete} className="btn-danger w-full">Delete Workspace</button>
        </div>
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Share Workspace</h3>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Share as</label>
            <select
              value={shareRole}
              onChange={(e) => setShareRole(e.target.value)}
              className="select"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          <div className="flex items-center">
            <input type="text" value={shareLink} readOnly className="input mr-2" />
            <button onClick={handleCopyShareLink} className="btn-accent">Copy Link</button>
          </div>
        </div>
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Members</h3>
          <ul className="mb-6 space-y-2">
            {members.map((member) => (
              <li key={member.id} className="p-3 bg-gray-50 rounded-lg">
                {member.user.username} ({member.role})
              </li>
            ))}
          </ul>
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Add Member</h3>
          <form onSubmit={handleMemberSubmit} className="mb-6">
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Member Email</label>
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Role</label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className="select"
              >
                <option value="owner">Owner</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">Add Member</button>
          </form>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Folders</h3>
            <form onSubmit={handleFolderSubmit} className="mb-6">
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Folder Name</label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full">Create Folder</button>
            </form>
            <ul className="space-y-2">
              {folders.map((folder) => (
                <li key={folder.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                  {folder.name}
                  <button
                    onClick={() => handleFolderDelete(folder.id)}
                    className="text-error text-sm hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Documents</h3>
            <form onSubmit={handleDocumentSubmit} className="mb-6">
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Document Title</label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full">Create Document</button>
            </form>
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  {doc.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceDetail;