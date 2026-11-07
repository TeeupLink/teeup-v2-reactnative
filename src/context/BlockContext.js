import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { moderationApi } from '@/lib/api/api';

// 차단한 사용자 목록을 앱 전역에서 공유한다.
// 목록·상세 화면은 useBlockedUsers().isBlocked(userId) 로 차단된 사용자의 콘텐츠를 숨긴다.
const BlockContext = createContext(null);

export function BlockProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setBlockedIds(new Set());
      setBlockedUsers([]);
      setIsLoaded(false);
      return;
    }
    try {
      const res = await moderationApi.getBlockedUsers();
      const ids = Array.isArray(res?.blocked_user_ids) ? res.blocked_user_ids : [];
      setBlockedIds(new Set(ids.map(Number)));
      setBlockedUsers(Array.isArray(res?.blocked_users) ? res.blocked_users : []);
    } catch {
      // 차단 목록 조회 실패는 앱 사용을 막지 않는다. 다음 조회 때 재시도.
    } finally {
      setIsLoaded(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const block = useCallback(async (userId) => {
    const id = Number(userId);
    await moderationApi.blockUser(id);
    setBlockedIds((prev) => new Set(prev).add(id));
    void refresh();
  }, [refresh]);

  const unblock = useCallback(async (userId) => {
    const id = Number(userId);
    await moderationApi.unblockUser(id);
    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setBlockedUsers((prev) => prev.filter((u) => Number(u.user_id) !== id));
  }, []);

  const isBlocked = useCallback(
    (userId) => userId != null && blockedIds.has(Number(userId)),
    [blockedIds],
  );

  const value = useMemo(
    () => ({ blockedIds, blockedUsers, isLoaded, isBlocked, block, unblock, refresh }),
    [blockedIds, blockedUsers, isLoaded, isBlocked, block, unblock, refresh],
  );

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlockedUsers() {
  const ctx = useContext(BlockContext);
  if (!ctx) {
    throw new Error('useBlockedUsers must be used within a BlockProvider.');
  }
  return ctx;
}

/** Provider 밖(테스트 등)에서도 안전하게 쓰기 위한 선택적 훅 */
export function useOptionalBlockedUsers() {
  return useContext(BlockContext);
}
