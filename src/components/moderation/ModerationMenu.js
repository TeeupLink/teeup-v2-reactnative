import { FontAwesome5 } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';

import ReportModal from '@/components/moderation/ReportModal';
import { useAuth } from '@/context/AuthContext';
import { useBlockedUsers } from '@/context/BlockContext';
import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

/**
 * 신고·차단 메뉴 (⋯ 버튼).
 *
 * - report: { targetType, targetId, targetName }  → 「신고하기」 항목
 * - blockUser: { userId, userName }               → 「사용자 차단」 항목 (본인이면 숨김)
 * - onBlocked: 차단 완료 후 콜백 (보통 화면 이탈)
 * - compact: true 면 아이콘만, false 면 「신고」 텍스트 버튼
 */
export default function ModerationMenu({ report, blockUser, onBlocked, compact = true, style }) {
  const { user } = useAuth();
  const { isBlocked, block, unblock } = useBlockedUsers();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const canBlock = blockUser?.userId != null && Number(blockUser.userId) !== Number(user?.id);
  const alreadyBlocked = canBlock && isBlocked(blockUser.userId);

  if (!report && !canBlock) return null;

  const handleBlock = () => {
    setMenuOpen(false);
    const name = blockUser?.userName ? `'${blockUser.userName}'님을` : '이 사용자를';
    Alert.alert(
      '사용자 차단',
      `${name} 차단하시겠습니까?\n\n차단하면 이 사용자가 작성한 클럽·모임·공지 등 콘텐츠가 더 이상 표시되지 않습니다. 마이페이지 > 회원정보 수정 > 차단 관리에서 해제할 수 있습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: async () => {
            try {
              await block(blockUser.userId);
              Alert.alert('차단 완료', '해당 사용자의 콘텐츠가 더 이상 표시되지 않습니다.');
              onBlocked?.();
            } catch (e) {
              Alert.alert('차단 실패', e?.message || '차단 처리 중 오류가 발생했습니다.');
            }
          },
        },
      ],
    );
  };

  const handleUnblock = () => {
    setMenuOpen(false);
    Alert.alert('차단 해제', '이 사용자의 차단을 해제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        onPress: async () => {
          try {
            await unblock(blockUser.userId);
          } catch (e) {
            Alert.alert('해제 실패', e?.message || '차단 해제 중 오류가 발생했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[compact ? styles.iconBtn : styles.textBtn, style]}
        accessibilityRole="button"
        accessibilityLabel="신고 및 차단 메뉴"
      >
        {compact ? (
          <FontAwesome5 name="ellipsis-h" size={16} color={colors.neutral[600]} />
        ) : (
          <>
            <FontAwesome5 name="flag" size={12} color={colors.neutral[600]} />
            <Text style={styles.textBtnLabel}>신고</Text>
          </>
        )}
      </Pressable>

      <RNModal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.sheet}>
            {report ? (
              <Pressable
                style={styles.item}
                onPress={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
              >
                <FontAwesome5 name="flag" size={14} color={colors.neutral[700]} />
                <Text style={styles.itemText}>신고하기</Text>
              </Pressable>
            ) : null}
            {canBlock ? (
              <Pressable style={styles.item} onPress={alreadyBlocked ? handleUnblock : handleBlock}>
                <FontAwesome5 name="user-slash" size={14} color={alreadyBlocked ? colors.neutral[700] : colors.error[600]} />
                <Text style={[styles.itemText, !alreadyBlocked && styles.itemTextDanger]}>
                  {alreadyBlocked ? '차단 해제' : '사용자 차단'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.item, styles.cancelItem]} onPress={() => setMenuOpen(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
          </View>
        </Pressable>
      </RNModal>

      {report ? (
        <ReportModal
          visible={reportOpen}
          targetType={report.targetType}
          targetId={report.targetId}
          targetName={report.targetName}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
  },
  textBtnLabel: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    paddingTop: tokens.padding.sm,
    paddingBottom: tokens.padding.xl,
    paddingHorizontal: tokens.padding.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.padding.sm,
    paddingVertical: tokens.padding.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  itemText: {
    fontSize: tokens.font.md,
    color: colors.neutral[900],
  },
  itemTextDanger: {
    color: colors.error[600],
  },
  cancelItem: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: tokens.padding.xs,
  },
  cancelText: {
    fontSize: tokens.font.md,
    color: colors.neutral[500],
  },
});
