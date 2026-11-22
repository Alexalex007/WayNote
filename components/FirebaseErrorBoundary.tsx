import React from 'react';
import { getStoredLanguage, tr } from '../shared/i18n';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class FirebaseErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  declare readonly props: Readonly<{ children: React.ReactNode }>;
  declare setState: (nextState: Partial<State>) => void;

  state: State = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    const lang = getStoredLanguage();
    return {
      hasError: true,
      errorMessage: error.message || tr(lang, '發生未預期錯誤', '发生未预期错误', 'An unexpected error occurred'),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Waynote Runtime Boundary:', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      const lang = getStoredLanguage();
      let friendlyHint = tr(
        lang,
        '應用程式遇到暫時性連線或資料存取錯誤，請重新整理或再次登入後再試。',
        '应用遇到暂时性连接或数据读取错误，请刷新或重新登录后重试。',
        'The app encountered a temporary connection or data error. Please refresh or sign in again.'
      );
      if (/quota exceeded|Free daily read units/i.test(this.state.errorMessage)) {
        friendlyHint = tr(
          lang,
          '雲端資料庫今日免費讀取額度已達上限，明天將自動重置，或可先使用本機與即時房間同步模式。',
          '云端数据库今日免费读取额度已达上限，明天将自动重置，或可先使用本地与实时房间同步模式。',
          'Daily free cloud read quota reached. It resets tomorrow; local & sync-code rooms remain available.'
        );
      } else if (/permission|PERMISSION_DENIED/i.test(this.state.errorMessage)) {
        friendlyHint = tr(
          lang,
          '雲端權限驗證已逾期或需要重新驗證身分，請重新登入帳號。',
          '云端权限验证已过期或需要重新验证身份，请重新登录账号。',
          'Cloud session permission expired. Please sign in again.'
        );
      }

      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
          <div className="max-w-md w-full rounded-3xl p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F26B3A]/15 text-[#F26B3A] flex items-center justify-center font-bold text-lg">
              !
            </div>
            <h2 className="text-lg font-bold">
              {tr(lang, '雲端同步暫時中斷', '云端同步暂时中断', 'Cloud Sync Interrupted')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{friendlyHint}</p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 h-11 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-zinc-100 text-xs font-semibold cursor-pointer"
              >
                {tr(lang, '返回頁面', '返回页面', 'Go Back')}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 h-11 rounded-full bg-[#F26B3A] text-white text-xs font-semibold cursor-pointer"
              >
                {tr(lang, '重新載入', '重新加载', 'Reload')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
