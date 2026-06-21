import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, Menu, X, Shield, Activity, LogOut, WifiOff, ArrowUp, Github, Twitter, Linkedin, Send, Globe, Mail, ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeProvider';
import { useWebSocket } from '../context/WebSocketProvider';
import WhatsAppShieldLogo from './ui/WhatsAppShieldLogo';
import { ToastContainer } from './ui/ToastNotification';
import { cn } from './ui/cn';

const FooterLink = ({ to, text }) => {
  return (
    <li className="group relative">
      <Link 
        to={to} 
        className="footer-link-enhanced text-sm font-medium block py-2"
      >
        <span className="relative">
          {text}
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#25D366] to-[#34D399] transition-all duration-300 group-hover:w-full rounded-full"></span>
        </span>
      </Link>
    </li>
  );
};

const dotStyles = {
  'green-pulse': 'bg-success animate-pulse',
  'green': 'bg-success',
  'green-dim': 'bg-success opacity-50',
  'amber': 'bg-warning',
  'red': 'bg-error',
  'gray': 'bg-gray-400',
};

const Layout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { isConnected, isAuthenticated, sessionUser, isChecking, isOffline, dotState, logout } = useWebSocket();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const firstVisitRef = useRef(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mark first visit as done after initial mount
  useEffect(() => {
    firstVisitRef.current = false;
  }, []);

  const isLandingPage = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <ToastContainer isAuthenticated={isAuthenticated} />

      {/* Offline notification bar */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-warning/90 text-white text-sm py-2 px-4 flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-full duration-300">
          <WifiOff size={16} />
          <span>Connection lost — your session is paused. Reconnect to resume.</span>
        </div>
      )}

      {/* Global Scroll to Top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-[70] w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110 hover:bg-primary/90 transition-all animate-in fade-in zoom-in-95 duration-200"
          aria-label="Scroll to top"
        >
          <ArrowUp size={20} />
        </button>
      )}

      {/* Sticky Header */}
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
          isScrolled 
            ? "bg-surface/80 backdrop-blur-md border-border shadow-sm py-3" 
            : "bg-transparent border-transparent py-5",
          isOffline ? "mt-10" : ""
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <WhatsAppShieldLogo size={28} className="text-primary group-hover:scale-105 transition-transform" />
            <span className="font-display font-bold text-lg hidden sm:block tracking-tight text-text-primary">
              WhatsApp Shield
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {isLandingPage ? (
              <>
                <a href="#features" className="text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors">Features</a>
                <a href="#how-it-works" className="text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors">How It Works</a>
                <a href="#security" className="text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors">Security</a>
                <Link to="/about" className="text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors">About</Link>
                <Link to="/contact" className="text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors">Contact</Link>
                <Link to="/documentation" className="text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors">Docs</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard" className={cn("text-sm font-medium transition-colors px-3 py-2 rounded-lg hover:bg-surface", location.pathname === '/dashboard' ? 'text-primary bg-surface' : 'text-text-secondary hover:text-primary')}>Dashboard</Link>
                <Link to="/number-formats" className={cn("text-sm font-medium transition-colors px-3 py-2 rounded-lg hover:bg-surface", location.pathname === '/number-formats' ? 'text-primary bg-surface' : 'text-text-secondary hover:text-primary')}>Numbers</Link>
                <Link to="/history" className={cn("text-sm font-medium transition-colors px-3 py-2 rounded-lg hover:bg-surface", location.pathname === '/history' ? 'text-primary bg-surface' : 'text-text-secondary hover:text-primary')}>Campaigns</Link>
                <Link to="/user-guide" className={cn("text-sm font-medium transition-colors px-3 py-2 rounded-lg hover:bg-surface", location.pathname === '/user-guide' ? 'text-primary bg-surface' : 'text-text-secondary hover:text-primary')}>Guide</Link>
                <Link to="/api-docs" className={cn("text-sm font-medium transition-colors px-3 py-2 rounded-lg hover:bg-surface", location.pathname === '/api-docs' ? 'text-primary bg-surface' : 'text-text-secondary hover:text-primary')}>API</Link>
              </>
            )}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Status Badge (App Pages Only) */}
            {!isLandingPage && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-medium shadow-sm">
                {isChecking ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    <span className="text-success flex items-center gap-1"><Shield size={12} /> Shield Active</span>
                  </>
                ) : isConnected ? (
                  <>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-text-secondary"></span>
                    <span className="text-text-secondary flex items-center gap-1"><Shield size={12} /> Shield Standby</span>
                  </>
                ) : (
                  <>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
                    <span className="text-error">No Active Session</span>
                  </>
                )}
              </div>
            )}

            {/* Profile Avatar Button — only when authenticated */}
            {!isLandingPage && isAuthenticated && (
              <button
                onClick={() => navigate('/profile')}
                className="relative p-0.5 rounded-full transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary animate-in fade-in zoom-in-95 duration-300"
                title="View Profile"
              >
                <div className="relative">
                  {sessionUser?.avatar ? (
                    <img src={sessionUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs border border-border">
                      {sessionUser?.name ? sessionUser.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface",
                    dotStyles[dotState] || 'bg-gray-400'
                  )} />
                </div>
              </button>
            )}

            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full text-text-secondary hover:text-[#25D366] hover:bg-surface transition-all duration-300 hover:scale-110"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 text-text-primary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md pt-24 px-6 md:hidden flex flex-col gap-6 border-t border-border mt-16 overflow-y-auto">
            <nav className="flex flex-col gap-1">
             {isLandingPage ? (
               <>
                 <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-text-primary py-3 px-4 rounded-lg hover:bg-surface hover:border hover:border-[#25D366]/20 transition-all">Features</a>
                 <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-text-primary py-3 px-4 rounded-lg hover:bg-surface hover:border hover:border-[#25D366]/20 transition-all">How It Works</a>
                 <a href="#security" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-text-primary py-3 px-4 rounded-lg hover:bg-surface hover:border hover:border-[#25D366]/20 transition-all">Security</a>
                 <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-text-primary py-3 px-4 rounded-lg hover:bg-surface hover:border hover:border-[#25D366]/20 transition-all">About</Link>
                 <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-text-primary py-3 px-4 rounded-lg hover:bg-surface hover:border hover:border-[#25D366]/20 transition-all">Contact</Link>
                 <Link to="/documentation" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-text-primary py-3 px-4 rounded-lg hover:bg-surface hover:border hover:border-[#25D366]/20 transition-all">Documentation</Link>
               </>
             ) : (
               <>
                 <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={cn("text-lg font-medium py-3 px-4 rounded-lg transition-all hover:bg-surface hover:border hover:border-[#25D366]/20", location.pathname === '/dashboard' ? 'text-[#25D366] bg-surface border border-[#25D366]/30' : 'text-text-primary')}>Dashboard</Link>
                 <Link to="/number-formats" onClick={() => setMobileMenuOpen(false)} className={cn("text-lg font-medium py-3 px-4 rounded-lg transition-all hover:bg-surface hover:border hover:border-[#25D366]/20", location.pathname === '/number-formats' ? 'text-[#25D366] bg-surface border border-[#25D366]/30' : 'text-text-primary')}>Number Formats</Link>
                 <Link to="/history" onClick={() => setMobileMenuOpen(false)} className={cn("text-lg font-medium py-3 px-4 rounded-lg transition-all hover:bg-surface hover:border hover:border-[#25D366]/20", location.pathname === '/history' ? 'text-[#25D366] bg-surface border border-[#25D366]/30' : 'text-text-primary')}>Campaigns</Link>
                 <Link to="/user-guide" onClick={() => setMobileMenuOpen(false)} className={cn("text-lg font-medium py-3 px-4 rounded-lg transition-all hover:bg-surface hover:border hover:border-[#25D366]/20", location.pathname === '/user-guide' ? 'text-[#25D366] bg-surface border border-[#25D366]/30' : 'text-text-primary')}>Guide</Link>
                 <Link to="/api-docs" onClick={() => setMobileMenuOpen(false)} className={cn("text-lg font-medium py-3 px-4 rounded-lg transition-all hover:bg-surface hover:border hover:border-[#25D366]/20", location.pathname === '/api-docs' ? 'text-[#25D366] bg-surface border border-[#25D366]/30' : 'text-text-primary')}>API Docs</Link>
                 <div className="border-t border-border/50 mt-4 pt-4">
                   {sessionUser && (
                     <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-surface border border-error/20 text-error text-base font-medium rounded-lg hover:bg-error/10 hover:border-error/40 transition-all">
                       <LogOut size={18} /> Disconnect Session
                     </button>
                   )}
                 </div>
               </>
             )}
           </nav>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-grow pt-24 pb-12 flex flex-col z-10 relative",
        isOffline ? "mt-10" : ""
      )}>
        {/* Shimmer overlay when offline */}
        {isOffline && (
          <div className="fixed inset-0 z-30 pointer-events-none">
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

      {/* Footer - WhatsApp Official Style */}
      <footer className={cn("footer-whatsapp pt-16 pb-12 z-10 relative overflow-hidden", theme === 'light' && 'light')}>        
        {/* WhatsApp-inspired premium animated background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          {theme === 'dark' ? (
            <div className="absolute inset-0 mesh-gradient-dark opacity-50" />
          ) : (
            <div className="absolute inset-0 mesh-gradient-light opacity-40" />
          )}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        </div>

        {/* WhatsApp-inspired top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#25D366] via-[#34D399] to-[#00B86E] rounded-t-sm shadow-[0_0_15px_rgba(37,211,102,0.5)]" />
        
        {/* Floating WhatsApp elements */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-surface/50 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-surface/50 to-transparent pointer-events-none" />
        
        {/* WhatsApp-inspired floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="footer-particle top-[15%] left-[10%]" style={{ animationDelay: '0s' }} />
          <div className="footer-particle top-[20%] left-[25%]" style={{ animationDelay: '-3s' }} />
          <div className="footer-particle top-[10%] left-[45%]" style={{ animationDelay: '-7s' }} />
          <div className="footer-particle top-[25%] left-[65%]" style={{ animationDelay: '-10s' }} />
          <div className="footer-particle top-[15%] left-[85%]" style={{ animationDelay: '-5s' }} />
          <div className="footer-particle top-[5%] right-[15%]" style={{ animationDelay: '-8s' }} />
          <div className="footer-particle top-[30%] right-[30%]" style={{ animationDelay: '-12s' }} />
          <div className="footer-particle bottom-[20%] left-[20%]" style={{ animationDelay: '-15s' }} />
          <div className="footer-particle bottom-[10%] left-[50%]" style={{ animationDelay: '-18s' }} />
          <div className="footer-particle bottom-[30%] left-[80%]" style={{ animationDelay: '-20s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Main Footer Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 mb-10">
            
            {/* Brand Column - Takes more space on desktop */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Link to="/" className="flex items-center gap-3 group">
                <WhatsAppShieldLogo size={32} className="text-[#25D366] group-hover:scale-105 transition-all duration-300" />
                <span className="font-display font-bold text-xl tracking-tight text-text-primary group-hover:text-[#25D366] transition-colors duration-300">WhatsApp Shield</span>
              </Link>
              
              <p className="text-sm text-text-secondary leading-relaxed max-w-sm group-hover:text-text-primary transition-colors duration-300">
                Enterprise-grade WhatsApp number verification and audience management. Keep your communications safe and effective.
              </p>
              
              <div className="flex items-center gap-3 mt-4">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="footer-link-enhanced w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 hover:bg-[#25D366]/10" aria-label="GitHub">
                  <Github size={18} className="text-text-secondary group-hover:text-[#25D366] transition-colors" />
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="footer-link-enhanced w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 hover:bg-[#1DA1F2]/10" aria-label="Twitter/X">
                  <Twitter size={18} className="text-text-secondary group-hover:text-[#1DA1F2] transition-colors" />
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="footer-link-enhanced w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 hover:bg-[#0A66C2]/10" aria-label="LinkedIn">
                  <Linkedin size={18} className="text-text-secondary group-hover:text-[#0A66C2] transition-colors" />
                </a>
                <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="footer-link-enhanced w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 hover:bg-[#26A5E4]/10" aria-label="Telegram">
                  <Send size={18} className="text-text-secondary group-hover:text-[#26A5E4] transition-colors" />
                </a>
              </div>
            </div>

                 {/* Product & Features */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-sm mb-5 uppercase tracking-wider group-hover:text-[#25D366] transition-colors">Platform</h4>
              <ul className="flex flex-col gap-4">
                <FooterLink to="/dashboard" text="Dashboard" />
                <FooterLink to="/number-formats" text="Number Formats" />
                <FooterLink to="/user-guide" text="User Guide" />
                <FooterLink to="/changelog" text="Changelog" />
              </ul>
            </div>

            {/* Resources & Support */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-sm mb-5 uppercase tracking-wider group-hover:text-[#34D399] transition-colors">Resources</h4>
              <ul className="flex flex-col gap-4">
                <FooterLink to="/documentation" text="Documentation" />
                <FooterLink to="/api-docs" text="API Reference" />
                <FooterLink to="/faq" text="FAQ" />
                <FooterLink to="/about" text="About Us" />
              </ul>
            </div>

            {/* Company & Legal */}
            <div className="lg:col-span-4 flex flex-col sm:flex-row gap-12">
              <div className="flex-1">
                <h4 className="font-display font-semibold text-text-primary text-sm mb-5 uppercase tracking-wider group-hover:text-[#25D366] transition-colors">Company</h4>
                <ul className="flex flex-col gap-4">
                  <FooterLink to="/about" text="About" />
                  <FooterLink to="/contact" text="Contact" />
                  <FooterLink to="/changelog" text="Updates" />
                </ul>
              </div>
              <div className="flex-1">
                <h4 className="font-display font-semibold text-text-primary text-sm mb-5 uppercase tracking-wider group-hover:text-[#06B6D4] transition-colors">Legal</h4>
                <ul className="flex flex-col gap-4">
                  <FooterLink to="/privacy-policy" text="Privacy" />
                  <FooterLink to="/terms" text="Terms" />
                  <FooterLink to="/data-processing" text="Data Processing" />
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar - WhatsApp style */}
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse shadow-[0_0_10px_rgba(37,211,102,0.8)]" />
                <span className="text-xs text-text-muted font-medium">All systems operational</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-[#25D366]/20 text-xs font-medium hover:bg-[#25D366]/10 transition-all">
                <Shield size={12} className="text-[#25D366]" />
                <span>v1.5.0</span>
              </div>
            </div>
            
            <p className="text-xs text-text-muted font-medium">
              &copy; {new Date().getFullYear()} WhatsApp Shield. Made with ❤️ for secure communications.
            </p>
            
            {/* WhatsApp-inspired footer bottom decoration */}
            <div className="hidden lg:block absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#25D366]/20 to-transparent" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
