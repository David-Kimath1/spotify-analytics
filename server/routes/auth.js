const express = require('express');
const router = express.Router();
const querystring = require('querystring');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPE = 'user-read-private user-read-email user-read-recently-played user-top-read user-read-currently-playing user-library-read playlist-modify-public playlist-modify-private';
const getClientUrl = () => (
  process.env.CLIENT_URL
  || process.env.RENDER_EXTERNAL_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || 'http://localhost:3000'
).replace(/\/+$/, '');

router.get('/login', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('spotify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth'
  });
  const params = {
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: SCOPE,
    redirect_uri: `${getClientUrl()}/auth/callback`,
    state: state
  };
  
  const authUrl = `${SPOTIFY_AUTH_URL}?${querystring.stringify(params)}`;
  res.redirect(authUrl);
});

router.post('/callback', async (req, res) => {
  const { code, state } = req.body;
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length >= 2));
  if (!code || !state || !cookies.spotify_oauth_state || state !== cookies.spotify_oauth_state) {
    return res.status(400).json({ error: 'Spotify authorization expired or could not be verified. Please reconnect.' });
  }
  res.clearCookie('spotify_oauth_state', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth' });
  
  try {
    const tokenResponse = await axios.post(SPOTIFY_TOKEN_URL, 
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${getClientUrl()}/auth/callback`,
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
      profileImage: spotifyUser.images?.[0]?.url,
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
      });
    } else {
      user.spotifyAccessToken = access_token;
      user.spotifyRefreshToken = refresh_token;
      user.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
      if (spotifyUser.display_name) user.displayName = spotifyUser.display_name;
      if (spotifyUser.images?.[0]?.url) user.profileImage = spotifyUser.images[0].url;
    }
    
    await user.save();
    
    const jwtToken = jwt.sign(
      { userId: user._id, spotifyId: user.spotifyId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token: jwtToken, user: { id: user._id, displayName: user.displayName, profileImage: user.profileImage } });
  } catch (error) {
    console.error('Spotify authentication failed:', error.response?.status || error.message);
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
