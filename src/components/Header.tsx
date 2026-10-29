import React from 'react';
import { Award, LogOut, ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  greeting?: string;
  fullName: string;
  subtitle?: string; // misal "Kelas: X Farmasi A • Rayon: Assimbani 1" atau "Wali dari: Muhammad Faiz"
  poin?: number;
  roleBadge?: string;
  onLogout?: () => void;
  showPoinBadge?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  greeting = 'Assalamu’alaikum,',
  fullName,
  subtitle,
  poin,
  roleBadge,
  onLogout,
  showPoinBadge = true,
}) => {
  return (
    <header className="bg-[#1B5E20] text-white px-5 pt-6 pb-6 rounded-b-3xl shadow-md transition-all">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-green-800 border border-green-600 flex items-center justify-center text-white shadow-inner">
            <User className="w-5 h-5 text-green-200" />
          </div>
          <div>
            <div className="text-xs text-green-200 font-medium tracking-wide">
              SMK THIBBIL QULUB ASSIMBANI
            </div>
            <div className="text-sm font-semibold text-white truncate max-w-[200px]">
              {greeting}
            </div>
          </div>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Keluar / Logout"
            className="p-2 rounded-xl bg-green-800/80 hover:bg-green-700 text-green-200 hover:text-white transition-colors active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 mt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white line-clamp-1">
            {fullName}
          </h1>
          {subtitle && (
            <p className="text-xs text-green-100/90 mt-0.5 font-normal">
              {subtitle}
            </p>
          )}
        </div>

        {showPoinBadge && typeof poin === 'number' && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-3 py-1.5 flex items-center gap-2 shadow-sm text-right shrink-0">
            <Award className="w-4 h-4 text-yellow-300 shrink-0" />
            <div>
              <div className="text-[10px] text-green-200 uppercase font-bold tracking-wider leading-none">
                Total Poin
              </div>
              <div className="text-base font-extrabold text-white leading-tight">
                {poin}
              </div>
            </div>
          </div>
        )}

        {roleBadge && !showPoinBadge && (
          <div className="bg-green-800/80 border border-green-600/50 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-xs text-green-100 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-green-300" />
            {roleBadge}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
