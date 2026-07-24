import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, X, Shield, LogOut, BookOpen, Info, LayoutDashboard, Hash, History, WifiOff, ArrowUp, Github, Twitter, Linkedin, Send, MessageCircle, MessageSquare } from 'lucide-react';
import { useTheme } from '../context/ThemeProvider';
import { useWebSocket } from '../context/WebSocketProvider';
import WhatsAppShieldLogo from './ui/WhatsAppShieldLogo';
import { ProductSwitcher } from './ui/ProductSwitcher';
import { ProfileDropdown } from './ui/ProfileDropdown';
import { Spinner } from './ui/Spinner';
import { ToastContainer } from './ui/ToastNotification';
import { cn } from './ui/cn';

const appNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/number-formats', label: 'Numbers', icon: Hash },
  { to: '/history', label: 'History', icon: History },
];

const publicPages = [
  { to: '/', label: 'Home' },
  { to: '/number-formats', label: 'Numbers' },
  { to: '/user-guide', label: 'Guide' },
  { to: '/faq', label: 'FAQ' },
  { to: '/about', label: 'About' },
];

const quickLinks = [
  { to: '/user-guide', label: 'Guide', icon: BookOpen },
  { to: '/about', label: 'About', icon: Info },
];

const MobileNavItem = ({ to, label, icon: Icon, path, onClose, variant }) => {
  const isActive = Array.isArray(to) ? to.some(t => path === t) : path === to;
  const linkTo = Array.isArray(to) ? to[0] : to;

  return (
    <Link
      to={linkTo}
      onClick={onClose}
      className={cn(
        "flex items-center gap-2.5 text-sm font-medium py-2.5 px-3 rounded-lg transition-all duration-200",
        isActive
          ? variant === 'agent' ? 'text-[#25D366] bg-[#25D366]/5' : 'text-primary bg-primary/5'
          : 'text-text-primary hover:bg-surface/80'
      )}
    >
      {Icon && <Icon size={14} className={cn("shrink-0", isActive ? "opacity-100" : "opacity-70")} />}
      <span>{label}</span>
    </Link>
  );
};

