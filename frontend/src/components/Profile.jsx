import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Profile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/profile/', {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        setUser(response.data);
      } catch (err) {
        setError('Failed to load profile');
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  if (!user) return <div className="text-center p-6 text-gray-500">Loading...</div>;

  return (
    <div className="container py-8">
      <div className="card max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Profile</h2>
        {error && <p className="error">{error}</p>}
        <div className="space-y-4">
          <p><strong className="text-gray-900">Username:</strong> {user.username}</p>
          <p><strong className="text-gray-900">Email:</strong> {user.email}</p>
          <button
            onClick={() => navigate('/workspaces')}
            className="btn-primary w-full"
          >
            Go to Workspaces
          </button>
          <button
            onClick={handleLogout}
            className="btn-danger w-full"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;