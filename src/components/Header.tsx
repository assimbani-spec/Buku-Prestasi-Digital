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
    <header className="border-b border-brand-900 bg-brand-800 px-5 pb-5 pt-5 text-white">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-control border border-white/20 bg-brand-950/30 text-white">
            <User className="h-5 w-5 text-brand-100" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-100">SMK Thibbil Qulub Assimbani</p>
            <p className="max-w-[220px] truncate text-sm font-semibold text-white">{greeting}</p>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Keluar dari akun"
            className="flex h-11 w-11 items-center justify-center rounded-control border border-white/20 bg-brand-950/30 text-brand-100 transition-colors hover:bg-brand-950/50 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
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
          <div className="flex shrink-0 items-center gap-2 rounded-control border border-white/20 bg-brand-950/30 px-3 py-1.5 text-right">
            <Award className="h-4 w-4 shrink-0 text-brand-100" aria-hidden="true" />
            <div>
              <div className="text-xs text-green-200 uppercase font-bold tracking-wider leading-none">
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
