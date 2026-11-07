import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

const DRAG_OVERLAY_X_OFFSET = 70;
const DRAG_OVERLAY_Y_OFFSET = 20;
const AUTO_SCROLL_EDGE = 84;
const AUTO_SCROLL_STEP = 26;
const AUTO_SCROLL_INTERVAL = 48;

const getMemberIdentifier = (member) => String(member?.guest_id || member?.user_id || member?.id || '');

const getMemberComparisonKey = (member) => {
  const identifier = getMemberIdentifier(member);
  if (!identifier) return '';
  return member?.guest_id || member?.is_guest ? `guest:${identifier}` : `user:${identifier}`;
};

const getMemberDisplayName = (member) =>
  member?.user_name || member?.name || member?.guest_name || '멤버';

const getMemberGender = (member) => {
  const raw = member?.is_guest ? member?.guest_gender || member?.gender : member?.gender || member?.guest_gender;
  const normalized = String(raw || '').toUpperCase();
  if (normalized === 'MALE') return '남';
  if (normalized === 'FEMALE') return '여';
  return '';
};

const getMemberHandicap = (member) => {
  const raw = member?.is_guest
    ? member?.guest_handicap ?? member?.handicap_index ?? member?.handicap
    : member?.handicap_index ?? member?.handicap;
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

const getMemberRecentScore = (member) => {
  if (member?.is_guest) return null;
  const raw = member?.recent_avg_score;
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

const getTeamTotalHandicap = (team) =>
  (team?.members || []).reduce((sum, member) => sum + (getMemberHandicap(member) || 0), 0);

const buildTeams = (initialTeams) => {
  if (!Array.isArray(initialTeams)) return [];
  return initialTeams.map((team, index) => ({
    ...team,
    localKey: team?.id ? `team-${team.id}` : `team-local-${index}`,
    members: Array.isArray(team?.members || team?.team_members)
      ? [...(team.members || team.team_members)]
      : [],
    name: team?.name || team?.team_name || `팀 ${index + 1}`,
  }));
};

const buildParticipantPool = (participants, teams) => {
  const pool = new Map();

  (Array.isArray(participants) ? participants : []).forEach((participant) => {
    const key = getMemberComparisonKey(participant);
    if (!key) return;
    pool.set(key, participant);
  });

  (Array.isArray(teams) ? teams : []).forEach((team) => {
    (team?.members || []).forEach((member) => {
      const key = getMemberComparisonKey(member);
      if (!key) return;
      if (!pool.has(key)) {
        pool.set(key, member);
      }
    });
  });

  return [...pool.values()];
};

const buildMemberKeySet = (teams) => {
  const keys = new Set();
  (Array.isArray(teams) ? teams : []).forEach((team) => {
    (team?.members || []).forEach((member) => {
      const key = getMemberComparisonKey(member);
      if (key) keys.add(key);
    });
  });
  return keys;
};

const haveSameMembers = (leftMembers, rightMembers) => {
  const leftKeys = (Array.isArray(leftMembers) ? leftMembers : [])
    .map(getMemberComparisonKey)
    .filter(Boolean)
    .sort();
  const rightKeys = (Array.isArray(rightMembers) ? rightMembers : [])
    .map(getMemberComparisonKey)
    .filter(Boolean)
    .sort();

  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index]);
};

const hasTeamsChanged = (draftTeams, baselineTeams) => {
  if (draftTeams.length !== baselineTeams.length) return true;

  for (let index = 0; index < draftTeams.length; index += 1) {
    const draftTeam = draftTeams[index];
    const baselineTeam = baselineTeams[index];
    if (!baselineTeam) return true;
    if ((draftTeam?.name || '') !== (baselineTeam?.name || '')) return true;
    if (!haveSameMembers(draftTeam?.members, baselineTeam?.members)) return true;
  }

  return false;
};

