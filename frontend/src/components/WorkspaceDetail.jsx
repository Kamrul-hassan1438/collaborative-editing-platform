import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../axios';
import Modal from './Modal';

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
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

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
        const res = await axios.post(
        `http://localhost:8000/api/workspaces/${id}/invite-link/`,
        { role: shareRole },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      console.log(res.data);
        setWorkspace(workspaceRes.data);
        setFolders(foldersRes.data);
        setDocuments(documentsRes.data);
        setMembers(membersRes.data);
        setNewWorkspaceName(workspaceRes.data.name);
        setShareLink(res.data.invite_link);

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
        { name: folderName, parent: null },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setFolders([...folders, response.data]);
      setFolderName('');
      setShowFolderModal(false);
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
      setShowDocumentModal(false);
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
      setShowUpdateModal(false);
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
      setShowMemberModal(false);
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
  if (!workspace) return <div className="text-center p-6 text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="container py-8">
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{workspace.name}</h2>
          <button onClick={() => setShowUpdateModal(true)} className="btn-secondary flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Name
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <button onClick={handleWorkspaceDelete} className="btn-danger  flex items-center justify-right mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Workspace
        </button>
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Share Workspace</h3>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Share as</label>
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
            <button onClick={handleCopyShareLink} className="btn-accent flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v12a2 2 0 01-2 2h-6a2 2 0 01-2-2V7z" />
              </svg>
              Copy Link
            </button>
          </div>
        </div>
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Members</h3>
            <button onClick={() => setShowMemberModal(true)} className="btn-primary flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9a3 3 0 00-3-3H9a3 3 0 00-3 3v6a3 3 0 003 3h6a3 3 0 003-3V9zM12 6v.01M12 9v.01M12 12v.01M12 15v.01" />
              </svg>
              Add Member
            </button>
          </div>
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {member.user.username} ({member.role})
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Folders</h3>
              <button onClick={() => setShowFolderModal(true)} className="btn-primary flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Create Folder
              </button>
            </div>
            <ul className="space-y-2">
              {folders.map((folder) => (
                <li key={folder.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between items-center">
                  {folder.name}
                  <button
                    onClick={() => handleFolderDelete(folder.id)}
                    className="btn-danger text-sm flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Documents</h3>
              <button onClick={() => setShowDocumentModal(true)} className="btn-primary flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Create Document
              </button>
            </div>
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  {doc.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Modal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} title="Update Workspace Name">
        <form onSubmit={handleWorkspaceUpdate}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Workspace Name</label>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">Update</button>
        </form>
      </Modal>

      <Modal isOpen={showFolderModal} onClose={() => setShowFolderModal(false)} title="Create New Folder">
        <form onSubmit={handleFolderSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Folder Name</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">Create</button>
        </form>
      </Modal>

      <Modal isOpen={showDocumentModal} onClose={() => setShowDocumentModal(false)} title="Create New Document">
        <form onSubmit={handleDocumentSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Document Title</label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">Create</button>
        </form>
      </Modal>

      <Modal isOpen={showMemberModal} onClose={() => setShowMemberModal(false)} title="Add New Member">
        <form onSubmit={handleMemberSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Member Email</label>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Role</label>
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
          <button type="submit" className="btn-primary w-full">Add</button>
        </form>
      </Modal>
    </div>
  );
}

export default WorkspaceDetail;