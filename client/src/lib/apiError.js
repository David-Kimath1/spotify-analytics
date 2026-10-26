export function getApiErrorMessage(error, fallback = 'We could not load this data.') {
  const status = error?.response?.status;
  if (!error?.response) return 'Sonora could not reach the API. Make sure the backend is running, then try again.';
  if (status === 401) return 'Your session needs to be reconnected. Open Settings and reconnect Spotify.';
  if (status === 403) return error.response.data?.error || 'This request was denied. Check the connection and access settings, then try again.';
  if (status === 429) return 'Spotify is rate limiting requests. Wait a moment, then try again.';
  if (status >= 500) return 'The analytics service is having trouble. Check the server and database, then try again.';
  return error.response.data?.error || fallback;
}
