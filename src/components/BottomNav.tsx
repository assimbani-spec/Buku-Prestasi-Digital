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
        { id: 'home', label: 'Home', icon: Home },
        { id: 'jurnal', label: 'Jurnal', icon: BookOpen },
        { id: 'kesehatan', label: 'Kesehatan', icon: HeartPulse },
        { id: 'poin', label: 'Poin', icon: Award },
        { id: 'profil', label: 'Profil', icon: User },
      ]
    : [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'laporan', label: 'Laporan', icon: TrendingUp },
        { id: 'kesehatan', label: 'Kesehatan', icon: HeartPulse },
        { id: 'ttd', label: 'TTD', icon: PenTool },
        { id: 'profil', label: 'Profil', icon: User },
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto">
      <nav className="bg-white/95 backdrop-blur-md border-t border-green-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-2 flex items-center justify-around rounded-t-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-[#2E7D32] font-semibold'
                  : 'text-gray-400 hover:text-green-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'
                  }`}
                />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'text-[#1B5E20]' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 bg-[#2E7D32] rounded-full mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
