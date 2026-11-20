import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { LiquidModal } from './LiquidPrimitives';
import type { CloudSyncState } from '../hooks/useCloudAccountSync';
import { AuthActionError, FIREBASE_AUTH_HANDLER_URL } from '../services/firebaseClient';
import {
  AppleLogoIcon,
  GoogleGIcon,
  CloudIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  RefreshIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from './Icons';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  cloudStatus: CloudSyncState;
  lastCloudSyncAt: number | null;
  cloudError: string | null;
  quotaUpgradeUrl: string | null;
  tripCount: number;
  onSignInGoogle: () => Promise<User>;
  onSignInApple: () => Promise<User>;
  onSignOut: () => Promise<void>;
  onForceSync: () => Promise<void>;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  user,
  cloudStatus,
  lastCloudSyncAt,
  cloudError,
  quotaUpgradeUrl,
  tripCount,
  onSignInGoogle,
  onSignInApple,
  onSignOut,
  onForceSync,
  onShowToast,
}) => {
  const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | 'sync' | 'signout' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAppleSetupGuide, setShowAppleSetupGuide] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  const handleGoogleLogin = async () => {
    setBusyProvider('google');
    setErrorMsg(null);
    setShowAppleSetupGuide(false);
    try {
      await onSignInGoogle();
      onClose();
    } catch (err) {
      if (err instanceof AuthActionError && err.code === 'auth/popup-closed-by-user') {
        setErrorMsg(null);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Google 登入失敗');
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const handleAppleLogin = async () => {
    setBusyProvider('apple');
    setErrorMsg(null);
    try {
      await onSignInApple();
      setShowAppleSetupGuide(false);
      onClose();
    } catch (err) {
      if (err instanceof AuthActionError) {
        if (err.code === 'auth/popup-closed-by-user') {
          setErrorMsg(null);
        } else if (err.needsAppleConsoleSetup) {
          setShowAppleSetupGuide(true);
          setErrorMsg(err.message);
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Apple 登入失敗');
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const handleCopyCallback = async () => {
    try {
      await navigator.clipboard.writeText(FIREBASE_AUTH_HANDLER_URL);
      setCopiedCallback(true);
      onShowToast('已複製認證回呼網址', 'success');
      setTimeout(() => setCopiedCallback(false), 1800);
    } catch {
      onShowToast('複製失敗，請手動選取', 'error');
    }
  };

  const handleManualSync = async () => {
    setBusyProvider('sync');
    try {
      await onForceSync();
    } catch {
      onShowToast('同步失敗，請檢查網路狀態', 'error');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSignOutClick = async () => {
    setBusyProvider('signout');
    try {
      await onSignOut();
      onClose();
    } finally {
      setBusyProvider(null);
    }
  };

  const primaryProviderId = user?.providerData?.[0]?.providerId;
  const providerLabel = primaryProviderId === 'apple.com' ? 'Apple 帳號' : 'Google 帳號';

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-md"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#F26B3A]/12 text-[#F26B3A] flex items-center justify-center">
            <CloudIcon className="w-4 h-4" />
          </div>
          <span>雲端帳號</span>
        </div>
      }
    >
      <div className="space-y-4 overflow-y-auto no-scrollbar pr-0.5 max-h-[76vh]">
        {user ? (
          <>
            {/* Signed-in Profile Card */}
            <div className="p-4 rounded-3xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 flex items-center gap-3.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || '使用者頭像'}
                  className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/60"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#F26B3A]/15 text-[#F26B3A] flex items-center justify-center shrink-0">
                  <UserCircleIcon className="w-7 h-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-base text-zinc-900 dark:text-white truncate">
                    {user.displayName || 'Waynote 旅人'}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200/80 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 shrink-0">
                    {providerLabel}
                  </span>
                </div>
                {user.email && (
                  <p className="text-xs font-num text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            {/* Cloud Status */}
            <div className="p-4 rounded-2xl bg-emerald-500/8 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheckIcon className="w-4 h-4 shrink-0" />
                  <span>
                    {cloudStatus === 'syncing'
                      ? '正在同步至個人雲端...'
                      : cloudStatus === 'error'
                        ? '雲端連線異常'
                        : `私人雲端已連線 · ${tripCount} 趟旅程`}
                  </span>
                </div>
                {lastCloudSyncAt && (
                  <span className="text-[11px] font-num text-emerald-700/75 dark:text-emerald-300/80">
                    {new Date(lastCloudSyncAt).toLocaleTimeString('zh-TW', { hour12: false })}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                所有行程與開支均加密隔離儲存於您的帳號下，跨裝置即時同步，他人無法檢視。
              </p>
            </div>

            {(cloudError || quotaUpgradeUrl) && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-700/40 text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
                <p>{cloudError}</p>
                {quotaUpgradeUrl && (
                  <a
                    href={quotaUpgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block underline font-semibold"
                  >
                    前往 Firebase Console 查看額度 →
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={busyProvider !== null}
                className="min-h-[46px] px-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshIcon className={`w-4 h-4 ${busyProvider === 'sync' ? 'animate-spin' : ''}`} />
                <span>立即同步</span>
              </button>
              <button
                type="button"
                onClick={handleSignOutClick}
                disabled={busyProvider !== null}
                className="min-h-[46px] px-4 rounded-full bg-zinc-100 dark:bg-white/10 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
              >
                登出帳號
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center space-y-1.5 py-1">
              <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                登入並瞬間同步所有旅程
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                支援 Apple 與 Google 帳號，個人資料僅限本人裝置存取
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Native Apple Sign-In Button */}
              <button
                type="button"
                onClick={handleAppleLogin}
                disabled={busyProvider !== null}
                className="w-full h-12 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2.5 active:scale-[0.985] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <AppleLogoIcon className="w-5 h-5" />
                <span>{busyProvider === 'apple' ? '正在連線 Apple...' : '透過 Apple 登入'}</span>
              </button>

              {/* Native Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={busyProvider !== null}
                className="w-full h-12 rounded-full bg-white dark:bg-white/[0.08] border border-zinc-200 dark:border-white/15 text-zinc-900 dark:text-white font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-zinc-50 dark:hover:bg-white/[0.12] active:scale-[0.985] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <GoogleGIcon className="w-4 h-4" />
                <span>{busyProvider === 'google' ? '正在連線 Google...' : '使用 Google 帳號登入'}</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-800/40 text-xs text-red-700 dark:text-red-300 leading-relaxed">
                {errorMsg}
              </div>
            )}

            {showAppleSetupGuide && (
              <div className="p-4 rounded-2xl bg-zinc-100/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 space-y-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="font-bold text-zinc-900 dark:text-white">
                  啟用「透過 Apple 登入」Console 設定指南
                </div>
                <ol className="space-y-1.5 list-decimal list-inside leading-relaxed text-[11px]">
                  <li>前往 Firebase Console → Authentication → Sign-in method，啟用 Apple。</li>
                  <li>於 Apple Developer 建立 Services ID，並填入下方回呼網址：</li>
                </ol>
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900/80 p-2 rounded-xl border border-zinc-200/70 dark:border-white/10">
                  <span className="font-num text-[10px] text-zinc-700 dark:text-zinc-300 truncate flex-1 select-all">
                    {FIREBASE_AUTH_HANDLER_URL}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCallback}
                    className="h-7 px-2.5 rounded-lg bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 font-semibold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedCallback ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <DocumentDuplicateIcon className="w-3.5 h-3.5" />}
                    <span>{copiedCallback ? '已複製' : '複製'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  設定前您可先直接點擊上方「使用 Google 帳號登入」，所有資料同步架構已完整就緒。
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </LiquidModal>
  );
};
