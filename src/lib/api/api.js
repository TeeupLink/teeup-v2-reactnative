import { Platform } from 'react-native';

import { tokenStorage } from '../tokenStorage';
import { getNativePushToken } from '../util/pushToken';

import { apiClient } from './apiClient';

const AUTH_PREFIX = '/auth';
const isWeb = Platform.OS === 'web';

/**
 * 서버는 API 요청 시 "access" 타입 토큰만 허용합니다.
 * id_token(Google 등)은 저장하지 않고, 반드시 access_token만 사용합니다.
 */
async function saveAuthData(authResponse) {
  const data = authResponse?.data ?? authResponse;
  const accessToken = data?.access_token ?? data?.accessToken;
  const refreshToken = data?.refresh_token ?? data?.refreshToken;
  const user = data?.user ?? authResponse?.user;

  if (!isWeb && (!accessToken || typeof accessToken !== 'string')) {
    throw new Error('액세스 토큰이 없습니다.');
  }

  if (!isWeb) {
    // id_token은 사용하지 않음(서버가 access 토큰만 허용)
    await tokenStorage.setTokens(accessToken, refreshToken);
  }
  if (user) {
    await tokenStorage.setUser(user);
  }

  return user;
}

function buildNotificationParams(params = {}) {
  const { filter, ...rest } = params;
  const queryParams = { ...rest };

  if (filter && filter !== 'all') {
    queryParams.status_filter = filter === 'unread' ? 'UNREAD' : 'READ';
  }

  return queryParams;
}

function buildClubStatusParams(params = {}) {
  const { status, status_filter: statusFilter, ...rest } = params;
  return {
    ...rest,
    ...(statusFilter ? { status_filter: statusFilter } : {}),
    ...(!statusFilter && status ? { status_filter: status } : {}),
  };
}

function buildMeetingListParams(params = {}) {
  const {
    page,
    limit,
    search,
    start_date: startDate,
    end_date: endDate,
    status_group: statusGroup,
    list_type: listType,
  } = params;

  return {
    ...(page ? { page } : {}),
    ...(limit ? { limit } : {}),
    ...(search ? { search } : {}),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
    ...(statusGroup ? { status_group: statusGroup } : {}),
    ...(listType ? { list_type: listType } : {}),
  };
}

async function syncPushToken({ enabled = true } = {}) {
  if (Platform.OS === 'web') {
    return null;
  }

  const pushToken = await getNativePushToken();
  if (!pushToken) {
    console.warn('푸시 토큰 동기화 스킵: 디바이스 토큰 없음');
    return null;
  }

  return apiClient.post(`${AUTH_PREFIX}/push-token`, {
    push_token: pushToken,
    token_type: 'FCM',
    enabled,
  });
}

async function refreshToken(refreshToken) {
  const response = isWeb
    ? await apiClient.post(`${AUTH_PREFIX}/refresh`, undefined, { auth: false })
    : await apiClient.post(`${AUTH_PREFIX}/refresh`, { refresh_token: refreshToken }, { auth: false });
  const data = response?.data ?? response;
  const accessToken = data?.access_token ?? data?.accessToken;
  const newRefreshToken = data?.refresh_token ?? data?.refreshToken;
  const user = data?.user ?? response?.user;
  if (!isWeb && accessToken) {
    await tokenStorage.setTokens(accessToken, newRefreshToken);
  }
  if (user) {
    await tokenStorage.setUser(user);
  }
  return response;
}

async function getCurrentUser() {
  return apiClient.get(`${AUTH_PREFIX}/me`, { auth: true, redirectOnAuthExpired: false });
}

async function checkNickname(nickname) {
  return apiClient.get(`${AUTH_PREFIX}/check-nickname`, { params: { nickname }, auth: false });
}

async function googleLogin(oauthData) {
  const response = await apiClient.post(`${AUTH_PREFIX}/oauth/google/callback`, oauthData, { auth: false });
  await saveAuthData(response);
  // 호출부에서 response.user 사용 시 대비 (서버가 data 안에 넣어줄 수 있음)
  const normalized = response?.data ?? response;
  return { ...response, user: response?.user ?? normalized?.user };
}

async function appleLogin(oauthData) {
  const response = await apiClient.post(`${AUTH_PREFIX}/oauth/apple/callback`, oauthData, { auth: false });
  await saveAuthData(response);
  const normalized = response?.data ?? response;
  return { ...response, user: response?.user ?? normalized?.user };
}

