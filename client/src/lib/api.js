import axios from 'axios';

const defaultApiUrl = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api';
export const API_URL = process.env.REACT_APP_API_URL || defaultApiUrl;

const api = axios.create({ baseURL: API_URL, withCredentials: true });

export default api;
