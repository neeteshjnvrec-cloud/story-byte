// API Service Utility
// Handles HTTP requests with authentication and error handling

const axios = require('axios');

class ApiService {
  constructor() {
    this.baseURL = process.env.FIREBASE_FUNCTIONS_URL || '';
    this.apiKey = process.env.FIREBASE_API_KEY;
    this.createInstance();
  }

  createInstance() {
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Request interceptor for auth token
    this.instance.interceptors.request.use(
      (config) => {
        // Add Firebase ID token if available
        const token = localStorage.getItem('firebaseIdToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized error (token expired)
          localStorage.removeItem('firebaseIdToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get(url, params = {}) {
    try {
      const response = await this.instance.get(url, { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async post(url, data = {}) {
    try {
      const response = await this.instance.post(url, data);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async put(url, data = {}) {
    try {
      const response = await this.instance.put(url, data);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async delete(url, params = {}) {
    try {
      const response = await this.instance.delete(url, { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    console.error('API Error:', error);

    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.response?.status === 404) {
      throw new Error('Resource not found');
    } else if (error.response?.status === 500) {
      throw new Error('Internal server error');
    } else if (!error.response) {
      throw new Error('Network error');
    } else {
      throw new Error(error.response?.data?.message || 'An error occurred');
    }
  }
}

module.exports = new ApiService();