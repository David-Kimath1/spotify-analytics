const express = require('express');
const router = express.Router();
const querystring = require('querystring');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPE = 'user-read-private user-read-email user-read-recently-played user-top-read user-read-currently-playing playlist-modify-public playlist-modify-private';

router.get('/login', (req, res) => {
  const state = Math.random().toString(36).substring(7);
  const params = {
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: SCOPE,
    redirect_uri: `${process.env.CLIENT_URL}/auth/callback`,
    state: state
  };
  
  const authUrl = `${SPOTIFY_AUTH_URL}?${querystring.stringify(params)}`;
  res.json({ url: authUrl });
});

router.post('/callback', async (req, res) => {
  const { code } = req.body;
  
  try {
    const tokenResponse = await axios.post(SPOTIFY_TOKEN_URL, 
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.CLIENT_URL}/auth/callback`,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    const spotifyUser = userResponse.data;
    
    let user = await User.findOne({ spotifyId: spotifyUser.id });
    
    if (!user) {
      user = new User({
        spotifyId: spotifyUser.id,
        email: spotifyUser.email,
        displayName: spotifyUser.display_name,
        profileImage: spotifyUser.images[0]?.url,
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
      });
    } else {
      user.spotifyAccessToken = access_token;
      user.spotifyRefreshToken = refresh_token;
      user.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
      if (spotifyUser.display_name) user.displayName = spotifyUser.display_name;
      if (spotifyUser.images[0]?.url) user.profileImage = spotifyUser.images[0].url;
    }
    
    await user.save();
    
    const jwtToken = jwt.sign(
      { userId: user._id, spotifyId: user.spotifyId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token: jwtToken, user: { id: user._id, displayName: user.displayName, profileImage: user.profileImage } });
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ valid: false });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ valid: false });
    }
    res.json({ valid: true, user: { id: user._id, displayName: user.displayName, profileImage: user.profileImage } });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
