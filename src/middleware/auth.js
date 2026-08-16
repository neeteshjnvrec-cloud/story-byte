// Middleware for Firebase authentication
const firebase = require('firebase-admin');

const firebaseConfig = {
  credential: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }
};

// Initialize Firebase Admin only once
let app = null;
try {
  app = firebase.initializeApp(firebaseConfig);
} catch (error) {
  // App already initialized
  app = firebase.app();
}

const auth = app.auth();

/**
 * Middleware to verify Firebase ID token
 */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    // Get the token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);

    // Attach user data to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      picture: decodedToken.picture,
      emailVerified: decodedToken.email_verified,
      iat: decodedToken.iat,
      exp: decodedToken.exp
    };

    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);

    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-token') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.code === 'auth/token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to verify optional Firebase token (for endpoints that work with or without auth)
 */
const verifyOptionalFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user data
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      picture: decodedToken.picture
    };
  } catch (error) {
    // Continue without authenticated user
    console.log('Optional auth failed:', error.message);
  }

  next();
};

module.exports = {
  verifyFirebaseToken,
  verifyOptionalFirebaseToken,
  auth,
  firebaseConfig
};