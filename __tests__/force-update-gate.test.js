import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/lib/api/api', () => ({
  appApi: { getVersionPolicy: jest.fn() },
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.1',
}));

const { appApi } = require('@/lib/api/api');
const ForceUpdateGate = require('@/components/layout/ForceUpdateGate').default;

/**
 * 강제 업데이트 차단 화면.
 *
 * 제일 중요한 건 "안 막아야 할 때 안 막는 것"이다. 잘못 막으면 사용자는
 * 앱을 아예 못 쓰고, 우리는 그 기기를 원격으로 풀어 줄 수단이 없다.
 */
describe('ForceUpdateGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it('서버가 차단을 지시하면 안내를 띄운다', async () => {
    appApi.getVersionPolicy.mockResolvedValue({
      update_required: true,
      minimum_version: '1.0.2',
      latest_version: '1.0.2',
      store_url: 'market://details?id=com.pixencrew.teeup',
      store_web_url: 'https://play.google.com/store/apps/details?id=com.pixencrew.teeup',
      message: '',
    });

    render(<ForceUpdateGate />);

    await waitFor(() => {
      expect(screen.getByText('업데이트가 필요합니다')).toBeTruthy();
    });
  });

  it('차단 대상이 아니면 아무것도 그리지 않는다', async () => {
    appApi.getVersionPolicy.mockResolvedValue({
      update_required: false,
      minimum_version: '1.0.0',
      latest_version: '1.0.2',
    });

    render(<ForceUpdateGate />);

    await waitFor(() => expect(appApi.getVersionPolicy).toHaveBeenCalled());
    expect(screen.queryByText('업데이트가 필요합니다')).toBeNull();
  });

  it('조회가 실패하면 통과시킨다', async () => {
    // 서버가 죽었다고 앱을 못 쓰게 만들면 안 된다.
    appApi.getVersionPolicy.mockRejectedValue(new Error('Network request failed'));

    render(<ForceUpdateGate />);

    await waitFor(() => expect(appApi.getVersionPolicy).toHaveBeenCalled());
    expect(screen.queryByText('업데이트가 필요합니다')).toBeNull();
  });

  it('서버가 판정을 안 보내면 최소 버전으로 직접 비교한다', async () => {
    appApi.getVersionPolicy.mockResolvedValue({
      minimum_version: '1.0.2', // 설치 버전은 1.0.1 이므로 막혀야 한다
      latest_version: '1.0.2',
      store_url: 'market://details?id=com.pixencrew.teeup',
    });

    render(<ForceUpdateGate />);

    await waitFor(() => {
      expect(screen.getByText('업데이트가 필요합니다')).toBeTruthy();
    });
  });

  it('응답이 비어 있으면 통과시킨다', async () => {
    appApi.getVersionPolicy.mockResolvedValue(null);

    render(<ForceUpdateGate />);

    await waitFor(() => expect(appApi.getVersionPolicy).toHaveBeenCalled());
    expect(screen.queryByText('업데이트가 필요합니다')).toBeNull();
  });

  it('자기 플랫폼과 설치 버전을 서버에 함께 보낸다', async () => {
    appApi.getVersionPolicy.mockResolvedValue({ update_required: false });

    render(<ForceUpdateGate />);

    await waitFor(() => {
      expect(appApi.getVersionPolicy).toHaveBeenCalledWith({
        platform: expect.any(String),
        version: '1.0.1',
      });
    });
  });
});
