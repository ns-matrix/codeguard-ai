import { NavLink, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from './Sidebar';

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-shell/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <NavLink
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? 'accent-text' : 'text-ink-mute'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