function MemberCard({
  member,
  teamLocalKey,
  isMoving,
  processing,
  onStartMove,
  onCancelMove,
  onRemove,
}) {
  const gender = getMemberGender(member);
  const handicap = getMemberHandicap(member);
  const recentScore = getMemberRecentScore(member);
  const avatarStyle = member?.is_guest ? styles.memberAvatarGuest : styles.memberAvatarUser;

  return (
    <View style={[styles.memberCard, isMoving && styles.memberCardMoving]}>
      <View style={[styles.memberAvatar, avatarStyle]}>
        <FontAwesome5 name="user" size={14} color={colors.white} />
      </View>
      <View style={styles.memberBody}>
        <Text style={styles.memberPrimaryName}>{getMemberDisplayName(member)}</Text>
        <View style={styles.memberBadgeRow}>
          {member?.is_guest ? (
            <View style={[styles.memberBadge, styles.memberBadgeGuest]}>
              <Text style={[styles.memberBadgeText, styles.memberBadgeGuestText]}>게스트</Text>
            </View>
          ) : null}
          {gender ? (
            <View style={[styles.memberBadge, styles.memberBadgeBlue]}>
              <Text style={[styles.memberBadgeText, styles.memberBadgeBlueText]}>{gender}</Text>
            </View>
          ) : null}
          {handicap !== null ? (
            <View style={[styles.memberBadge, styles.memberBadgeGreen]}>
              <Text style={[styles.memberBadgeText, styles.memberBadgeGreenText]}>핸디: {handicap}</Text>
            </View>
          ) : null}
          {recentScore !== null ? (
            <View style={[styles.memberBadge, styles.memberBadgePurple]}>
              <Text style={[styles.memberBadgeText, styles.memberBadgePurpleText]}>
                직전대회: {recentScore}타
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.memberActions}>
        {!isMoving ? (
          <>
            <Pressable
              onPress={() => onStartMove(member, teamLocalKey)}
              disabled={processing}
              style={styles.memberActionButton}
            >
              <FontAwesome5 name="arrow-right" size={14} color={colors.info[700]} />
            </Pressable>
            <Pressable
              onPress={() => onRemove(teamLocalKey, getMemberComparisonKey(member))}
              disabled={processing}
              style={styles.memberActionButton}
            >
              <FontAwesome5 name="trash" size={13} color={colors.error[600]} />
            </Pressable>
          </>
        ) : (
          <View style={styles.memberMovingWrap}>
            <Text style={styles.memberMovingText}>이동 중</Text>
            <Pressable onPress={onCancelMove} style={styles.memberActionButton}>
              <FontAwesome5 name="times" size={13} color={colors.error[600]} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TeamEditorModal({
  isOpen,
  visible,
  onClose,
  teams: initialTeams,
  participants,
  onSave,
  processing,
}) {
  const isVisible = visible ?? isOpen;
  const [draftTeams, setDraftTeams] = useState([]);
  const [baselineTeams, setBaselineTeams] = useState([]);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState({ open: false, teamLocalKey: null });
  const [editingTeamKey, setEditingTeamKey] = useState(null);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [movingMember, setMovingMember] = useState(null);
  const [draggingParticipantKey, setDraggingParticipantKey] = useState(null);
  const [activeDropTeamKey, setActiveDropTeamKey] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const dropZoneRefs = useRef({});
  const scrollViewRef = useRef(null);
  const scrollHostRef = useRef(null);
  const nextTeamIndexRef = useRef(1);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const containerHeightRef = useRef(0);
  const scrollFrameRef = useRef(null);
  const autoScrollTimerRef = useRef(null);
  const autoScrollDirectionRef = useRef(0);

  const clearAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      globalThis.clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    autoScrollDirectionRef.current = 0;
  };

  const measureScrollFrame = () => {
    const target = scrollHostRef.current;
    if (!target || typeof target.measureInWindow !== 'function') return;
    target.measureInWindow((x, y, width, height) => {
      scrollFrameRef.current = { x, y, width, height };
    });
  };

  const startAutoScroll = (direction) => {
    if (!direction) {
      clearAutoScroll();
      return;
    }
    if (autoScrollDirectionRef.current === direction && autoScrollTimerRef.current) return;
    clearAutoScroll();
    autoScrollDirectionRef.current = direction;
    autoScrollTimerRef.current = globalThis.setInterval(() => {
      const maxOffset = Math.max(contentHeightRef.current - containerHeightRef.current, 0);
      const nextOffset = Math.max(
        0,
        Math.min(maxOffset, scrollOffsetRef.current + direction * AUTO_SCROLL_STEP),
      );
      if (nextOffset === scrollOffsetRef.current) return;
      scrollOffsetRef.current = nextOffset;
      scrollViewRef.current?.scrollTo({ y: nextOffset, animated: false });
    }, AUTO_SCROLL_INTERVAL);
  };

  const updateAutoScroll = (moveY) => {
    const frame = scrollFrameRef.current;
    if (!frame || !Number.isFinite(moveY)) {
      clearAutoScroll();
      return;
    }
    if (moveY <= frame.y + AUTO_SCROLL_EDGE) {
      startAutoScroll(-1);
      return;
    }
    if (moveY >= frame.y + frame.height - AUTO_SCROLL_EDGE) {
      startAutoScroll(1);
      return;
    }
    clearAutoScroll();
  };

  useEffect(() => () => clearAutoScroll(), []);

  useEffect(() => {
    if (!isVisible) return;
    const builtTeams = buildTeams(initialTeams);
    setDraftTeams(builtTeams);
    setBaselineTeams(builtTeams);
    setCloseConfirmOpen(false);
    setDeleteConfirmState({ open: false, teamLocalKey: null });
    setEditingTeamKey(null);
    setTeamNameInput('');
    setMovingMember(null);
    setDraggingParticipantKey(null);
    setActiveDropTeamKey(null);
    setDragOverlay(null);
    dropZoneRefs.current = {};
    nextTeamIndexRef.current = builtTeams.length + 1;
    scrollOffsetRef.current = 0;
    clearAutoScroll();
    setTimeout(() => {
      measureScrollFrame();
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);
  }, [initialTeams, isVisible]);

  const participantPool = useMemo(
    () => buildParticipantPool(participants, baselineTeams.length > 0 ? baselineTeams : draftTeams),
    [baselineTeams, draftTeams, participants],
  );

  const assignedMemberKeys = useMemo(() => buildMemberKeySet(draftTeams), [draftTeams]);

  const unassignedParticipants = useMemo(
    () =>
      participantPool.filter((participant) => !assignedMemberKeys.has(getMemberComparisonKey(participant))),
    [assignedMemberKeys, participantPool],
  );

  const hasChanges = useMemo(() => hasTeamsChanged(draftTeams, baselineTeams), [baselineTeams, draftTeams]);
  const canSave = hasChanges && unassignedParticipants.length === 0 && !processing;

  if (!isVisible) return null;

  const handleStartEditTeamName = (teamLocalKey, currentName) => {
    setEditingTeamKey(teamLocalKey);
    setTeamNameInput(currentName || '');
  };

  const handleCancelEditTeamName = () => {
    setEditingTeamKey(null);
    setTeamNameInput('');
  };

  const handleSaveTeamName = (teamLocalKey) => {
    const nextName = teamNameInput.trim();
    if (!nextName) {
      handleCancelEditTeamName();
      return;
    }
    setDraftTeams((prev) =>
      prev.map((team) => (team.localKey === teamLocalKey ? { ...team, name: nextName } : team)),
    );
    handleCancelEditTeamName();
  };

  const handleRequestDeleteTeam = (teamLocalKey) => {
    setDeleteConfirmState({ open: true, teamLocalKey });
  };

  const handleConfirmDeleteTeam = () => {
    const { teamLocalKey } = deleteConfirmState;
    if (!teamLocalKey) return;
    setDraftTeams((prev) => prev.filter((team) => team.localKey !== teamLocalKey));
    if (movingMember?.teamLocalKey === teamLocalKey) {
      setMovingMember(null);
    }
    setDeleteConfirmState({ open: false, teamLocalKey: null });
  };

  const handleRemoveMember = (teamLocalKey, memberKey) => {
    setDraftTeams((prev) =>
      prev.map((team) => {
        if (team.localKey !== teamLocalKey) return team;
        return {
          ...team,
          members: (team.members || []).filter((member) => getMemberComparisonKey(member) !== memberKey),
        };
      }),
    );
  };

  const handleAddTeam = () => {
    setDraftTeams((prev) => [
      ...prev,
      {
        localKey: `team-new-${nextTeamIndexRef.current}`,
        name: `팀 ${nextTeamIndexRef.current}`,
        members: [],
      },
    ]);
    nextTeamIndexRef.current += 1;
  };

  const assignParticipantToTeam = (participant, targetTeamLocalKey) => {
    const participantKey = getMemberComparisonKey(participant);
    if (!participantKey) return;

    setDraftTeams((prev) =>
      prev.map((team) => {
        const filteredMembers = (team.members || []).filter(
          (member) => getMemberComparisonKey(member) !== participantKey,
        );

        if (team.localKey !== targetTeamLocalKey) {
          return team.members?.length === filteredMembers.length ? team : { ...team, members: filteredMembers };
        }

        const duplicate = filteredMembers.some(
          (member) => getMemberComparisonKey(member) === participantKey,
        );
        if (duplicate) {
          return { ...team, members: filteredMembers };
        }

        return {
          ...team,
          members: [...filteredMembers, participant],
        };
      }),
    );
  };

  const handleAddParticipantToTeam = (participant, teamLocalKey) => {
    assignParticipantToTeam(participant, teamLocalKey);
  };

  const handleStartMoveMember = (member, teamLocalKey) => {
    setMovingMember({ member, teamLocalKey });
  };

  const handleCancelMoveMember = () => {
    setMovingMember(null);
  };

  const handleMoveMemberToTeam = (targetTeamLocalKey) => {
    if (!movingMember) return;
    assignParticipantToTeam(movingMember.member, targetTeamLocalKey);
    setMovingMember(null);
  };

  const measureDropZones = async () => {
    const measurements = await Promise.all(
      draftTeams.map(
        (team) =>
          new Promise((resolve) => {
            const target = dropZoneRefs.current[team.localKey];
            if (!target || typeof target.measureInWindow !== 'function') {
              resolve(null);
              return;
            }
            target.measureInWindow((x, y, width, height) => {
              resolve({ teamLocalKey: team.localKey, x, y, width, height });
            });
          }),
      ),
    );
    return measurements.filter(Boolean);
  };

  const updateActiveDropZone = async (moveX, moveY) => {
    if (!Number.isFinite(moveX) || !Number.isFinite(moveY)) {
      setActiveDropTeamKey(null);
      return;
    }

    const dropZones = await measureDropZones();
    const matchedZone = dropZones.find(
      (zone) =>
        moveX >= zone.x &&
        moveX <= zone.x + zone.width &&
        moveY >= zone.y &&
        moveY <= zone.y + zone.height,
    );
    setActiveDropTeamKey(matchedZone?.teamLocalKey || null);
  };

  const handleDropAttempt = async (participant, gestureState) => {
    const participantKey = getMemberComparisonKey(participant);
    if (!participantKey) return;

    clearAutoScroll();
    const targetTeamLocalKey = activeDropTeamKey;

    const moveX = Number(gestureState?.moveX);
    const moveY = Number(gestureState?.moveY);
    if (!Number.isFinite(moveX) || !Number.isFinite(moveY)) {
      setDraggingParticipantKey(null);
      setActiveDropTeamKey(null);
      setDragOverlay(null);
      return;
    }

    if (targetTeamLocalKey) {
      assignParticipantToTeam(participant, targetTeamLocalKey);
    } else {
      const dropZones = await measureDropZones();
      const matchedZone = dropZones.find(
        (zone) =>
          moveX >= zone.x &&
          moveX <= zone.x + zone.width &&
          moveY >= zone.y &&
          moveY <= zone.y + zone.height,
      );

      if (matchedZone) {
        assignParticipantToTeam(participant, matchedZone.teamLocalKey);
      }
    }

    setDraggingParticipantKey(null);
    setActiveDropTeamKey(null);
    setDragOverlay(null);
  };

  const handleRequestClose = () => {
    if (hasChanges) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose?.();
  };

  const handleSave = async () => {
    if (!onSave || !canSave) return;
    const saved = await onSave(draftTeams);
    if (!saved) return;

    const committedTeams = draftTeams.map((team) => ({
      ...team,
      members: [...(team.members || [])],
    }));
    setDraftTeams(committedTeams);
    setBaselineTeams(committedTeams);
    nextTeamIndexRef.current = committedTeams.length + 1;
    setMovingMember(null);
    setEditingTeamKey(null);
    setTeamNameInput('');
  };

  return (
    <>
      <Modal
        maxContentWidth={tokens.layout.teamEditorModalMaxPreferred}
        maxContentHeightVh={90}
        /* 확인 모달을 띄울 때는 이쪽을 내린다. iOS 는 모달 위에 모달을
           띄우면 아무 일도 일어나지 않는다. */
        visible={isVisible && !deleteConfirmState.open && !closeConfirmOpen}
        title="팀 편성 수정"
        onClose={handleRequestClose}
        scroll={false}
        bodyStyle={styles.modalBody}
        footer={(
          <View style={styles.footerRow}>
            <Button variant="outline" size="sm" style={styles.footerButton} onPress={handleRequestClose}>
              취소
            </Button>
            <Button
              size="sm"
              style={styles.footerButton}
              onPress={handleSave}
              loading={processing}
              disabled={!canSave}
            >
              저장
            </Button>
          </View>
        )}
      >
        <View style={styles.contentWrap}>
          <View style={styles.scrollHost} ref={scrollHostRef} onLayout={measureScrollFrame}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              onScroll={(event) => {
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              onContentSizeChange={(_, height) => {
                contentHeightRef.current = height;
              }}
              onLayout={(event) => {
                containerHeightRef.current = event.nativeEvent.layout.height;
                measureScrollFrame();
              }}
              scrollEventThrottle={16}
            >
              <Text style={styles.subtitle}>팀을 추가, 삭제하거나 멤버를 이동할 수 있습니다.</Text>

              <View style={styles.unassignedSection}>
                <View style={styles.unassignedHeader}>
                  <Text style={styles.unassignedTitle}>미할당 참가자 ({unassignedParticipants.length}명)</Text>
                </View>
                {unassignedParticipants.length ? (
                  <View style={styles.unassignedCardList}>
                    {unassignedParticipants.map((participant) => {
                      const participantKey = getMemberComparisonKey(participant);
                      const isDragging = draggingParticipantKey === participantKey;
                      const gender = getMemberGender(participant);
                      const handicap = getMemberHandicap(participant);
                      const panResponder = PanResponder.create({
                        onStartShouldSetPanResponder: () => !processing,
                        onMoveShouldSetPanResponder: () => !processing,
                        onPanResponderGrant: () => {
                          setDraggingParticipantKey(participantKey);
                          setDragOverlay(null);
                        },
                        onPanResponderMove: (_, gestureState) => {
                          setDragOverlay({
                            x: gestureState.moveX - DRAG_OVERLAY_X_OFFSET,
                            y: gestureState.moveY - DRAG_OVERLAY_Y_OFFSET,
                            label: getMemberDisplayName(participant),
                            isGuest: Boolean(participant?.is_guest),
                          });
                          updateAutoScroll(gestureState.moveY);
                          updateActiveDropZone(gestureState.moveX, gestureState.moveY);
                        },
                        onPanResponderRelease: (_, gestureState) => {
                          handleDropAttempt(participant, gestureState);
                        },
                        onPanResponderTerminate: (_, gestureState) => {
                          handleDropAttempt(participant, gestureState);
                        },
                      });

                      return (
                        <View key={participantKey} {...panResponder.panHandlers} style={styles.unassignedCardWrap}>
                          <View style={[styles.unassignedCard, isDragging && styles.unassignedCardDragging]}>
                            <View style={styles.memberGrip}>
                              <FontAwesome5 name="grip-lines-vertical" size={14} color={colors.neutral[400]} />
                            </View>
                            <View
                              style={[
                                styles.memberAvatar,
                                participant?.is_guest ? styles.memberAvatarGuest : styles.memberAvatarUnassigned,
                              ]}
                            >
                              <FontAwesome5 name="user" size={14} color={colors.white} />
                            </View>
                            <View style={styles.unassignedCardBody}>
                              <View style={styles.unassignedCardHeader}>
                                <Text style={styles.unassignedName}>{getMemberDisplayName(participant)}</Text>
                                {participant?.is_guest ? (
                                  <View style={[styles.memberBadge, styles.memberBadgeGuest]}>
                                    <Text style={[styles.memberBadgeText, styles.memberBadgeGuestText]}>게스트</Text>
                                  </View>
                                ) : null}
                              </View>
                              <View style={styles.memberBadgeRow}>
                                {gender ? (
                                  <View style={[styles.memberBadge, styles.memberBadgeBlue]}>
                                    <Text style={[styles.memberBadgeText, styles.memberBadgeBlueText]}>{gender}</Text>
                                  </View>
                                ) : null}
                                {handicap !== null ? (
                                  <View style={[styles.memberBadge, styles.memberBadgeGreen]}>
                                    <Text style={[styles.memberBadgeText, styles.memberBadgeGreenText]}>
                                      핸디: {handicap}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyUnassignedText}>미할당 참가자가 없습니다.</Text>
                )}
              </View>

              <View style={styles.teamList}>
                {draftTeams.map((team, index) => {
                  const teamTotalHandicap = getTeamTotalHandicap(team);
                  const isEditing = editingTeamKey === team.localKey;

                  return (
                    <View key={team.localKey} style={styles.teamCard}>
                      <View style={styles.teamHeader}>
                        <View style={styles.teamHeaderLeft}>
                          {isEditing ? (
                            <View style={styles.teamEditRow}>
                              <TextInput
                                value={teamNameInput}
                                onChangeText={setTeamNameInput}
                                style={styles.teamNameInput}
                                placeholder="팀 이름"
                                placeholderTextColor={colors.neutral[400]}
                                autoFocus
                              />
                              <Pressable onPress={() => handleSaveTeamName(team.localKey)} style={styles.headerIconButton}>
                                <FontAwesome5 name="check" size={14} color={colors.green[600]} />
                              </Pressable>
                              <Pressable onPress={handleCancelEditTeamName} style={styles.headerIconButton}>
                                <FontAwesome5 name="times" size={14} color={colors.error[600]} />
                              </Pressable>
                            </View>
                          ) : (
                            <View style={styles.teamTitleRow}>
                              <Text style={styles.teamTitle}>{team.name || `팀 ${index + 1}`}</Text>
                              <Pressable
                                onPress={() => handleStartEditTeamName(team.localKey, team.name)}
                                disabled={processing}
                                style={styles.headerIconButton}
                              >
                                <FontAwesome5 name="edit" size={14} color={colors.neutral[500]} />
                              </Pressable>
                            </View>
                          )}
                        </View>
                        <View style={styles.teamHeaderRight}>
                          <Text style={styles.teamMetaText}>{(team.members || []).length}명</Text>
                          {teamTotalHandicap > 0 ? (
                            <Text style={styles.teamMetaHighlight}>총 핸디: {teamTotalHandicap.toFixed(1)}</Text>
                          ) : null}
                          <Pressable
                            onPress={() => handleRequestDeleteTeam(team.localKey)}
                            disabled={processing}
                            style={styles.headerIconButton}
                          >
                            <FontAwesome5 name="trash" size={14} color={colors.error[600]} />
                          </Pressable>
                        </View>
                      </View>

                      <View
                        ref={(node) => {
                          dropZoneRefs.current[team.localKey] = node;
                        }}
                        style={[
                          styles.teamDropArea,
                          activeDropTeamKey === team.localKey
                            ? styles.teamDropAreaActive
                            : movingMember?.teamLocalKey && movingMember.teamLocalKey !== team.localKey
                            ? styles.teamDropAreaActive
                            : null,
                        ]}
                      >
                        {(team.members || []).length ? (
                          (team.members || []).map((member) => (
                            <MemberCard
                              key={getMemberComparisonKey(member)}
                              member={member}
                              teamLocalKey={team.localKey}
                              isMoving={
                                movingMember?.teamLocalKey === team.localKey &&
                                getMemberComparisonKey(movingMember.member) === getMemberComparisonKey(member)
                              }
                              processing={processing}
                              onStartMove={handleStartMoveMember}
                              onCancelMove={handleCancelMoveMember}
                              onRemove={handleRemoveMember}
                            />
                          ))
                        ) : (
                          <Text style={styles.emptyTeamText}>팀에 배정된 멤버가 없습니다.</Text>
                        )}

                        {unassignedParticipants.length > 0 ? (
                          <View style={styles.addParticipantsBox}>
                            <Text style={styles.addParticipantsTitle}>미할당 참가자 추가</Text>
                            <View style={styles.addParticipantsList}>
                              {unassignedParticipants.map((participant) => (
                                <Pressable
                                  key={`${team.localKey}-${getMemberComparisonKey(participant)}`}
                                  style={styles.addParticipantChip}
                                  onPress={() => handleAddParticipantToTeam(participant, team.localKey)}
                                  disabled={processing}
                                >
                                  <FontAwesome5 name="plus" size={10} color={colors.info[700]} />
                                  <Text style={styles.addParticipantChipText}>
                                    {getMemberDisplayName(participant)}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        ) : null}
                      </View>

                      {movingMember?.teamLocalKey && movingMember.teamLocalKey !== team.localKey ? (
                        <Pressable
                          onPress={() => handleMoveMemberToTeam(team.localKey)}
                          style={styles.moveHereButton}
                          disabled={processing}
                        >
                          <FontAwesome5 name="arrow-right" size={14} color={colors.white} />
                          <Text style={styles.moveHereButtonText}>여기로 이동</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <Pressable onPress={handleAddTeam} disabled={processing} style={styles.addTeamButton}>
                <FontAwesome5 name="plus" size={14} color={colors.neutral[600]} />
                <Text style={styles.addTeamButtonText}>새 팀 추가</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>

        {dragOverlay ? (
          <View
            pointerEvents="none"
            style={[
              styles.dragOverlay,
              {
                left: dragOverlay.x,
                top: dragOverlay.y,
              },
            ]}
          >
            <View style={[styles.memberAvatar, dragOverlay.isGuest ? styles.memberAvatarGuest : styles.memberAvatarUser]}>
              <FontAwesome5 name="user" size={14} color={colors.white} />
            </View>
            <Text style={styles.dragOverlayText}>{dragOverlay.label}</Text>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={deleteConfirmState.open}
        title="팀 삭제 확인"
        onClose={() => setDeleteConfirmState({ open: false, teamLocalKey: null })}
        scroll={false}
        footer={(
          <View style={styles.footerRow}>
            <Button
              variant="outline"
              size="sm"
              style={styles.footerButton}
              onPress={() => setDeleteConfirmState({ open: false, teamLocalKey: null })}
            >
              취소
            </Button>
            <Button size="sm" style={styles.footerButton} onPress={handleConfirmDeleteTeam}>
              삭제
            </Button>
          </View>
        )}
      >
        <Text style={styles.confirmText}>이 팀을 삭제하시겠습니까? 팀의 모든 멤버가 제거됩니다.</Text>
      </Modal>

      <Modal
        visible={closeConfirmOpen}
        title="변경사항이 저장되지 않았습니다"
        onClose={() => setCloseConfirmOpen(false)}
        scroll={false}
        footer={(
          <View style={styles.footerRow}>
            <Button variant="outline" size="sm" style={styles.footerButton} onPress={() => setCloseConfirmOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              style={styles.footerButton}
              onPress={() => {
                setCloseConfirmOpen(false);
                onClose?.();
              }}
            >
              닫기
            </Button>
          </View>
        )}
      >
        <Text style={styles.confirmText}>게스트 배치 등 변경사항이 있습니다. 저장하지 않고 닫으시겠습니까?</Text>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  contentWrap: {
    height: 560,
  },
  scrollHost: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.padding.md,
    paddingTop: tokens.padding.md,
    paddingBottom: tokens.padding.lg,
  },
  subtitle: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    marginBottom: tokens.spacing.sm2,
  },
  unassignedSection: {
    borderWidth: 1,
    borderColor: colors.warning[200],
    backgroundColor: colors.warning[50],
    borderRadius: tokens.radius.lg,
    padding: tokens.padding.sm,
    marginBottom: tokens.spacing.md,
  },
  unassignedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  unassignedTitle: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.warning[700],
  },
  emptyUnassignedText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
  },
  unassignedCardList: {
    gap: 8,
  },
  unassignedCardWrap: {
    width: '100%',
  },
  unassignedCard: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.warning[300],
    backgroundColor: colors.white,
    borderRadius: tokens.radius.md,
    padding: tokens.padding.sm,
  },
  unassignedCardDragging: {
    opacity: 0.45,
  },
  unassignedCardBody: {
    flex: 1,
    justifyContent: 'center',
  },
  unassignedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  unassignedName: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[900],
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.pill,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarUser: {
    backgroundColor: colors.primary[600],
  },
  memberAvatarGuest: {
    backgroundColor: colors.primary[600],
  },
  memberAvatarUnassigned: {
    backgroundColor: colors.primary[600],
  },
  teamList: {
    gap: 14,
  },
  teamCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: tokens.radius.lg,
    backgroundColor: colors.neutral[50],
    padding: tokens.padding.sm,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    gap: 10,
  },
  teamHeaderLeft: {
    flex: 1,
  },
  teamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamTitle: {
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[900],
  },
  teamEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.info[500],
    backgroundColor: colors.white,
    borderRadius: tokens.radius.base,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
    fontSize: tokens.font.sm,
    color: colors.neutral[900],
  },
  teamHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamMetaText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  teamMetaHighlight: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.medium,
    color: colors.info[700],
  },
  headerIconButton: {
    padding: 6,
  },
  teamDropArea: {
    minHeight: 72,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'transparent',
    borderRadius: tokens.radius.md,
    padding: tokens.padding.xs,
    gap: 8,
  },
  teamDropAreaActive: {
    borderColor: colors.info[500],
    backgroundColor: colors.info[50],
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.white,
    borderRadius: tokens.radius.md,
    padding: tokens.padding.sm,
  },
  memberCardMoving: {
    borderColor: colors.info[500],
    backgroundColor: colors.info[50],
  },
  memberGrip: {
    width: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberBody: {
    flex: 1,
  },
  memberPrimaryName: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[900],
    marginBottom: 6,
  },
  memberBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberBadge: {
    paddingHorizontal: tokens.padding.xs,
    paddingVertical: 4,
    borderRadius: tokens.radius.pill,
  },
  memberBadgeText: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.medium,
  },
  memberBadgeGuest: {
    backgroundColor: colors.warning[50],
  },
  memberBadgeGuestText: {
    color: colors.warning[700],
  },
  memberBadgeBlue: {
    backgroundColor: colors.info[50],
  },
  memberBadgeBlueText: {
    color: colors.info[700],
  },
  memberBadgeGreen: {
    backgroundColor: colors.success[50],
  },
  memberBadgeGreenText: {
    color: colors.success[700],
  },
  memberBadgePurple: {
    backgroundColor: '#F3E8FF',
  },
  memberBadgePurpleText: {
    color: colors.violet[600],
  },
  memberActions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  memberActionButton: {
    padding: 6,
  },
  memberMovingWrap: {
    alignItems: 'center',
    gap: 4,
  },
  memberMovingText: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.info[700],
  },
  emptyTeamText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    paddingVertical: tokens.padding.xs,
  },
  addParticipantsBox: {
    marginTop: tokens.spacing.xs2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.md,
    backgroundColor: colors.neutral[50],
    padding: tokens.padding.sm,
  },
  addParticipantsTitle: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.xs,
  },
  addParticipantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  addParticipantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: tokens.padding.xs,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: colors.info[100],
    backgroundColor: colors.white,
  },
  addParticipantChipText: {
    fontSize: tokens.font.xs,
    color: colors.info[700],
  },
  moveHereButton: {
    marginTop: tokens.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.info[600],
    borderRadius: tokens.radius.base,
    paddingVertical: tokens.padding.base,
  },
  moveHereButtonText: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.white,
  },
  addTeamButton: {
    marginTop: tokens.spacing.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.padding.baseLg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addTeamButtonText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    fontWeight: tokens.fontWeight.medium,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerButton: {
    flex: 1,
  },
  confirmText: {
    fontSize: tokens.font.base,
    color: colors.neutral[700],
    lineHeight: 22,
  },
  dragOverlay: {
    position: 'absolute',
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.info[500],
    backgroundColor: colors.info[50],
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
  },
  dragOverlayText: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[900],
  },
});
