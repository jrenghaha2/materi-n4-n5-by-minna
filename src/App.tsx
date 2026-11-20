import { useMemo, useState } from 'react';
import { BookMarked, BookOpen, GraduationCap, Info, Layers } from 'lucide-react';
import { AbbreviationsView } from './components/AbbreviationsView';
import { AppHeader } from './components/AppHeader';
import { AuthModal } from './components/AuthModal';
import { BunpouListPanel } from './components/BunpouListPanel';
import { DailyProgressBar } from './components/DailyProgressBar';
import { FlashcardPanel } from './components/FlashcardPanel';
import { KotobaPanel } from './components/KotobaPanel';
import { MinnaBookMenu } from './components/MinnaBookMenu';
import { ProfileModal } from './components/ProfileModal';
import { QuizPanel } from './components/QuizPanel';
import { RestoreModal } from './components/RestoreModal';
import { Sidebar } from './components/Sidebar';
import { ToastBanner } from './components/ToastBanner';
import { getBookData, MINNA_BOOKS } from './data/minnaDataset';
import { getKotobaChapters } from './data/minnaKotobaData';
import { useAuthActions } from './hooks/useAuthActions';
import { useBackupRestore } from './hooks/useBackupRestore';
import { useCloudProgressSync } from './hooks/useCloudProgressSync';
import { useDailyTracker } from './hooks/useDailyTracker';
import { useFlashcardDeck } from './hooks/useFlashcardDeck';
import { useKotobaProgress } from './hooks/useKotobaProgress';
import { useQuizHistorySync } from './hooks/useQuizHistorySync';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useUserProfile } from './hooks/useUserProfile';
import type { ActiveTab, BookId, BunpouPattern, FilterMode } from './types/bunpou';
import {
  loadActiveBookId,
  loadBooleanSetting,
  saveActiveBookId,
  saveBooleanSetting,
  STORAGE_KEYS,
} from './utils/storage';

