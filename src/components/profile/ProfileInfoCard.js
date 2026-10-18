// Profile Info Card - Compressed display of profile details
import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { myAuthorName } from '../../utils/author';
import { Icon } from '../ui/Icon';

export const ProfileInfoCard = ({
  user,
  userStats,
  onEditPress,
  compact = false
}) => {
  const { theme } = useTheme() || { theme: {} };
  
  // Safety check for user data
  if (!user && !userStats) {
    return null;
  }
  
  // The name stories and comments are published under (the email's first name
  // when the profile has none).
  const name = myAuthorName(user, userStats) || 'You';
  const initial = (name[0] || 'U').toUpperCase();
  const phone = userStats?.phone || 'Not provided';
  const gender = userStats?.gender || 'Not specified';
  const age = userStats?.age ? `${userStats.age} years` : 'Not specified';
  const favoriteGenre = userStats?.favoriteGenre || 'Not set';
  const bio = userStats?.bio || '';
  const profilePic = userStats?.profilePic || userStats?.photoURL || user?.photoURL || null;

  // Format display values
  const displayPhone = phone === 'Not provided' ? '' : phone;
  const displayGender = gender === 'Not specified' ? '' : gender;
  const displayAge = age === 'Not specified' ? '' : age;
  const displayGenre = favoriteGenre === 'Not set' ? '' : favoriteGenre;

  // Count filled fields for completion
  const filledFields = [
    userStats?.fullName,
    userStats?.phone,
    userStats?.gender,
    userStats?.age,
    userStats?.favoriteGenre,
    userStats?.bio,
    userStats?.profilePic || userStats?.photoURL || user?.photoURL
  ].filter(Boolean).length;
  
  const totalFields = 7;
  const completionPercent = Math.round((filledFields / totalFields) * 100);

  if (compact) {
    // Compact single-line version
    return (
      <Pressable onPress={onEditPress} style={[styles.compactCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.compactAvatar}>
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={styles.compactAvatarImage} />
          ) : (
            <LinearGradient
              colors={[theme.gradientStart || '#B5613A', theme.gradientEnd || '#E0913A']}
              style={styles.compactAvatarImage}
            >
              <AppText variant="label" style={{ color: '#fff' }}>{initial}</AppText>
            </LinearGradient>
          )}
        </View>
        <View style={styles.compactInfo}>
          <AppText variant="bodySemi" numberOfLines={1}>{name}</AppText>
          {bio ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {bio}
            </AppText>
          ) : (
            <View style={styles.completionBadge}>
              <AppText variant="micro" color="textSecondary">
                Profile {completionPercent}% complete
              </AppText>
            </View>
          )}
        </View>
        <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
      </Pressable>
    );
  }

  // Full card version
  return (
    <Pressable onPress={onEditPress} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Header with avatar and name */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={[theme.gradientStart || '#B5613A', theme.gradientEnd || '#E0913A']}
              style={styles.avatar}
            >
              <AppText variant="displaySemi" style={{ color: '#fff' }}>{initial}</AppText>
            </LinearGradient>
          )}
        </View>
        
        <View style={styles.nameSection}>
          <AppText variant="h2">{name}</AppText>
          {user?.email && (
            <AppText variant="caption" color="textSecondary">{user.email}</AppText>
          )}
        </View>

        {/* Edit button */}
        <Pressable
          onPress={onEditPress}
          hitSlop={10}
          style={[styles.editBtn, { backgroundColor: theme.accentSoft }]}
        >
          <Icon name="edit" size={18} color={theme.accent} />
        </Pressable>
      </View>

      {/* Bio */}
      {bio ? (
        <AppText variant="body" color="textSecondary" style={styles.bio}>
          {bio}
        </AppText>
      ) : null}

      {/* Details grid */}
      <View style={styles.detailsGrid}>
        {displayPhone ? (
          <DetailItem icon="phone" label="Phone" value={displayPhone} theme={theme} />
        ) : null}
        {displayGender ? (
          <DetailItem icon="person" label="Gender" value={displayGender} theme={theme} />
        ) : null}
        {displayAge ? (
          <DetailItem icon="calendar" label="Age" value={displayAge} theme={theme} />
        ) : null}
        {displayGenre ? (
          <DetailItem icon="heart" label="Favorite" value={displayGenre} theme={theme} />
        ) : null}
      </View>

      {/* Completion indicator */}
      <View style={[styles.completion, { backgroundColor: theme.accentSoft }]}>
        <AppText variant="micro" color="accent">
          Profile {completionPercent}% complete
        </AppText>
        <View style={[styles.completionBar, { backgroundColor: theme.accent }]}>
          <View style={[styles.completionFill, { width: `${completionPercent}%` }]} />
        </View>
      </View>
    </Pressable>
  );
};

const DetailItem = ({ icon, label, value, theme }) => (
  <View style={styles.detailItem}>
    <View style={[styles.detailIcon, { backgroundColor: theme.accentSoft }]}>
      <Icon name={icon} size={14} color={theme.accent} />
    </View>
    <View style={styles.detailText}>
      <AppText variant="caption" color="textTertiary">{label}</AppText>
      <AppText variant="label" color="text" style={{ marginTop: 2 }}>
        {value}
      </AppText>
    </View>
  </View>
);

const styles = StyleSheet.create({
  // Compact version
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  compactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  compactAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInfo: {
    flex: 1,
  },
  completionBadge: {
    marginTop: 2,
  },
  
  // Full card version
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nameSection: {
    flex: 1,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: {
    marginTop: 12,
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexBasis: '48%',
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    flex: 1,
  },
  completion: {
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  completionBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
});

export default ProfileInfoCard;