async function passwordLogin({ email, password }) {
  const response = await apiClient.post(
    `${AUTH_PREFIX}/login`,
    { email, password },
    { auth: false },
  );
  await saveAuthData(response);
  const normalized = response?.data ?? response;
  return { ...response, user: response?.user ?? normalized?.user };
}

async function logout() {
  const refreshToken = isWeb ? null : await tokenStorage.getRefreshToken();

  try {
    await syncPushToken({ enabled: false });
  } catch (error) {
    console.warn('로그아웃 토큰 전송 실패:', error?.message || error);
  }

  try {
    await apiClient.post(
      `${AUTH_PREFIX}/logout`,
      isWeb ? undefined : { refresh_token: refreshToken }
    );
  } catch (error) {
    console.warn('로그아웃 API 호출 실패:', error?.message || error);
  } finally {
    await tokenStorage.clearTokens();
    await tokenStorage.clearUser();
  }
}

async function deleteAccount() {
  return apiClient.delete('/auth/withdraw');
}

export const authApi = {
  refreshToken,
  getCurrentUser,
  checkNickname,
  googleLogin,
  appleLogin,
  passwordLogin,
  syncPushToken,
  logout,
  deleteAccount,
};

async function fetchMeetings(params) {
  return apiClient.get('/meetings/', { params: buildMeetingListParams(params) });
}

async function getRounds(params) {
  return fetchMeetings({ ...(params || {}), list_type: 'rounding' });
}

async function getRound(id) {
  return apiClient.get(`/rounds/${id}`);
}

async function getRoundScoreStats(id) {
  return apiClient.get(`/rounds/${id}/score-stats`);
}

async function createRound(data, config = {}) {
  return apiClient.post('/rounds/', data, config);
}

async function updateRound(id, data) {
  return apiClient.put(`/rounds/${id}`, data);
}

async function deleteRound(id) {
  return apiClient.delete(`/rounds/${id}`);
}

async function joinRound(id) {
  return apiClient.post(`/rounds/${id}/join`);
}

async function leaveRound(id) {
  return apiClient.delete(`/rounds/${id}/leave`);
}

async function cancelRound(id, reason) {
  return apiClient.post(`/meetings/${id}/cancel`, { reason });
}

async function getRoundParticipants(id) {
  return apiClient.get(`/rounds/${id}/participants`);
}

async function removeParticipant(roundId, participantId) {
  return apiClient.delete(`/rounds/${roundId}/participants/${participantId}`);
}

async function getRoundTeams(id) {
  return apiClient.get(`/rounds/${id}/teams`);
}

async function createTeam(roundId, data) {
  return apiClient.post(`/rounds/${roundId}/teams`, data);
}

async function deleteTeam(roundId, teamId) {
  return apiClient.delete(`/rounds/${roundId}/teams/${teamId}`);
}

async function updateRoundTeamsBulk(roundId, data) {
  return apiClient.put(`/rounds/${roundId}/teams`, data);
}

async function addTeamMember(roundId, teamId, memberData) {
  return apiClient.post(`/rounds/${roundId}/teams/${teamId}/members`, memberData);
}

async function removeTeamMember(roundId, teamId, memberId) {
  return apiClient.delete(`/rounds/${roundId}/teams/${teamId}/members/${memberId}`);
}

async function autoFormTeams(meetingId, data) {
  return apiClient.post(`/meetings/${meetingId}/teams/auto-formation`, data);
}

async function getTeamsByMeeting(meetingId) {
  return apiClient.get('/teams/', { params: { meeting_id: meetingId } });
}

async function createTeamByMeeting(meetingId, data) {
  return apiClient.post('/teams/', data, { params: { meeting_id: meetingId } });
}

async function updateTeam(teamId, data) {
  return apiClient.put(`/teams/${teamId}`, data);
}

async function deleteTeamByMeeting(teamId) {
  return apiClient.delete(`/teams/${teamId}`);
}

async function getParticipantScores(roundId, participantId, params) {
  return apiClient.get(`/rounds/${roundId}/participants/${participantId}/scores`, { params });
}

async function getParticipantScoreStats(roundId, participantId) {
  return apiClient.get(`/rounds/${roundId}/participants/${participantId}/scores/stats`);
}

