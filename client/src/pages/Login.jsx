import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music, Users, BarChart3, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const { user, login, handleAuthCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleAuthCallback(code).then(success => {
        if (success) navigate('/');
      });
    }
  }, [user, navigate, handleAuthCallback]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-black flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Features */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="text-white space-y-8"
          >
            <div className="space-y-4">
              <h1 className="text-5xl font-bold">Spotify Social Analytics</h1>
              <p className="text-xl text-gray-300">
                Discover your music taste, track your listening habits, and connect with friends
              </p>
            </div>

            <div className="space-y-4">
              <Feature icon={<Music />} text="Track your listening history and discover insights" />
              <Feature icon={<BarChart3 />} text="Detailed analytics of your music taste" />
              <Feature icon={<Users />} text="See what your friends are listening to in real-time" />
              <Feature icon={<TrendingUp />} text="Get weekly and monthly wrapped summaries" />
            </div>
          </motion.div>

          {/* Right side - Login Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-4">
                <Music className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Sign in to continue to your music dashboard
              </p>
            </div>

            <button
              onClick={login}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <Music className="w-5 h-5" />
              <span>Continue with Spotify</span>
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const Feature = ({ icon, text }) => (
  <div className="flex items-center space-x-3">
    <div className="w-10 h-10 bg-green-500 bg-opacity-20 rounded-lg flex items-center justify-center">
      {icon}
    </div>
    <span className="text-gray-200">{text}</span>
  </div>
);

export default Login;