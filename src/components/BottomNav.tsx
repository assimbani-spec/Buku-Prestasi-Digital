import React from 'react';
import { Home, BookOpen, Award, User, PenTool, Bell, HeartPulse, TrendingUp } from 'lucide-react';

export type NavTab = 'home' | 'jurnal' | 'kesehatan' | 'poin' | 'ttd' | 'notifikasi' | 'profil' | 'laporan';

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  role: 'siswa' | 'orang_tua';
  unreadCount?: number;
}

interface TabItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  role,
  unreadCount = 0,
}) => {
  const tabs: TabItem[] = role === 'siswa'
    ? [
        { id: 'home', label: 'Beranda', icon: Home },
        { id: 'jurnal', label: 'Jurnal', icon: BookOpen },
        { id: 'kesehatan', label: 'Kesehatan', icon: HeartPulse },
        { id: 'poin', label: 'Poin', icon: Award },
        { id: 'profil', label: 'Profil', icon: User },
      ]
    : [
        { id: 'home', label: 'Beranda', icon: Home },
        { id: 'laporan', label: 'Laporan', icon: TrendingUp },
        { id: 'kesehatan', label: 'Kesehatan', icon: HeartPulse },
        { id: 'ttd', label: 'TTD', icon: PenTool },
        { id: 'notifikasi', label: 'Info', icon: Bell },
        { id: 'profil', label: 'Profil', icon: User },
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-3xl">
      <nav
        aria-label="Navigasi utama"
        className="flex items-stretch justify-around border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)]"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                isActive ? 'text-brand-800' : 'text-muted hover:text-brand-800'
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">
                    {tab.badge}
                  </span>
                )}
              </span>
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
