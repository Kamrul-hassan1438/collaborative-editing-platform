import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Modal from './Modal';

function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8000/api/workspaces/', {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        setWorkspaces(response.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    };
    if (localStorage.getItem('access_token')) {
      fetchWorkspaces();
    } else {
      setError('Please log in to view workspaces');
      setLoading(false);
      navigate('/login');
    }
  }, [navigate]);

  const handleWorkspaceSubmit = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) {
      setError('Workspace name cannot be empty');
      return;
    }
    try {
      const response = await axios.post(
        'http://localhost:8000/api/workspaces/',
        { name: newWorkspaceName },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setWorkspaces([...workspaces, response.data]);
      setNewWorkspaceName('');
      setShowCreateModal(false);
      setError('');
      navigate(`/workspaces/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    }
  };

  if (loading) return <div className="text-center p-6 text-gray-500 dark:text-gray-400">Loading...</div>;
  if (error && !workspaces.length) return <div className="error text-center p-6">{error}</div>;

  return (
    <div className="container py-8">
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Workspaces</h2>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Workspace
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {workspaces.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No workspaces available</p>
        ) : (
          <ul className="space-y-2">
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => navigate(`/workspaces/${workspace.id}`)}
              >
                {workspace.name} <span className="text-gray-500 dark:text-gray-400 text-sm">(Owner: {workspace.owner?.username || 'Unknown'})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Workspace">
        <form onSubmit={handleWorkspaceSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Workspace Name</label>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="input"
              placeholder="Enter workspace name"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Create
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default WorkspaceList;