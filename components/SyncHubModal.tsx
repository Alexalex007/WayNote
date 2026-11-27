import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LiquidModal } from './LiquidPrimitives';
import { CopyMorphButton, SendPlaneButton } from './TactileButtons';
import { tactileAudio } from '../services/tactileAudio';
import { useI18n } from '../hooks/useI18n';
import type { SyncConnectionState, SyncDevice } from '../types';
import type { User } from 'firebase/auth';
import {
  WifiIcon,
  DevicePhoneMobileIcon,
  RefreshIcon,
  LinkIcon,
  CloudIcon,
  ChevronRightIcon,
} from './Icons';

interface SyncHubModalProps {
  open: boolean;
  onClose: () => void;
  syncId: string;
  syncStatus: SyncConnectionState;
  connectedDevices: SyncDevice[];
  lastSyncedAt: number | null;
  onJoinByCode: (code: string) => Promise<void>;
  onRegenerateCode: () => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  cloudUser?: User | null;
  onOpenAuthModal?: () => void;
  currentClientId?: string;
}

export const SyncHubModal: React.FC<SyncHubModalProps> = ({
  open,
  onClose,
  syncId,
  syncStatus,
  connectedDevices,
  lastSyncedAt,
  onJoinByCode,
  onRegenerateCode,
  onShowToast,
  cloudUser,
  onOpenAuthModal,
  currentClientId,
}) => {
  const { t, localeTag } = useI18n();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?sync=${encodeURIComponent(syncId)}`
      : '';

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      await onJoinByCode(joinCode);
      setJoinCode('');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('加入同步失敗', '加入同步失败', 'Failed to join sync');
      onShowToast(message, 'error');
    } finally {
      setJoining(false);
    }
  };

  const statusLabel =
    syncStatus === 'connected'
      ? t('即時同步已連線', '实时同步已连接', 'Live sync connected')
      : syncStatus === 'connecting' || syncStatus === 'reconnecting'
        ? t('正在連線...', '正在连接...', 'Connecting...')
        : syncStatus === 'offline'
          ? t('離線暫存（恢復連線後合併）', '离线缓存（恢复连接后合并）', 'Offline cache (merges when online)')
          : t('待命中', '待命中', 'Standby');

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-md"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <WifiIcon className="w-4 h-4" />
          </div>
          <span>{t('跨裝置同步', '跨设备同步', 'Cross-Device Sync')}</span>
        </div>
      }
    >
      <div className="overflow-y-auto no-scrollbar space-y-4 pr-0.5">
        {onOpenAuthModal && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuthModal();
            }}
            className="w-full p-3.5 rounded-2xl bg-[#F26B3A]/10 hover:bg-[#F26B3A]/15 border border-[#F26B3A]/20 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#F26B3A] text-white flex items-center justify-center shrink-0">
                <CloudIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {cloudUser
                    ? t(
                        `個人雲端帳號：${cloudUser.displayName || cloudUser.email}`,
                        `个人云端账号：${cloudUser.displayName || cloudUser.email}`,
                        `Cloud Account: ${cloudUser.displayName || cloudUser.email}`
                      )
                    : t('登入 Google / Apple 雲端帳號', '登录 Google / Apple 云端账号', 'Sign in with Google / Apple')}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {cloudUser
                    ? t('所有旅程已私人同步，他人無法檢視', '所有旅程已私人同步，他人无法查看', 'All trips synced privately across your devices')
                    : t('登入後無須代碼，自動跨裝置同步全部旅程', '登录后无需代码，自动跨设备同步全部旅程', 'Sync all trips automatically without codes')}
                </div>
              </div>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-[#F26B3A] shrink-0" />
          </button>
        )}

        {/* Connection & Devices */}
        <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-500'
                    : syncStatus === 'offline'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                }`}
              />
              <span>{statusLabel}</span>
            </div>
            {lastSyncedAt && (
              <span className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                {new Date(lastSyncedAt).toLocaleTimeString(localeTag, { hour12: false })}
              </span>
            )}
          </div>

          {connectedDevices.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {[...connectedDevices]
                .sort((a, b) => {
                  const aSelf = currentClientId && a.clientId === currentClientId ? 1 : 0;
                  const bSelf = currentClientId && b.clientId === currentClientId ? 1 : 0;
                  return bSelf - aSelf;
                })
                .map((dev) => {
                  const isSelf = Boolean(currentClientId && dev.clientId === currentClientId);
                  return (
                    <div
                      key={dev.clientId}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        isSelf
                          ? 'bg-[var(--tab-accent-soft)] border-[var(--tab-accent)]/40 text-zinc-900 dark:text-white font-semibold'
                          : 'bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border-zinc-200/70 dark:border-white/10'
                      }`}
                    >
                      {isSelf && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      <DevicePhoneMobileIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelf ? 'text-[var(--tab-accent)]' : 'text-blue-600 dark:text-blue-400'
                        }`}
                      />
                      <span>{dev.deviceName}</span>
                      {isSelf && (
                        <span className="text-[11px] text-[var(--tab-accent)] font-semibold whitespace-nowrap">
                          · {t('本裝置', '本设备', 'This Device')}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* QR Code + Sync Code */}
        <div className="p-5 rounded-3xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/70 dark:border-white/10 flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-zinc-200/80">
            <QRCodeSVG value={shareUrl} size={144} level="M" includeMargin={false} />
          </div>

          <div className="w-full space-y-1.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('掃描 QR Code 或輸入代碼即可雙向同步', '扫描二维码或输入代码即可双向同步', 'Scan QR code or enter code for live sync')}
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-num font-bold text-lg tracking-wide text-zinc-900 dark:text-white select-all">
                {syncId}
              </span>
              <CopyMorphButton
                size="sm"
                textToCopy={syncId}
                label={t('複製', '复制', 'Copy')}
                copiedLabel={t('已複製', '已复制', 'Copied')}
                onCopy={() => {
                  onShowToast(t('已複製同步碼', '已复制同步码', 'Sync code copied'), 'success');
                }}
                className="rounded-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full">
            <CopyMorphButton
              variant="accent"
              textToCopy={shareUrl}
              label={t('複製連結', '复制链接', 'Copy Link')}
              copiedLabel={t('已複製', '已复制', 'Copied')}
              icon={<LinkIcon className="w-4 h-4" />}
              onCopy={() => {
                onShowToast(t('已複製同步連結', '已复制同步链接', 'Sync link copied'), 'success');
              }}
              className="rounded-full"
            />
            <button
              type="button"
              onClick={() => {
                tactileAudio.playWhoosh(true);
                onRegenerateCode();
              }}
              className="min-h-[44px] px-3 rounded-full bg-zinc-200/70 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              <RefreshIcon className="w-4 h-4" />
              <span>{t('換新代碼', '换新代码', 'New Code')}</span>
            </button>
          </div>
        </div>

        {/* Join another Trip by Sync Code */}
        <form onSubmit={handleJoinSubmit} className="space-y-2">
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 block">
            {t('加入其他旅程', '加入其他旅程', 'Join Another Trip')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="SKY-XXXX-XXXX"
              className="flex-1 min-h-[44px] px-4 rounded-full bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/80 dark:border-white/10 font-num font-semibold text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--tab-accent)]/30"
            />
            <SendPlaneButton
              type="submit"
              disabled={!joinCode.trim() || joining}
              sending={joining}
              idleLabel={t('加入', '加入', 'Join')}
              sendingLabel={t('連線中', '连接中', 'Joining')}
              sentLabel={t('已加入', '已加入', 'Joined')}
              className="min-h-[44px] px-5 text-xs shrink-0"
            />
          </div>
        </form>
      </div>
    </LiquidModal>
  );
};
