// User Service - Firebase Authentication and User Management
const { usersCollection, db } = require('../../firestore/firestore-config');
const { createUser, signInUser, signOutUser, resetPassword } = require('../../firestore/auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class UserService {
  async createUser(email, password, name) {
    // Validate input
    if (!email || !password || !name) {
      throw new Error('Email, password, and name are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if user exists
    const existingUser = await usersCollection.doc(email).get();
    if (existingUser.exists) {
      throw new Error('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Firebase Auth
    const userCredential = await createUser(email, password, name);

    // Save user to Firestore
    const userData = {
      id: userCredential.uid,
      email: email,
      name: name,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      language: 'en',
      preferences: {
        notifications: true,
        theme: 'system'
      },
      createdAt: new Date(),
      lastLogin: new Date(),
      isEmailVerified: false
    };

    await usersCollection.doc(userCredential.uid).set(userData);

    return {
      uid: userCredential.uid,
      email: email,
      name: name,
      avatar: userData.avatar,
      language: userData.language
    };
  }

  async signIn(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    try {
      const userCredential = await signInUser(email, password);
      const token = await userCredential.user.getIdToken();

      // Get user data from Firestore
      const userDoc = await usersCollection.doc(userCredential.uid).get();
      const userData = userDoc.data() || {};

      // Update last login
      await usersCollection.doc(userCredential.uid).update({
        lastLogin: new Date()
      });

      return {
        uid: userCredential.uid,
        email: userCredential.email,
        name: userData.name || userCredential.displayName || 'User',
        avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userCredential.email)}&background=random`,
        language: userData.language || 'en',
        token: token,
        isEmailVerified: userCredential.emailVerified
      };
    } catch (error) {
      if (error.code === 'auth-user-not-found') {
        throw new Error('Invalid email or password');
      }
      if (error.code === 'auth-wrong-password') {
        throw new Error('Invalid email or password');
      }
      throw error;
    }
  }

  async signOut(user) {
    await signOutUser(user);
  }

  async getUserProfile(userId) {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    return {
      uid: userId,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
      language: userData.language,
      preferences: userData.preferences || {},
      createdAt: userData.createdAt,
      lastLogin: userData.lastLogin,
      stats: userData.stats || {}
    };
  }

  async updateUserProfile(userId, updates) {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const mergedUpdates = { ...userData, ...updates };

    await usersCollection.doc(userId).update(mergedUpdates);

    return this.getUserProfile(userId);
  }

  async resetPassword(email, newPassword) {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    await resetPassword(email, newPassword);
  }

  async sendPasswordReset(email) {
    const user = await usersCollection.doc(email).get();
    if (!user.exists) {
      throw new Error('User not found');
    }

    const resetToken = await createResetToken(email);
    await sendResetEmail(email, resetToken);

    return { message: 'Password reset email sent' };
  }

  async createResetToken(email) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await usersCollection.doc(email).update({
      resetToken: token,
      resetTokenExpires: expiresAt
    });

    return token;
  }

  async validateResetToken(email, token) {
    const userDoc = await usersCollection.doc(email).get();
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();

    if (!userData.resetToken || !userData.resetTokenExpires) {
      return false;
    }

    if (userData.resetToken !== token) {
      return false;
    }

    if (new Date() > new Date(userData.resetTokenExpires)) {
      return false;
    }

    return true;
  }

  async resetPasswordWithToken(email, token, newPassword) {
    const isValid = await this.validateResetToken(email, token);
    if (!isValid) {
      throw new Error('Invalid or expired reset token');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    await resetPassword(email, newPassword);

    // Clear the reset token
    await usersCollection.doc(email).update({
      resetToken: null,
      resetTokenExpires: null
    });
  }

  async updateUserLanguage(userId, language) {
    await usersCollection.doc(userId).update({
      language: language
    });
  }

  async updateUserPreferences(userId, preferences) {
    await usersCollection.doc(userId).update({
      preferences: preferences
    });
  }

  async deleteUserAccount(userId) {
    await usersCollection.doc(userId).delete();
  }

  async getUserStats(userId) {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    return userData.stats || {};
  }

  async updateUserStats(userId, stats) {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const updatedStats = { ...(userData.stats || {}), ...stats };

    await usersCollection.doc(userId).update({
      stats: updatedStats
    });

    return updatedStats;
  }

  async getUserActivity(userId) {
    const activitySnapshot = await db.collection('user_activity')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return activitySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async logUserActivity(userId, activityType, metadata = {}) {
    const activityData = {
      userId: userId,
      type: activityType,
      metadata: metadata,
      createdAt: new Date(),
      device: metadata.device || 'web',
      ip: metadata.ip || 'unknown'
    };

    await db.collection('user_activity').add(activityData);

    return activityData;
  }
}

module.exports = new UserService();