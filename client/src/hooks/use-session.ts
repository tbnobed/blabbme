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
        const response = await fetch('/api/session/current', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setSessionId(data.sessionId);
          setSession(data.session);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        // No existing session, create new one
      }
      
      // Create new session
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        setSession(data.session);
      } else {
        console.error('Failed to create session:', response.statusText);
      }
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
      await fetch('/api/session/current', {
        method: 'DELETE',
        credentials: 'include',
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