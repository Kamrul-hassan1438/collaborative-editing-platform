import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
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
      setError('');
      navigate(`/workspaces/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    }
  };

  if (loading) return <div className="text-center p-6">Loading...</div>;
  if (error && !workspaces.length) return <div className="text-red-500 text-center p-6">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Workspaces</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleWorkspaceSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block text-gray-700">New Workspace Name</label>
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter workspace name"
            required
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
          Create Workspace
        </button>
      </form>
      {workspaces.length === 0 ? (
        <p className="text-gray-500">No workspaces available</p>
      ) : (
        <ul>
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className="p-2 border-b cursor-pointer hover:bg-gray-100"
              onClick={() => navigate(`/workspaces/${workspace.id}`)}
            >
              {workspace.name} (Owner: {workspace.owner?.username || 'Unknown'})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default WorkspaceList;