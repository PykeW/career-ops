import { useEffect, useState } from 'react';

import { extractProfileSnapshot, fetchJson, getErrorMessage, type ProfileSnapshot } from '../lib/api';

interface UseProfileSnapshotResult {
  profile: ProfileSnapshot | null;
  profileLoading: boolean;
  profileError: string;
  suggestedRole: string;
}

export function useProfileSnapshot(): UseProfileSnapshotResult {
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      setProfileLoading(true);

      try {
        const payload = await fetchJson('profile');
        const snapshot = extractProfileSnapshot(payload);

        setProfile(snapshot);
        setProfileError('');
      } catch (error) {
        setProfile(null);
        setProfileError(
          getErrorMessage(
            error,
            'The UI still works without profile data. A snapshot will appear here once `/api/profile` is available.',
          ),
        );
      } finally {
        setProfileLoading(false);
      }
    }

    void loadProfile();
  }, []);

  return {
    profile,
    profileLoading,
    profileError,
    suggestedRole: profile?.targetRoles[0] || '',
  };
}
