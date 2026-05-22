import React, { useState } from 'react';
import axios from 'axios';
import { Calendar, Clock, Music } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const TimeTravel = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/timetravel/date/${selectedDate}`);
      setHistory(response.data);
      toast.success(`Found ${response.data.tracks} tracks from ${selectedDate}`);
    } catch (error) {
      toast.error('No listening history found for this date');
      setHistory(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center space-x-2 mb-4">
        <Calendar className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-semibold">Time Travel</h3>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          max={new Date().toISOString().split('T')[0]}
        />
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Travel Back'}
        </button>
      </div>
      
      {history && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="font-semibold">{history.date}</p>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {history.tracks} tracks</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {history.minutes} minutes</span>
          </div>
          {history.activities.length > 0 && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {history.activities.map((activity, idx) => (
                <div key={idx} className="text-sm p-2 bg-white dark:bg-gray-600 rounded">
                  <p className="font-medium">{activity.trackName}</p>
                  <p className="text-xs text-gray-500">{activity.artistName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeTravel;
