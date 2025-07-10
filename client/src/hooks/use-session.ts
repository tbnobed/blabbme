import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UserSession {
  sessionId: string;
  roomId?: string;
  nickname?: string;
  lastActivity: Date;
}

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      
      // First try to get existing session
      try {
        const response = await apiRequest('/api/session/current');
        const data = await response.json();
        setSessionId(data.sessionId);
        setSession(data.session);
        setIsLoading(false);
        return;
      } catch (error) {
        // No existing session, create new one
      }
      
      // Create new session
      const response = await apiRequest('/api/session/create', {
        method: 'POST',
      });
      const data = await response.json();
      setSessionId(data.sessionId);
      setSession(data.session);
    } catch (error) {
      console.error('Failed to initialize session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSession = (roomId?: string, nickname?: string) => {
    if (session) {
      const updatedSession = {
        ...session,
        roomId,
        nickname,
        lastActivity: new Date(),
      };
      setSession(updatedSession);
    }
  };

  const clearSession = async () => {
    try {
      await apiRequest('/api/session/current', {
        method: 'DELETE',
      });
      setSessionId(null);
      setSession(null);
      await initializeSession();
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  return {
    sessionId,
    session,
    isLoading,
    updateSession,
    clearSession,
    initializeSession,
  };
}