async function createScore(roundId, participantId, data) {
  return apiClient.post(`/rounds/${roundId}/participants/${participantId}/scores`, data);
}

async function updateScore(roundId, participantId, scoreId, data) {
  return apiClient.put(
    `/rounds/${roundId}/participants/${participantId}/scores/${scoreId}`,
    data
  );
}

async function deleteScore(roundId, participantId, scoreId) {
  return apiClient.delete(
    `/rounds/${roundId}/participants/${participantId}/scores/${scoreId}`
  );
}

async function getRoundExpenses(id, params) {
  return apiClient.get(`/rounds/${id}/expenses`, { params });
}

async function createRoundExpense(roundId, data) {
  return apiClient.post(`/rounds/${roundId}/expenses`, data);
}

async function updateExpense(roundId, expenseId, data) {
  return apiClient.put(`/rounds/${roundId}/expenses/${expenseId}`, data);
}

async function deleteExpense(roundId, expenseId) {
  return apiClient.delete(`/rounds/${roundId}/expenses/${expenseId}`);
}

async function sendMeetingNotification(meetingId, data) {
  return apiClient.post(`/rounds/${meetingId}/notifications`, data);
}

async function sendMeetingReminder(meetingId) {
  return apiClient.post(`/rounds/${meetingId}/reminder`);
}

async function getNotifications(params) {
  return apiClient.get('/users/notifications', { params });
}

async function markNotificationAsRead(notificationId) {
  return apiClient.put(`/users/notifications/${notificationId}/read`);
}

async function markAllNotificationsAsRead() {
  return apiClient.put('/users/notifications/read-all');
}

async function applyToMeeting(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/apply`);
}

async function closeApplicationEarly(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/close-application`);
}

async function getApplicationStatus(meetingId) {
  return apiClient.get(`/meetings/${meetingId}/application-status`);
}

async function startTeamFormation(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/start-team-formation`);
}

async function confirmTeamFormation(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/teams/confirm`);
}

async function startRounding(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/start-rounding`);
}

async function completeRounding(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/complete-rounding`);
}

async function submitSimpleScore(meetingId, participantId, data) {
  return apiClient.post(`/meetings/${meetingId}/participants/${participantId}/simple-score`, data);
}

async function updateSimpleScore(meetingId, participantId, data) {
  return apiClient.put(`/meetings/${meetingId}/participants/${participantId}/simple-score`, data);
}

async function confirmTeamMember(meetingId, teamId, memberId) {
  return apiClient.post(`/meetings/${meetingId}/teams/${teamId}/members/${memberId}/confirm`);
}

