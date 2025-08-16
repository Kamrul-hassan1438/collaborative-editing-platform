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
        const response = await axios.get('http://localhost:8000/api/me/', {
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

  if (!user) return <div className="text-center p-6 text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="container py-8">
      <div className="card max-w-md mx-auto">
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full bg-gray-300 dark:bg-gray-600 mb-4 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{user.username}</h2>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="space-y-4">
          <p><strong className="text-gray-900 dark:text-gray-100">Email:</strong> {user.email}</p>
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