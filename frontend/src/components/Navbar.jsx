import { Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('access_token');
  const { dark, setDark } = useContext(ThemeContext);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-gray-800 dark:to-gray-900 p-4 shadow-lg">
      <div className="container flex justify-between items-center">
        <Link to="/" className="text-white dark:text-gray-100 text-2xl font-bold tracking-tight flex items-center">
          <svg className="w-8 h-8 mr-2 text-white dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5v-4a2 2 0 012-2h10a2 2 0 012 2v4h-4m-6 0h.01M12 16h.01"></path>
          </svg>
          CoWriter
        </Link>
        <div className="space-x-4 flex items-center">
          {token ? (
            <>
              <Link to="/profile" className="nav-link">Profile</Link>
              <button onClick={handleLogout} className="nav-link">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Register</Link>
            </>
          )}
          <button onClick={() => setDark(!dark)} className="nav-link">
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;