async function completeMeeting(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/complete`);
}

async function confirmSettlement(meetingId) {
  return apiClient.post(`/meetings/${meetingId}/settlement/confirm`);
}

async function createRoundingSettlement(meetingId, data) {
  return apiClient.post(`/meetings/${meetingId}/settlement/rounding`, data);
}

async function updateRoundingSettlement(meetingId, data) {
  return apiClient.put(`/meetings/${meetingId}/settlement/rounding`, data);
}

async function getMySettlement(meetingId) {
  return apiClient.get(`/meetings/${meetingId}/settlement/my`);
}

async function createEventSettlement(meetingId, data) {
  return apiClient.post(`/meetings/${meetingId}/settlement/social`, data);
}

async function updateEventSettlement(meetingId, data) {
  return apiClient.put(`/meetings/${meetingId}/settlement/social`, data);
}

async function getMeetingSettlement(meetingId) {
  return apiClient.get(`/meetings/${meetingId}/settlement`);
}

async function getAvailableParticipants(meetingId) {
  return apiClient.get(`/meetings/${meetingId}/settlement/available-participants`);
}

async function markParticipantPaid(meetingId, expenseId, data) {
  return apiClient.patch(
    `/meetings/${meetingId}/expenses/${expenseId}/participants/mark-paid`,
    data
  );
}

async function addGuest(meetingId, guestData) {
  return apiClient.post(`/meetings/${meetingId}/guests`, guestData);
}

async function getGuests(meetingId) {
  return apiClient.get(`/meetings/${meetingId}/guests`);
}

export const roundsApi = {
  getRounds,
  getRound,
  getRoundScoreStats,
  createRound,
  updateRound,
  deleteRound,
  joinRound,
  leaveRound,
  cancelRound,
  getRoundParticipants,
  removeParticipant,
  getRoundTeams,
  createTeam,
  deleteTeam,
  updateRoundTeamsBulk,
  addTeamMember,
  removeTeamMember,
  autoFormTeams,
  getTeamsByMeeting,
  createTeamByMeeting,
  updateTeam,
  deleteTeamByMeeting,
  getParticipantScores,
  getParticipantScoreStats,
  createScore,
  updateScore,
  deleteScore,
  getRoundExpenses,
  createRoundExpense,
  updateExpense,
  deleteExpense,
  sendMeetingNotification,
  sendMeetingReminder,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  applyToMeeting,
  closeApplicationEarly,
  getApplicationStatus,
  startTeamFormation,
  confirmTeamFormation,
  startRounding,
  completeRounding,
  submitSimpleScore,
  updateSimpleScore,
  confirmTeamMember,
  completeMeeting,
  confirmSettlement,
  createRoundingSettlement,
  updateRoundingSettlement,
  getMySettlement,
  createEventSettlement,
  updateEventSettlement,
  getMeetingSettlement,
  getAvailableParticipants,
  markParticipantPaid,
  addGuest,
  getGuests,
};

async function createSocial(data, config = {}) {
  return apiClient.post('/socials/', data, config);
}

async function getSocials(params) {
  return fetchMeetings({ ...(params || {}), list_type: 'social' });
}

async function getSocial(id) {
  return apiClient.get(`/socials/${id}`);
}

async function updateSocial(id, data) {
  return apiClient.put(`/socials/${id}`, data);
}

async function deleteSocial(id) {
  return apiClient.delete(`/socials/${id}`);
}

async function joinSocial(id) {
  return apiClient.post(`/socials/${id}/join`, {});
}

async function leaveSocial(id) {
  return apiClient.delete(`/socials/${id}/leave`);
}

async function cancelSocial(id, reason) {
  return apiClient.post(`/socials/${id}/cancel`, { reason });
}

async function fetchSocialParticipants(meetingId) {
  return apiClient.get(`/socials/${meetingId}/participants`);
}

export const socialsApi = {
  createSocial,
  getSocials,
  getSocial,
  updateSocial,
  deleteSocial,
  joinSocial,
  fetchSocialParticipants,
  leaveSocial,
  cancelSocial,
};

async function getUserNotifications(params = {}) {
  return apiClient.get('/users/notifications', { params: buildNotificationParams(params) });
}

async function markAsRead(notificationId) {
  return apiClient.put(`/users/notifications/${notificationId}/read`);
}

async function markAllAsRead() {
  return apiClient.put('/users/notifications/read-all');
}

async function deleteNotification(notificationId) {
  return apiClient.delete(`/users/notifications/${notificationId}`);
}

export const notificationsApi = {
  getNotifications: getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};

async function getMyProfile() {
  return apiClient.get('/users/profile');
}

async function updateMyProfile(data) {
  return apiClient.put('/users/me', data);
}

async function getUsers(params) {
  return apiClient.get('/users', { params });
}

async function getUser(id) {
  return apiClient.get(`/users/${id}`);
}

async function createUser(data) {
  return apiClient.post('/users', data);
}

async function updateUser(id, data) {
  return apiClient.put(`/users/${id}`, data);
}

async function deleteUser(id) {
  return apiClient.delete(`/users/${id}`);
}

async function getUserHandicap(id) {
  return apiClient.get(`/users/${id}/handicap`);
}

async function updateUserHandicap(id, data) {
  return apiClient.put(`/users/${id}/handicap`, data);
}

async function calculateHandicap(id) {
  return apiClient.get(`/users/handicap/calculate/${id}`);
}

async function getUserScoreHistory(id, limit = 10) {
  return apiClient.get(`/users/${id}/score-history`, { params: { limit } });
}

async function getLastMeetingResult(id) {
  return apiClient.get(`/users/${id}/last-meeting-result`);
}

async function getMyRoundingMeetings(params) {
  return apiClient.get('/users/me/rounding-meetings', { params });
}

async function getRoundingStats() {
  return apiClient.get('/users/me/rounding-stats');
}

async function getMyMeetings(params) {
  return apiClient.get('/users/my-meetings', { params });
}

async function getUserStats() {
  return apiClient.get('/users/stats');
}

export const usersApi = {
  getMyProfile,
  updateMyProfile,
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserHandicap,
  updateUserHandicap,
  calculateHandicap,
  getUserScoreHistory,
  getLastMeetingResult,
  getMyRoundingMeetings,
  getRoundingStats,
  getMyMeetings,
  getUserStats,
};

async function getTerms(type) {
  return apiClient.get(`/auth/terms/${type}`, { auth: false });
}

async function getNotices(params = {}) {
  return apiClient.get('/notices/', { params });
}

async function getNotice(id) {
  return apiClient.get(`/notices/${id}`);
}

export const noticesApi = {
  getNotices,
  getNotice,
};

async function getFaqs(params = {}) {
  return apiClient.get('/faq', { params });
}

async function getFaq(id) {
  return apiClient.get(`/faq/${id}`);
}

async function getCategories() {
  return apiClient.get('/faq-categories');
}

export const faqApi = {
  getFaqs,
  getFaq,
  getCategories,
};

async function getMyInquiries(params = {}) {
  return apiClient.get('/inquiries/', { params });
}

async function getInquiry(inquiryId) {
  return apiClient.get(`/inquiries/${inquiryId}`);
}

async function createInquiry(data) {
  return apiClient.post('/inquiries/', data);
}

async function getInquiryTypes() {
  return apiClient.get('/inquiries/types/');
}

export const inquiriesApi = {
  getMyInquiries,
  getInquiry,
  createInquiry,
  getInquiryTypes,
};

// ── 신고 / 차단 (App Store Guideline 1.2) ──────────────────────────────
// target_type: CLUB | MEETING | CLUB_NOTICE | REGULATION | USER
// reason:      SPAM | ABUSE | INAPPROPRIATE | FRAUD | PRIVACY | OTHER
async function reportContent({ targetType, targetId, reason, description }) {
  return apiClient.post('/moderation/reports', {
    target_type: targetType,
    target_id: targetId,
    reason,
    description: description || null,
  });
}

async function getBlockedUsers() {
  return apiClient.get('/moderation/blocks');
}

async function blockUser(userId) {
  return apiClient.post(`/moderation/blocks/${userId}`);
}

async function unblockUser(userId) {
  return apiClient.delete(`/moderation/blocks/${userId}`);
}

export const moderationApi = {
  reportContent,
  getBlockedUsers,
  blockUser,
  unblockUser,
};

async function getSidoList() {
  return apiClient.get('/sido-list', { auth: false });
}

async function getGunguList(sidoCode) {
  return apiClient.get('/gungu-list', {
    params: { sido_code: sidoCode },
    auth: false,
  });
}

export const regionApi = {
  getSidoList,
  getGunguList,
};

async function registerClubApplication(applicationData) {
  return apiClient.post('/clubs/register', applicationData);
}

async function createClub(data) {
  return apiClient.post('/clubs/', data);
}

async function updateClub(clubId, data) {
  return apiClient.put(`/clubs/${clubId}`, data);
}

async function deleteClub(clubId) {
  return apiClient.delete(`/clubs/${clubId}`);
}

async function getClubApplications(params = {}) {
  return apiClient.get('/clubs/applications', { params });
}

async function getMyClubApplications(params = {}) {
  return apiClient.get('/clubs/applications/my', { params });
}

async function getClubApplication(applicationId) {
  return apiClient.get(`/clubs/applications/${applicationId}`);
}

async function updateClubApplication(applicationId, data) {
  return apiClient.put(`/clubs/applications/${applicationId}`, data);
}

async function cancelClubApplication(applicationId) {
  return apiClient.put(`/clubs/applications/${applicationId}/cancel`, null);
}

async function getClubs(params = {}) {
  return apiClient.get('/clubs/', { params: buildClubStatusParams(params) });
}

async function getMyClubs(params = {}) {
  return apiClient.get('/clubs/my', { params: buildClubStatusParams(params) });
}

async function getClub(clubId) {
  return apiClient.get(`/clubs/${clubId}`);
}

async function getClubMembership(clubId) {
  return apiClient.get(`/clubs/${clubId}/membership`);
}

async function joinClub(clubId) {
  return apiClient.post(`/clubs/${clubId}/join`);
}

async function leaveClub(clubId) {
  return apiClient.delete(`/clubs/${clubId}/leave`);
}

async function getClubMembers(clubId, params = {}) {
  return apiClient.get(`/clubs/${clubId}/members`, { params });
}

async function getClubMemberRecordSummary(clubId, userId) {
  return apiClient.get(`/clubs/${clubId}/members/${userId}/record-summary`);
}

async function approveClubMembership(clubId, userId) {
  return apiClient.post(`/clubs/${clubId}/members/${userId}/approve`);
}

async function rejectClubMembership(clubId, userId) {
  return apiClient.post(`/clubs/${clubId}/members/${userId}/reject`);
}

async function searchClubMembersByName(params = {}) {
  return apiClient.get('/clubs/members/search', { params });
}

async function updateClubMemberRole(clubId, memberId, data) {
  return apiClient.put(`/clubs/${clubId}/members/${memberId}/role`, data);
}

async function removeClubMember(clubId, memberId) {
  return apiClient.delete(`/clubs/${clubId}/members/${memberId}`);
}

async function getClubNotices(clubId, params = {}) {
  return apiClient.get(`/clubs/${clubId}/notices`, { params });
}

async function getClubNotice(clubId, noticeId) {
  return apiClient.get(`/clubs/${clubId}/notices/${noticeId}`);
}

async function createClubNotice(clubId, data) {
  return apiClient.post(`/clubs/${clubId}/notices`, data);
}

async function updateClubNotice(clubId, noticeId, data) {
  return apiClient.put(`/clubs/${clubId}/notices/${noticeId}`, data);
}

async function deleteClubNotice(clubId, noticeId) {
  return apiClient.delete(`/clubs/${clubId}/notices/${noticeId}`);
}

async function getClubRegulations(clubId, params = {}) {
  // 백엔드: GET /regulations → { categories } / GET /regulations/list → { data }. 목록은 /list 사용.
  return apiClient.get(`/clubs/${clubId}/regulations/list`, { params });
}

async function getClubRegulationCategories(clubId) {
  return apiClient.get(`/clubs/${clubId}/regulations/categories`);
}

async function createClubRegulationCategory(clubId, data) {
  return apiClient.post(`/clubs/${clubId}/regulations/categories`, data);
}

async function updateClubRegulationCategory(clubId, categoryId, data) {
  return apiClient.put(`/clubs/${clubId}/regulations/categories/${categoryId}`, data);
}

async function deleteClubRegulationCategory(clubId, categoryId) {
  return apiClient.delete(`/clubs/${clubId}/regulations/categories/${categoryId}`);
}

async function getClubRegulation(clubId, regulationId) {
  return apiClient.get(`/clubs/${clubId}/regulations/${regulationId}`);
}

async function createClubRegulation(clubId, data) {
  return apiClient.post(`/clubs/${clubId}/regulations`, data);
}

async function updateClubRegulation(clubId, regulationId, data) {
  return apiClient.put(`/clubs/${clubId}/regulations/${regulationId}`, data);
}

async function deleteClubRegulation(clubId, regulationId) {
  return apiClient.delete(`/clubs/${clubId}/regulations/${regulationId}`);
}

async function getClubMeetings(clubId, params = {}) {
  return apiClient.get(`/clubs/${clubId}/meetings`, { params });
}

async function getClubFees(clubId, params = {}) {
  return apiClient.get(`/clubs/${clubId}/fees`, { params });
}

async function getClubFee(clubId, feeId) {
  return apiClient.get(`/clubs/${clubId}/fees/${feeId}`);
}

async function createClubFee(clubId, data) {
  return apiClient.post(`/clubs/${clubId}/fees`, data);
}

async function updateClubFee(clubId, feeId, data) {
  return apiClient.put(`/clubs/${clubId}/fees/${feeId}`, data);
}

async function deleteClubFee(clubId, feeId) {
  return apiClient.delete(`/clubs/${clubId}/fees/${feeId}`);
}

async function getClubActivities(clubId, params = {}) {
  return apiClient.get(`/clubs/${clubId}/activities`, { params });
}

async function createClubActivity(clubId, data) {
  return apiClient.post(`/clubs/${clubId}/activities`, data);
}

async function updateClubActivity(clubId, activityId, data) {
  return apiClient.put(`/clubs/${clubId}/activities/${activityId}`, data);
}

async function deleteClubActivity(clubId, activityId) {
  return apiClient.delete(`/clubs/${clubId}/activities/${activityId}`);
}

async function getClubStats(clubId, params = {}) {
  return apiClient.get(`/clubs/${clubId}/stats`, { params });
}

async function uploadClubFile(clubId, formData) {
  return apiClient.upload(`/clubs/${clubId}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export const clubsApi = {
  registerClubApplication,
  createClub,
  updateClub,
  deleteClub,
  getClubApplications,
  getMyClubApplications,
  getClubApplication,
  updateClubApplication,
  cancelClubApplication,
  getClubs,
  getMyClubs,
  getClub,
  getClubMembership,
  joinClub,
  leaveClub,
  getClubMembers,
  getClubMemberRecordSummary,
  approveClubMembership,
  rejectClubMembership,
  searchClubMembersByName,
  updateClubMemberRole,
  removeClubMember,
  getClubNotices,
  getClubNotice,
  createClubNotice,
  updateClubNotice,
  deleteClubNotice,
  getClubRegulations,
  getClubRegulationCategories,
  createClubRegulationCategory,
  updateClubRegulationCategory,
  deleteClubRegulationCategory,
  getClubRegulation,
  createClubRegulation,
  updateClubRegulation,
  deleteClubRegulation,
  getClubMeetings,
  getClubFees,
  getClubFee,
  createClubFee,
  updateClubFee,
  deleteClubFee,
  getClubActivities,
  createClubActivity,
  updateClubActivity,
  deleteClubActivity,
  getClubStats,
  uploadClubFile,
};

async function getActiveTerms() {
  const response = await apiClient.get('/terms/active/', { auth: false });
  const data = response;
  return data?.value || data || [];
}

async function getActiveTermsByType(type) {
  try {
    const response = await apiClient.get('/terms/active/', {
      params: { type_filter: type },
      auth: false,
    });
    const data = response;
    if (Array.isArray(data)) {
      return data;
    }
    return data?.value || [];
  } catch (error) {
    console.error(`약관 조회 실패 (${type}):`, error);
    return [];
  }
}

async function getActiveServiceTerms() {
  try {
    const terms = await getActiveTermsByType('TERMS_OF_SERVICE');
    return Array.isArray(terms) && terms.length > 0 ? terms[0] : null;
  } catch (error) {
    console.error('서비스이용약관 조회 실패:', error);
    return null;
  }
}

async function getActivePrivacyTerms() {
  try {
    const terms = await getActiveTermsByType('PRIVACY_POLICY');
    return Array.isArray(terms) && terms.length > 0 ? terms[0] : null;
  } catch (error) {
    console.error('개인정보처리방침 조회 실패:', error);
    return null;
  }
}

async function getActivePrivacyCollectionTerms() {
  try {
    const terms = await getActiveTermsByType('PRIVACY_COLLECTION');
    return Array.isArray(terms) && terms.length > 0 ? terms[0] : null;
  } catch (error) {
    console.error('개인정보 수집 및 활용동의 조회 실패:', error);
    return null;
  }
}

async function getActiveMarketingTerms() {
  try {
    const terms = await getActiveTermsByType('MARKETING_OPT_IN');
    return Array.isArray(terms) && terms.length > 0 ? terms[0] : null;
  } catch (error) {
    console.error('마케팅정보수신동의 조회 실패:', error);
    return null;
  }
}

function getDefaultTermsTitle(type) {
  const titles = {
    service: '서비스 이용약관',
    privacy: '개인정보처리방침',
    collection: '개인정보 수집 및 이용동의',
    marketing: '마케팅 정보 수신동의',
  };
  return titles[type] || '약관';
}

function getDefaultTermsContent(type) {
  const contents = {
    service: '서비스 이용약관 내용이 준비되지 않았습니다.',
    privacy: '개인정보처리방침 내용이 준비되지 않았습니다.',
    collection: '개인정보 수집 및 이용동의 내용이 준비되지 않았습니다.',
    marketing: '마케팅 정보 수신동의 내용이 준비되지 않았습니다.',
  };
  return contents[type] || '약관 내용이 준비되지 않았습니다.';
}

async function getActiveTermsByRequestType(type) {
  const typeMapping = {
    service: 'TERMS_OF_SERVICE',
    privacy: 'PRIVACY_POLICY',
    collection: 'PRIVACY_COLLECTION',
    marketing: 'MARKETING_OPT_IN',
  };

  const dbType = typeMapping[type] || type;
  return getActiveTermsByType(dbType);
}

async function getTermsByType(type) {
  try {
    const terms = await getActiveTermsByRequestType(type);

    if (Array.isArray(terms) && terms.length > 0) {
      return terms[0];
    }

    return {
      title: getDefaultTermsTitle(type),
      content: getDefaultTermsContent(type),
    };
  } catch (error) {
    console.error(`약관 조회 실패 (${type}):`, error);
    return {
      title: getDefaultTermsTitle(type),
      content: getDefaultTermsContent(type),
    };
  }
}

async function postAgreementsBulk(payload) {
  try {
    const response = await apiClient.post(
      '/terms/agreements/bulk',
      payload,
      {
        auth: true, // 약관 동의는 로그인 사용자 기준
      }
    );

    const data = response;

    // response_model 이 있는 경우를 고려
    if (data) {
      return data;
    }

    return null;
  } catch (error) {
    console.error('약관 일괄 동의 실패:', error);
    throw error; // 호출부에서 UX 처리하도록 throw
  }
}

export const termsApi = {
  getActiveTerms,
  getActiveTermsByType,
  getActiveServiceTerms,
  getActivePrivacyTerms,
  getActivePrivacyCollectionTerms,
  getActiveMarketingTerms,
  getTerms: getTermsByType,
  postAgreementsBulk
};

const fetchMyClubs = getMyClubs;
const fetchRounds = getRounds;
const fetchSocials = getSocials;
const fetchRound = getRound;
const updateRoundById = updateRound;
const fetchSocial = getSocial;
const updateSocialById = updateSocial;
const fetchRoundExpenses = getRoundExpenses;
const fetchRoundParticipants = getRoundParticipants;
const fetchRoundTeams = getRoundTeams;
const fetchApplicationStatus = getApplicationStatus;
const closeApplicationEarlyByMeeting = closeApplicationEarly;
const autoFormTeamsByMeeting = autoFormTeams;
const confirmTeamFormationByMeeting = confirmTeamFormation;
const startRoundingByMeeting = startRounding;
const completeRoundingByMeeting = completeRounding;
const confirmSettlementByMeeting = confirmSettlement;
const joinRoundByMeeting = joinRound;
const leaveRoundByMeeting = leaveRound;
const joinSocialByMeeting = joinSocial;
const leaveSocialByMeeting = leaveSocial;
const fetchMyProfile = getMyProfile;
const fetchUserHandicap = getUserHandicap;
const fetchMyMeetings = getMyMeetings;
const fetchMyRoundingMeetings = getMyRoundingMeetings;
const fetchRoundingStats = getRoundingStats;
const checkNicknameAvailability = checkNickname;

async function fetchMyParticipatingMeetings(params) {
  return fetchMeetings({ ...(params || {}), list_type: 'participating' });
}

export const meetingsApi = {
  fetchMyClubs,
  fetchRounds,
  fetchSocials,
  fetchRound,
  createRound,
  updateRound,
  updateRoundById,
  fetchSocial,
  createSocial,
  updateSocial,
  updateSocialById,
  fetchRoundExpenses,
  fetchRoundParticipants,
  fetchSocialParticipants,
  fetchRoundTeams,
  fetchApplicationStatus,
  closeApplicationEarly,
  closeApplicationEarlyByMeeting,
  autoFormTeams,
  autoFormTeamsByMeeting,
  confirmTeamFormation,
  confirmTeamFormationByMeeting,
  startRounding,
  startRoundingByMeeting,
  completeRounding,
  completeRoundingByMeeting,
  confirmSettlement,
  confirmSettlementByMeeting,
  joinRound,
  joinRoundByMeeting,
  leaveRound,
  leaveRoundByMeeting,
  joinSocial,
  joinSocialByMeeting,
  leaveSocial,
  leaveSocialByMeeting,
  fetchMyParticipatingMeetings,
};

export const mypageApi = {
  fetchMyClubs,
  fetchMyProfile,
  fetchUserHandicap,
  updateMyProfile,
  fetchMyMeetings,
  fetchMyRoundingMeetings,
  fetchRoundingStats,
  fetchRoundParticipants,
  checkNicknameAvailability,
  completeRounding,
  submitSimpleScore,
  updateSimpleScore,
};

export const clubApi = {
  getClubs,
  getMyClubs,
  getClub,
  createClub,
  updateClub,
  deleteClub,
  getClubApplications,
  getClubApplication,
  updateClubApplication,
  getClubMembership,
  getTerms,
};