const Layout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { isConnected, isAuthenticated, sessionUser, isChecking, isOffline, dotState, logout, isLoggingOut } = useWebSocket();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileLeaving, setMobileLeaving] = useState(false);
  const location = useLocation();
  const path = location.pathname;
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const prevAuthRef = useRef(isAuthenticated);

  // Track auth transitions for logging
  useEffect(() => {
    if (isAuthenticated !== prevAuthRef.current) {
      prevAuthRef.current = isAuthenticated;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (mobileOpen) {
      setMobileLeaving(false);
      setMobileOpen(false);
    }
  }, [path]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen || mobileLeaving) return;
    const handler = (e) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen, mobileLeaving]);

  const closeMobile = useCallback(() => {
    setMobileLeaving(true);
    setTimeout(() => {
      setMobileOpen(false);
      setMobileLeaving(false);
    }, 200);
  }, []);

  const toggleMobile = useCallback(() => {
    if (mobileOpen) closeMobile();
    else setMobileOpen(true);
  }, [mobileOpen, closeMobile]);

  const isMessageAgent = path === '/message-agent';

  const renderMobileItems = (items, startDelay = 0) => (
    <div className="flex flex-col gap-0.5">
      {items.map((item, i) => (
        <div
          key={item.to || item.label}
          className="mobile-item-enter"
          style={{ animationDelay: `${startDelay + i * 30}ms` }}
        >
          <MobileNavItem {...item} path={path} onClose={closeMobile} />
        </div>
      ))}
    </div>
  );

  // Auth state is the single source of truth for header rendering.
  // Layout re-renders instantly when context value changes.

  return (
    <div className={cn("min-h-screen flex flex-col relative", isMessageAgent && "overflow-hidden")}>
      <ToastContainer isAuthenticated={isAuthenticated} />

      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-warning/90 text-white text-sm py-2 px-4 flex items-center justify-center gap-2 shadow-lg" role="alert">
          <WifiOff size={14} aria-hidden="true" />
          <span>Connection lost — your session is paused.</span>
        </div>
      )}

      {showScrollTop && !isMessageAgent && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-[70] w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110 hover:bg-primary/90 transition-all duration-300"
          aria-label="Scroll to top"
        >
          <ArrowUp size={18} className="sm:size-[20]" />
        </button>
      )}

      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
          isScrolled
            ? "bg-surface/60 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20 py-2"
            : "bg-transparent border-transparent py-3",
          isOffline ? "mt-10" : ""
        )}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2">

          {/* --- Left: Logo + Brand + Product Switcher --- */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to={isAuthenticated ? (isMessageAgent ? '/message-agent' : '/dashboard') : '/'}
              className="flex items-center gap-2 group shrink-0"
              aria-label={isMessageAgent ? 'Message Agent home' : 'WhatsApp Shield home'}
            >
              {isMessageAgent ? (
                <MessageSquare size={20} className="text-[#25D366] group-hover:scale-105 transition-transform duration-300 sm:size-[22]" />
              ) : (
                <WhatsAppShieldLogo size={20} className="text-primary group-hover:scale-105 transition-transform duration-300 sm:size-[22]" />
              )}
              <span className={cn(
                "hidden sm:inline font-display font-bold text-sm tracking-tight",
                isMessageAgent ? "text-[#25D366]" : "text-text-primary"
              )}>
                {isMessageAgent ? 'Message Agent' : 'WhatsApp Shield'}
              </span>
            </Link>

            {isAuthenticated && (
              <>
                <div className="w-px h-5 bg-border/40 mx-0.5 sm:mx-1" aria-hidden="true" />
                <ProductSwitcher />
              </>
            )}
          </div>

          {/* --- Center: Desktop Nav --- */}
          <nav className="hidden lg:flex items-center gap-1 relative" role="navigation" aria-label="Main navigation">
            {isAuthenticated ? (
              /* Authenticated nav — only app items, no public pages mixed in */
              <div className="flex items-center gap-1 animate-in fade-in duration-200">
                {appNavItems.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "nav-link text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg",
                      path === item.to
                        ? "text-primary active bg-primary/[0.04]"
                        : "text-text-secondary hover:text-primary hover:bg-surface/40"
                    )}
                    aria-current={path === item.to ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              /* Public nav — only visible when not authenticated */
              <div className="flex items-center gap-1 animate-in fade-in duration-200">
                {publicPages.map(p => (
                  <Link
                    key={p.to}
                    to={p.to}
                    className={cn(
                      "nav-link text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg",
                      path === p.to
                        ? "text-primary active bg-primary/[0.04]"
                        : "text-text-secondary hover:text-primary hover:bg-surface/40"
                    )}
                    aria-current={path === p.to ? 'page' : undefined}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            )}
          </nav>

          {/* --- Right: Actions --- */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {isAuthenticated && (
              /* Authenticated actions — instant render with context sync */
              <div className="flex items-center gap-1 sm:gap-1.5 animate-in fade-in duration-200">
                <div className="hidden lg:flex items-center gap-0.5 mr-0.5">
                  {quickLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={cn(
                        "p-2 rounded-lg transition-all duration-200 hover:scale-105",
                        path === link.to
                          ? "text-primary bg-primary/[0.06]"
                          : "text-text-secondary hover:text-primary hover:bg-surface/50"
                      )}
                      aria-label={link.label}
                    >
                      <link.icon size={15} />
                    </Link>
                  ))}
                  <div className="w-px h-4 bg-border/30 mx-1" aria-hidden="true" />
                </div>

                <div
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/50 border border-border/50 text-[10px] font-medium shadow-sm"
                  aria-label={`Connection status: ${isChecking ? 'scanning' : isConnected ? 'connected' : 'offline'}`}
                >
                  {isChecking ? (
                    <span className="flex items-center gap-1.5 text-success">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                      Scanning
                    </span>
                  ) : isConnected ? (
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="inline-flex rounded-full h-2 w-2 bg-success" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-error">
                      <span className="inline-flex rounded-full h-2 w-2 bg-error animate-pulse" />
                      Offline
                    </span>
                  )}
                </div>

                <ProfileDropdown sessionUser={sessionUser} dotState={dotState} logout={logout} isLoggingOut={isLoggingOut} />
              </div>
            )}

            {/* Theme toggle — always visible */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-text-secondary hover:text-[#25D366] hover:bg-surface/60 transition-all duration-200 hover:scale-110"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={15} className="sm:size-[16]" /> : <Moon size={15} className="sm:size-[16]" />}
            </button>

          </div>
        </div>
      </header>

      {/* --- Mobile Toggle (outside <header> so z-index resolves at root level, above z-[55] drawer) --- */}
      <button
        ref={toggleRef}
        className="lg:hidden fixed z-[60] top-3 right-4 p-3 text-text-primary hover:text-primary transition-colors duration-200"
        onClick={toggleMobile}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
      >
        <span className="block transition-transform duration-300" style={{ transform: mobileOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          {mobileOpen ? <X size={18} className="sm:size-[20]" /> : <Menu size={18} className="sm:size-[20]" />}
        </span>
      </button>

      {/* --- Mobile Menu --- */}
      {(mobileOpen || mobileLeaving) && (
        <div className="fixed inset-0 z-[55] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className={cn(
              "absolute inset-0 bg-background/80 backdrop-blur-sm",
              mobileLeaving ? "mobile-overlay-exit" : "mobile-overlay-enter"
            )}
            onClick={closeMobile}
          />
          <div
            ref={menuRef}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-full max-w-sm bg-surface border-l border-border shadow-2xl overflow-y-auto",
              mobileLeaving ? "mobile-menu-exit" : "mobile-menu-enter"
            )}
          >
            <div className="pt-16 pb-8 px-5">
              <nav className="flex flex-col gap-0.5" role="navigation" aria-label={isAuthenticated ? 'Application menu' : 'Main menu'}>

                {!isAuthenticated && (
                  <>
                    <div className="mobile-item-enter" style={{ animationDelay: '40ms' }}>
                      <div className="text-[10px] text-text-muted uppercase tracking-widest px-3 pb-2 font-semibold">Pages</div>
                    </div>
                    {renderMobileItems(publicPages, 60)}
                    <div className="relative my-4" aria-hidden="true">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                      <div className="relative flex justify-center"><span className="bg-surface px-3 text-[9px] text-text-muted uppercase tracking-wider font-semibold">Legal</span></div>
                    </div>
                    {renderMobileItems([
                      { to: '/privacy-policy', label: 'Privacy Policy' },
                      { to: '/terms', label: 'Terms of Service' },
                      { to: '/contact', label: 'Contact' },
                    ], 160)}
                  </>
                )}

                {isAuthenticated && (
                  <>
                    <div className="mobile-item-enter" style={{ animationDelay: '30ms' }}>
                      <div className="text-[10px] text-text-muted uppercase tracking-widest px-3 pb-2 font-semibold">Products</div>
                    </div>
                    {renderMobileItems([
                      { to: ['/dashboard', '/number-formats', '/history'], label: 'WhatsApp Shield', icon: Shield },
                      { to: '/message-agent', label: 'Message Agent', icon: MessageCircle, variant: 'agent' },
                    ], 50)}
                    <div className="relative my-4" aria-hidden="true">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                      <div className="relative flex justify-center"><span className="bg-surface px-3 text-[9px] text-text-muted uppercase tracking-wider font-semibold">Platform</span></div>
                    </div>
                    {renderMobileItems(appNavItems, 110)}
                    <div className="relative my-4" aria-hidden="true">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                      <div className="relative flex justify-center"><span className="bg-surface px-3 text-[9px] text-text-muted uppercase tracking-wider font-semibold">Resources</span></div>
                    </div>
                    {renderMobileItems([
                      { to: '/user-guide', label: 'Guide', icon: BookOpen },
                      { to: '/about', label: 'About', icon: Info },
                      { to: '/faq', label: 'FAQ', icon: Info },
                    ], 170)}
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <div className="mobile-item-enter" style={{ animationDelay: '230ms' }}>
                        <button
                          onClick={() => { if (!isLoggingOut) { logout(); closeMobile(); } }}
                          disabled={isLoggingOut}
                          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-surface border border-error/20 text-error text-sm font-medium rounded-lg hover:bg-error/5 transition-all disabled:opacity-50"
                        >
                          {isLoggingOut ? <Spinner size={14} /> : <LogOut size={14} />}
                          {isLoggingOut ? 'Logging out...' : 'Disconnect Session'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* --- Main Content --- */}
      <main className={cn(
        "flex-grow flex flex-col z-10 relative",
        isMessageAgent ? "pt-11" : "pt-14 pb-6 sm:pb-8",
        isOffline ? "mt-10" : ""
      )} role="main">
        {isOffline && (
          <div className="fixed inset-0 z-30 pointer-events-none" aria-hidden="true">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px]" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="shimmer-overlay w-full h-full" />
            </div>
          </div>
        )}
        <div className={cn(
          "relative z-10 flex-grow flex flex-col transition-opacity duration-300",
          isOffline ? "opacity-60" : "opacity-100"
        )}>
          {children}
        </div>
      </main>

      {/* --- Footer (hidden on Message Agent for max vertical space) --- */}
      <footer className={cn("footer-whatsapp pt-5 pb-4 md:pt-10 md:pb-6 z-10 relative overflow-hidden", theme === 'light' && 'light', isMessageAgent && "hidden")}>
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          {theme === 'dark' ? (
            <div className="absolute inset-0 mesh-gradient-dark opacity-50" />
          ) : (
            <div className="absolute inset-0 mesh-gradient-light opacity-40" />
          )}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#25D366] via-[#34D399] to-[#00B86E]" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 xl:px-8 relative z-10">

          {/* Main grid: Brand Block + 4 Nav Columns — 1-col → 2-col → 3-col → 12-col */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-4 md:gap-8 lg:gap-6 mb-6 md:mb-10">

            {/* Brand Block — logo, description, social icons stacked at top-left */}
            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 flex flex-col gap-3 md:gap-5">
              <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
                <WhatsAppShieldLogo size={20} className="text-[#25D366] group-hover:scale-105 transition-all sm:size-[24] md:size-[28]" />
                <span className="font-display font-bold text-sm sm:text-base md:text-lg tracking-tight text-text-primary group-hover:text-[#25D366] transition-colors whitespace-nowrap">WhatsApp Shield</span>
              </Link>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-full sm:max-w-[260px]">
                Enterprise-grade WhatsApp number verification and audience management platform. Keep your communications safe and effective.
              </p>
              <div className="flex items-center gap-2 md:gap-3">
                {[Github, Twitter, Linkedin, Send].map((Icon, i) => (
                  <a key={i} href="#" className="footer-social-btn-hover w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-lg" aria-label="Social">
                    <Icon size={12} className="text-text-secondary md:size-[16]" />
                  </a>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Platform</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to="/dashboard" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Dashboard</Link></li>
                <li><Link to="/number-formats" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Numbers</Link></li>
                <li><Link to="/history" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">History</Link></li>
                <li><Link to="/user-guide" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Guide</Link></li>
                <li><Link to="/changelog" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Changelog</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Resources</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to="/dashboard" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">WhatsApp Shield</Link></li>
                <li><Link to="/message-agent" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Message Agent</Link></li>
                <li><Link to="/faq" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">FAQ</Link></li>
                <li><Link to="/about" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">About Us</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Company</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to="/about" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">About</Link></li>
                <li><Link to="/contact" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Contact</Link></li>
                <li><Link to="/changelog" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Updates</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="lg:col-span-2 md:col-span-3">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Legal</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to="/privacy-policy" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Terms</Link></li>
                <li><Link to="/data-processing" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Data Processing</Link></li>
              </ul>
            </div>

          </div>

          {/* Bottom section: divider + two-column status/version | copyright */}
          <div className="pt-4 md:pt-6 border-t border-border/50">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#25D366] animate-pulse" />
                  <span className="text-xs text-text-muted font-medium">All systems operational</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-surface border border-[#25D366]/20 text-xs font-medium">
                  <Shield size={8} className="text-[#25D366] md:size-[10]" />
                  <span>v1.5.0</span>
                </div>
              </div>
              <p className="text-xs text-text-muted font-medium">&copy; {new Date().getFullYear()} WhatsApp Shield. All rights reserved.</p>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
};

export default Layout;
