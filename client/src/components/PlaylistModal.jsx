import React, { useState } from 'react';
import { X, Loader, Music, Zap, Heart, Coffee, Brain, CheckCircle, ExternalLink } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const PlaylistModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [playlist, setPlaylist] = useState(null);
  const [playlistType, setPlaylistType] = useState(null);
  const [syncToSpotify, setSyncToSpotify] = useState(false);

  const generatePlaylist = async (type, mood = null) => {
    setLoading(true);
    setPlaylist(null);
    try {
      let response;
      if (type === 'smart') {
        response = await axios.post(`${API_URL}/playlist/smart`, { syncToSpotify });
        setPlaylistType('Smart Mix');
      } else if (type === 'mood') {
        response = await axios.post(`${API_URL}/playlist/mood/${mood}`, { syncToSpotify });
        setPlaylistType(`${mood.charAt(0).toUpperCase() + mood.slice(1)} Vibes`);
      }
      
      setPlaylist(response.data.playlist);
      if (response.data.playlist.syncedToSpotify) {
        toast.success('Playlist created on Spotify!');
      } else {
        toast.success('Playlist generated! Enable "Sync to Spotify" to save it to your account.');
      }
    } catch (error) {
      console.error('Playlist error:', error);
      toast.error(error.response?.data?.error || 'Failed to generate playlist');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Create Playlist</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Sync to Spotify Toggle */}
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div>
              <p className="font-semibold">📀 Sync to Spotify</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Save this playlist directly to your Spotify account</p>
            </div>
            <button
              onClick={() => setSyncToSpotify(!syncToSpotify)}
              className={`px-4 py-2 rounded-lg transition ${syncToSpotify ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              {syncToSpotify ? 'ON ✓' : 'OFF'}
            </button>
          </div>

          {/* Playlist Type Buttons */}
          {!playlist && !loading && (
            <div className="space-y-4">
              <h3 className="font-semibold mb-3">Choose playlist type:</h3>
              
              <button
                onClick={() => generatePlaylist('smart')}
                className="w-full p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-left hover:opacity-90 transition"
              >
                <div className="flex items-center space-x-3">
                  <Zap className="w-6 h-6" />
                  <div>
                    <p className="font-bold">🎯 Smart Mix</p>
                    <p className="text-sm opacity-90">Your top tracks + similar songs based on your taste</p>
                  </div>
                </div>
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => generatePlaylist('mood', 'energetic')} className="p-3 bg-orange-500 text-white rounded-xl text-center hover:opacity-90">
                  <Zap className="w-5 h-5 mx-auto mb-1" />
                  <p className="font-semibold">Energetic</p>
                </button>
                <button onClick={() => generatePlaylist('mood', 'relaxed')} className="p-3 bg-blue-500 text-white rounded-xl text-center hover:opacity-90">
                  <Coffee className="w-5 h-5 mx-auto mb-1" />
                  <p className="font-semibold">Relaxed</p>
                </button>
                <button onClick={() => generatePlaylist('mood', 'happy')} className="p-3 bg-yellow-500 text-white rounded-xl text-center hover:opacity-90">
                  <Heart className="w-5 h-5 mx-auto mb-1" />
                  <p className="font-semibold">Happy</p>
                </button>
                <button onClick={() => generatePlaylist('mood', 'focused')} className="p-3 bg-green-500 text-white rounded-xl text-center hover:opacity-90">
                  <Brain className="w-5 h-5 mx-auto mb-1" />
                  <p className="font-semibold">Focused</p>
                </button>
              </div>
            </div>
          )}
          
          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-green-500" />
              <p>Analyzing your taste and finding similar songs...</p>
            </div>
          )}
          
          {/* Playlist Results */}
          {playlist && !loading && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-bold text-lg">{playlist.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{playlist.description}</p>
                <p className="text-sm mt-2">🎵 {playlist.tracks?.length || 0} songs</p>
                
                {playlist.syncedToSpotify && playlist.spotifyUrl && (
                  <a 
                    href={playlist.spotifyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 mt-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Spotify</span>
                  </a>
                )}
                
                {!playlist.syncedToSpotify && (
                  <button
                    onClick={() => {
                      setSyncToSpotify(true);
                      generatePlaylist(playlistType === 'Smart Mix' ? 'smart' : 'mood', playlistType?.toLowerCase().replace(' vibes', ''));
                    }}
                    className="inline-flex items-center space-x-2 mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Save to Spotify</span>
                  </button>
                )}
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {playlist.tracks?.map((track, idx) => (
                  <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {track.image && <img src={track.image} alt="" className="w-10 h-10 rounded-lg" />}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{track.name}</p>
                      <p className="text-xs text-gray-500">{track.artist}</p>
                      {track.reason && <p className="text-xs text-green-500">{track.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistModal;
