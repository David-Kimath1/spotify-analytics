const ListeningActivity = require('../models/ListeningActivity');
const spotifyService = require('./spotifyService');

class PlaylistService {
  async generateSmartPlaylist(userId, limit = 30, syncToSpotify = false) {
    try {
      console.log('🎯 Starting smart playlist generation for user:', userId);
      
      // 1. Get user's top tracks from listening history
      const topTracks = await ListeningActivity.aggregate([
        { $match: { userId: userId } },
        { $group: { 
          _id: '$trackId', 
          trackName: { $first: '$trackName' },
          artistName: { $first: '$artistName' },
          playCount: { $sum: 1 },
          albumImage: { $first: '$albumImage' }
        }},
        { $sort: { playCount: -1 } },
        { $limit: 10 }
      ]);
      
      console.log(`📊 Found ${topTracks.length} top tracks`);
      
      const topTrackIds = topTracks.map(t => t._id).filter(id => id);
      let recommendations = [];
      
      if (topTrackIds.length > 0) {
        const seedTracks = topTrackIds.slice(0, 5);
        console.log('🎵 Using seed tracks:', seedTracks);
        
        try {
          const recoData = await spotifyService.getRecommendations(userId, {
            seed_tracks: seedTracks.join(','),
            limit: 20
          });
          recommendations = recoData.tracks || [];
          console.log(`🎧 Got ${recommendations.length} recommendations`);
        } catch (recoError) {
          console.error('Recommendation error:', recoError.response?.data || recoError.message);
        }
      }
      
      const playlistData = {
        name: `🎵 My Smart Mix - ${new Date().toLocaleDateString()}`,
        description: `Your top ${topTracks.length} most played tracks + ${recommendations.length} similar songs based on your taste`,
        tracks: [
          ...topTracks.map((t, idx) => ({
            id: t._id,
            name: t.trackName,
            artist: t.artistName,
            image: t.albumImage,
            uri: `spotify:track:${t._id}`,
            reason: `🎧 Your #${idx+1} most played track (${t.playCount} plays)`
          })),
          ...recommendations.map(r => ({
            id: r.id,
            name: r.name,
            artist: r.artists[0].name,
            image: r.album.images[0]?.url,
            uri: r.uri,
            reason: '🎯 Recommended based on your taste'
          }))
        ]
      };
      
      console.log(`📝 Playlist has ${playlistData.tracks.length} total tracks`);
      
      // Sync to Spotify if requested
      if (syncToSpotify) {
        console.log('🔄 Attempting to sync to Spotify...');
        try {
          // First, get user profile to verify token works
          const profile = await spotifyService.getUserProfile(userId);
          console.log('✅ User profile verified:', profile.display_name);
          
          // Create the playlist
          const spotifyPlaylist = await spotifyService.createPlaylist(
            userId, 
            playlistData.name, 
            playlistData.description,
            false
          );
          
          console.log('✅ Playlist created on Spotify:', spotifyPlaylist.id);
          
          // Get valid track URIs (filter out invalid ones)
          const trackUris = playlistData.tracks
            .map(t => t.uri)
            .filter(uri => uri && uri.startsWith('spotify:track:'));
          
          console.log(`📀 Adding ${trackUris.length} tracks to playlist`);
          
          if (trackUris.length > 0) {
            await spotifyService.addTracksToPlaylist(userId, spotifyPlaylist.id, trackUris);
            playlistData.spotifyUrl = spotifyPlaylist.external_urls.spotify;
            playlistData.syncedToSpotify = true;
            console.log('✅ Playlist sync complete!');
          } else {
            console.log('⚠️ No valid track URIs found');
          }
        } catch (syncError) {
          console.error('❌ Sync error details:', syncError.response?.data || syncError.message);
          playlistData.syncedToSpotify = false;
          playlistData.syncError = syncError.message;
        }
      }
      
      return playlistData;
    } catch (error) {
      console.error('Smart playlist error:', error);
      throw error;
    }
  }
  
  async generateMoodPlaylist(userId, mood = 'energetic', syncToSpotify = false) {
    const moodGenres = {
      energetic: ['pop', 'edm', 'dance', 'electro'],
      relaxed: ['chill', 'acoustic', 'ambient', 'lo-fi'],
      happy: ['happy', 'pop', 'indie', 'funk'],
      sad: ['sad', 'acoustic', 'piano', 'ballad'],
      focused: ['instrumental', 'classical', 'jazz', 'study']
    };
    
    const genres = moodGenres[mood] || moodGenres.energetic;
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];
    
    console.log(`🎭 Generating ${mood} mood playlist with genre: ${randomGenre}`);
    
    const recommendations = await spotifyService.getRecommendations(userId, {
      seed_genres: randomGenre,
      limit: 25
    });
    
    const playlistData = {
      name: `🎭 ${mood.charAt(0).toUpperCase() + mood.slice(1)} Vibes`,
      description: `Songs to match your ${mood} mood - ${randomGenre} genre`,
      tracks: (recommendations.tracks || []).map(r => ({
        id: r.id,
        name: r.name,
        artist: r.artists[0].name,
        image: r.album.images[0]?.url,
        uri: r.uri,
        reason: `🎭 Perfect for ${mood} moments`
      }))
    };
    
    if (syncToSpotify) {
      try {
        const spotifyPlaylist = await spotifyService.createPlaylist(
          userId, 
          playlistData.name, 
          playlistData.description,
          false
        );
        
        const trackUris = playlistData.tracks.map(t => t.uri).filter(uri => uri);
        if (trackUris.length > 0) {
          await spotifyService.addTracksToPlaylist(userId, spotifyPlaylist.id, trackUris);
          playlistData.spotifyUrl = spotifyPlaylist.external_urls.spotify;
          playlistData.syncedToSpotify = true;
        }
      } catch (error) {
        console.error('Mood playlist sync error:', error);
        playlistData.syncedToSpotify = false;
      }
    }
    
    return playlistData;
  }
}

module.exports = new PlaylistService();
