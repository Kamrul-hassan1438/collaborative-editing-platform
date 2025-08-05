
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function WorkspaceDetail() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [shareRole, setShareRole] = useState('viewer');
  const [shareLink, setShareLink] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
          navigate('/workspaces'); // Redirect if workspace not found
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
        { name: folderName },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setFolders([...folders, response.data]);
      setFolderName('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create folder');
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
      setMemberRole('member');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.write(shareLink);
    alert('Share link copied to clipboard!');
  };

  if (!workspace && error) return <div className="text-red-500">{error}</div>;

  if (!workspace) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">{workspace.name}</h2>
      {error && <p className="text-red-500">{error}</p>}
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Update Workspace</h3>
        <form onSubmit={handleWorkspaceUpdate} className="mb-4">
          <div className="mb-4">
            <label className="block text-gray-700">Workspace Name</label>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
            Update Workspace
          </button>
        </form>
        <button
          onClick={handleWorkspaceDelete}
          className="w-full bg-red-600 text-white p-2 rounded"
        >
          Delete Workspace
        </button>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Share Workspace</h3>
        <div className="mb-4">
          <label className="block text-gray-700">Share as</label>
          <select
            value={shareRole}
            onChange={(e) => setShareRole(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="viewer">Viewer</option>
            <option value="member">Editor</option>
          </select>
        </div>
        <div className="flex">
          <input
            type="text"
            value={shareLink}
            readOnly
            className="w-full p-2 border rounded mr-2"
          />
          <button
            onClick={handleCopyShareLink}
            className="bg-green-600 text-white p-2 rounded"
          >
            Copy Link
          </button>
        </div>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Members</h3>
        <ul className="mb-4">
          {members.map((member) => (
            <li key={member.id} className="p-2 border-b">
              {member.user.username} ({member.role})
            </li>
          ))}
        </ul>
        <h3 className="text-xl font-bold mb-2">Add Member</h3>
        <form onSubmit={handleMemberSubmit} className="mb-4">
          <div className="mb-4">
            <label className="block text-gray-700">Member Email</label>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Role</label>
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
            Add Member
          </button>
        </form>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Folders</h3>
          <form onSubmit={handleFolderSubmit} className="mb-4">
            <div className="mb-4">
              <label className="block text-gray-700">Folder Name</label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
              Create Folder
            </button>
          </form>
          <ul>
            {folders.map((folder) => (
              <li key={folder.id} className="p-2 border-b">
                {folder.name}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Documents</h3>
          <form onSubmit={handleDocumentSubmit} className="mb-4">
            <div className="mb-4">
              <label className="block text-gray-700">Document Title</label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
              Create Document
            </button>
          </form>
          <ul>
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="p-2 border-b cursor-pointer"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                {doc.title}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceDetail;