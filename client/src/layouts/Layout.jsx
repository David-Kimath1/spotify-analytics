import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, User, Users, BarChart3, LogOut, Music, Menu, X } from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/profile', icon: User, label: 'Profile' },
    { path: '/friends', icon: Users, label: 'Friends' },
    { path: '/wrapped', icon: BarChart3, label: 'Wrapped' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Menu Button */}
      <div className="menu-button" onClick={() => setMobileMenuOpen(true)}>
        <Menu className="w-6 h-6" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`sidebar-mobile ${mobileMenuOpen ? 'open' : ''} md:hidden`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Music className="w-6 h-6 text-green-500" />
            <span className="font-bold">Spotify Social</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="flex items-center space-x-3 mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <img
              src={user?.profileImage || 'https://via.placeholder.com/40'}
              alt={user?.displayName}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="text-sm font-medium">{user?.displayName || 'User'}</p>
              <p className="text-xs text-gray-500">Spotify User</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="desktop-sidebar fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-lg z-10">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Music className="w-8 h-8 text-green-500" />
              <span className="text-xl font-bold">Spotify Social</span>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-3">
              <img
                src={user?.profileImage || 'https://via.placeholder.com/40'}
                alt={user?.displayName}
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-1">
                <p className="text-sm font-medium truncate">{user?.displayName || 'User'}</p>
                <p className="text-xs text-gray-500">Spotify User</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="bottom-nav safe-bottom">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-green-500 transition"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs">{item.label === 'Dashboard' ? 'Home' : item.label}</span>
          </Link>
        ))}
      </div>

      {/* Main Content */}
      <div className="md:ml-64 pb-20 md:pb-8">
        <div className="p-4 md:p-8 safe-top">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