const TAB_ITEMS: { id: ActiveTab; label: string; icon: typeof Layers }[] = [
  { id: 'flashcard', label: 'Flashcard Bunpou', icon: Layers },
  { id: 'kotoba', label: 'Flashcard Kotoba', icon: BookMarked },
  { id: 'list', label: 'Daftar Bunpou', icon: BookOpen },
  { id: 'quiz', label: 'Kuis', icon: GraduationCap },
  { id: 'info', label: 'Singkatan & Info', icon: Info },
];

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const { toast, showToast, dismissToast } = useToast();

  const [activeBookId, setActiveBookId] = useState<BookId>(() => loadActiveBookId());
  const [activeTab, setActiveTab] = useState<ActiveTab>('flashcard');
  const [selectedChapter, setSelectedChapter] = useState<number | 'all'>('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [showFurigana, setShowFurigana] = useState<boolean>(() =>
    loadBooleanSetting(STORAGE_KEYS.furigana, true)
  );
  const [showTranslation, setShowTranslation] = useState<boolean>(() =>
    loadBooleanSetting(STORAGE_KEYS.translation, true)
  );

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authSwitchMode, setAuthSwitchMode] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const activeBook = getBookData(activeBookId);
  const activeKotobaChapters = getKotobaChapters(activeBookId);

  const daily = useDailyTracker();
  const kotoba = useKotobaProgress({
    onMasteredToggled: daily.recordMasteredChange,
  });

  const authActions = useAuthActions({ showToast });
  const userProfile = useUserProfile({
    user: authActions.user,
    isVerified: authActions.isVerified,
    showToast,
  });

  const progressSync = useCloudProgressSync({
    user: authActions.user,
    isVerified: authActions.isVerified,
    profileReady: userProfile.profileReady,
    onMasteredToggled: daily.recordMasteredChange,
    showToast,
  });

  const quizSync = useQuizHistorySync({
    user: authActions.user,
    isVerified: authActions.isVerified,
    profileReady: userProfile.profileReady,
    showToast,
  });

  const backup = useBackupRestore({
    booksProgress: progressSync.booksProgress,
    quizHistory: quizSync.quizHistory,
    onApplyProgress: progressSync.applyRestoredProgress,
    onApplyQuizHistory: quizSync.applyRestoredQuizHistory,
    showToast,
  });

  const activeProgress = progressSync.booksProgress[activeBookId];
  const activeKotobaProgress = kotoba.kotobaProgress[activeBookId];

  const deck = useFlashcardDeck({
    bookId: activeBookId,
    allPatterns: activeBook.patterns,
    selectedChapter,
    filterMode,
    masteredSet: activeProgress.mastered,
    difficultSet: activeProgress.difficult,
  });

  const filteredListPatterns = useMemo(() => {
    return activeBook.patterns.filter(p => {
      if (selectedChapter !== 'all' && p.chapter !== selectedChapter) return false;
      if (filterMode === 'unmastered' && activeProgress.mastered.has(p.id)) return false;
      if (filterMode === 'difficult' && !activeProgress.difficult.has(p.id)) return false;
      return true;
    });
  }, [activeBook.patterns, selectedChapter, filterMode, activeProgress]);

  const handleSelectBook = (bookId: BookId) => {
    if (bookId === activeBookId) return;
    setActiveBookId(bookId);
    saveActiveBookId(bookId);
    setSelectedChapter('all');
    setFilterMode('all');
  };

  const handleToggleFurigana = () => {
    setShowFurigana(prev => {
      const next = !prev;
      saveBooleanSetting(STORAGE_KEYS.furigana, next);
      return next;
    });
  };

  const handleToggleTranslation = () => {
    setShowTranslation(prev => {
      const next = !prev;
      saveBooleanSetting(STORAGE_KEYS.translation, next);
      return next;
    });
  };

  const handleOpenInFlashcard = (pattern: BunpouPattern) => {
    setSelectedChapter(pattern.chapter);
    setFilterMode('all');
    setActiveTab('flashcard');
    setTimeout(() => {
      deck.jumpToPattern(pattern.id);
    }, 20);
  };

  const handleManualSync = () => {
    void progressSync.syncAllBooksWithCloud(false);
    void quizSync.syncQuizHistoryWithCloud();
  };

  const syncingAny = progressSync.syncingProgress || quizSync.syncingQuiz;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <AppHeader
        activeBook={activeBook}
        showFurigana={showFurigana}
        showTranslation={showTranslation}
        isDark={isDark}
        user={authActions.user}
        profile={userProfile.profile}
        isVerified={authActions.isVerified}
        authBusy={authActions.authBusy}
        syncing={syncingAny}
        onToggleFurigana={handleToggleFurigana}
        onToggleTranslation={handleToggleTranslation}
        onToggleTheme={toggleTheme}
        onToggleMobileSidebar={() => setMobileSidebarOpen(v => !v)}
        onOpenAuthModal={isSwitch => {
          setAuthSwitchMode(Boolean(isSwitch));
          setAuthModalOpen(true);
        }}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        onManualSync={handleManualSync}
        onResendVerification={() => void authActions.resendVerificationEmail()}
        onRefreshVerification={() => void authActions.refreshVerificationStatus()}
        onSignOut={() => void authActions.handleSignOut()}
        onExport={backup.handleExport}
        onTriggerImport={backup.handleTriggerImport}
      />

      <input
        ref={backup.fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Pilih file backup JSON"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void backup.handleFileSelected(file);
          e.target.value = '';
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 sm:py-5 space-y-4">
        {/* Book Separator Menu: N5 vs N4 */}
        <MinnaBookMenu
          books={MINNA_BOOKS}
          activeBookId={activeBookId}
          booksProgress={progressSync.booksProgress}
          onSelectBook={handleSelectBook}
        />

        {/* Interactive Daily Memorization Progress Tracker */}
        <DailyProgressBar
          dailyGoal={daily.dailyGoal}
          todayMasteredCount={daily.todayMasteredCount}
          todayQuizCount={daily.todayQuizCount}
          currentStreak={daily.currentStreak}
          recent7Days={daily.recent7Days}
          dailyPct={daily.dailyPct}
          goalMetToday={daily.goalMetToday}
          onChangeGoal={daily.setDailyGoal}
        />

        {/* Main Workspace: Sidebar + Tabbed Content */}
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <Sidebar
            book={activeBook}
            selectedChapter={selectedChapter}
            filterMode={filterMode}
            masteredSet={activeProgress.mastered}
            difficultSet={activeProgress.difficult}
            mobileOpen={mobileSidebarOpen}
            onSelectChapter={setSelectedChapter}
            onChangeFilter={setFilterMode}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />

          <div className="flex-1 min-w-0 w-full space-y-4">
            {/* Primary Navigation Tabs */}
            <nav
              aria-label="Mode belajar"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-2xs grid grid-cols-2 sm:grid-cols-5 gap-1"
            >
              {TAB_ITEMS.map(item => {
                const Icon = item.icon;
                const active = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    id={`tab-${item.id}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveTab(item.id)}
                    className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs sm:text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Tab Views */}
            {activeTab === 'flashcard' ? (
              <FlashcardPanel
                deck={deck.deck}
                currentCard={deck.currentCard}
                currentIndex={deck.currentIndex}
                isFlipped={deck.isFlipped}
                isShuffled={deck.isShuffled}
                showFurigana={showFurigana}
                showTranslation={showTranslation}
                masteredSet={activeProgress.mastered}
                difficultSet={activeProgress.difficult}
                onFlip={deck.flipCard}
                onPrev={deck.goPrev}
                onNext={deck.goNext}
                onToggleShuffle={deck.toggleShuffle}
                onToggleMastered={id => progressSync.toggleMastered(activeBookId, id)}
                onToggleDifficult={id => progressSync.toggleDifficult(activeBookId, id)}
                onResetFilters={() => {
                  setSelectedChapter('all');
                  setFilterMode('all');
                }}
              />
            ) : activeTab === 'kotoba' ? (
              <KotobaPanel
                book={activeBook}
                chapters={activeKotobaChapters}
                selectedChapter={selectedChapter}
                showFurigana={showFurigana}
                showTranslation={showTranslation}
                masteredSet={activeKotobaProgress.mastered}
                difficultSet={activeKotobaProgress.difficult}
                onToggleMastered={id => kotoba.toggleKotobaMastered(activeBookId, id)}
                onToggleDifficult={id => kotoba.toggleKotobaDifficult(activeBookId, id)}
                onResetChapter={() => setSelectedChapter('all')}
              />
            ) : activeTab === 'list' ? (
              <BunpouListPanel
                patterns={filteredListPatterns}
                showFurigana={showFurigana}
                showTranslation={showTranslation}
                masteredSet={activeProgress.mastered}
                difficultSet={activeProgress.difficult}
                onToggleMastered={id => progressSync.toggleMastered(activeBookId, id)}
                onToggleDifficult={id => progressSync.toggleDifficult(activeBookId, id)}
                onOpenInFlashcard={handleOpenInFlashcard}
              />
            ) : activeTab === 'quiz' ? (
              <QuizPanel
                book={activeBook}
                showFurigana={showFurigana}
                masteredSet={activeProgress.mastered}
                difficultSet={activeProgress.difficult}
                sessions={quizSync.quizHistory[activeBookId]}
                onCompleteSession={record => {
                  quizSync.recordQuizSession(record);
                  daily.recordQuizCompleted();
                }}
                onClearHistory={() => quizSync.clearBookQuizHistory(activeBookId)}
                onMarkPatternsDifficult={ids => {
                  progressSync.markPatternsDifficult(activeBookId, ids);
                  showToast(
                    `${ids.length} pola yang salah telah ditandai sebagai Sulit.`,
                    'success'
                  );
                }}
              />
            ) : (
              <AbbreviationsView
                booksProgress={progressSync.booksProgress}
                currentStreak={daily.currentStreak}
                todayMasteredCount={daily.todayMasteredCount}
                dailyGoal={daily.dailyGoal}
              />
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <AuthModal
        open={authModalOpen}
        isSwitchMode={authSwitchMode}
        busy={authActions.authBusy}
        onClose={() => setAuthModalOpen(false)}
        onGoogleLogin={authActions.signInWithGoogle}
        onGithubLogin={authActions.signInWithGithub}
        onEmailLogin={authActions.signInWithEmail}
        onEmailRegister={authActions.registerWithEmail}
        onPasswordReset={authActions.requestPasswordReset}
      />

      <ProfileModal
        open={profileModalOpen}
        initialName={
          userProfile.profile?.displayName ||
          authActions.user?.displayName ||
          authActions.user?.email?.split('@')[0] ||
          ''
        }
        initialAvatarUrl={userProfile.profile?.avatarUrl || ''}
        fallbackAuthPhoto={authActions.user?.photoURL || ''}
        saving={userProfile.savingProfile}
        onSave={userProfile.saveProfile}
        onClose={() => setProfileModalOpen(false)}
      />

      <RestoreModal
        pending={backup.pendingRestore}
        restoring={backup.restoring}
        onConfirm={mode => void backup.handleConfirmRestore(mode)}
        onCancel={backup.handleCancelRestore}
      />

      <ToastBanner toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
