import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUp, Circle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '../context/ThemeProvider';
import { cn } from './ui/cn';
import { AGENT_HOME, SHIELD_HOME } from '../utils/paths';
import WhatsAppShieldLogo from './ui/WhatsAppShieldLogo';

const LINK_COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Shield', to: SHIELD_HOME },
      { label: 'Numbers', to: '/number-formats' },
      { label: 'History', to: '/history' },
      { label: 'Guide', to: '/user-guide' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'WhatsApp Shield', to: SHIELD_HOME },
      { label: 'Message Agent', to: '/message-agent' },
      { label: 'FAQ', to: '/faq' },
      { label: 'About Us', to: '/about' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy-policy' },
      { label: 'Terms', to: '/terms' },
      { label: 'Data Processing', to: '/data-processing' },
    ],
  },
];

/* Easing + particle field used by the animated wordmark reveal. */
const MOTION_EASE = [0.22, 1, 0.36, 1];

const PARTICLES = [
  { x: '16%', y: '32%', size: 5, driftX: 16 },
  { x: '74%', y: '24%', size: 4, driftX: -14 },
  { x: '42%', y: '68%', size: 6, driftX: 10 },
];

/* Static link column — always expanded, reflowed into a responsive grid
   (2x2 on mobile/tablet, single horizontal row on desktop). No toggles. */
const FooterColumn = ({ title, links }) => (
  <div className="footer-nav-col">
    <h3 className="footer-nav-head">{title}</h3>
    <ul className="footer-nav-links">
      {links.map((link) => (
        <li key={link.label}>
          <Link to={link.to} className="footer-nav-link">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

/* Premium animated footer. Fully self-contained: resolves its own theme,
   hides itself entirely under the /message-agent route tree and owns the
   floating scroll-to-top action that appears once the page is scrolled. */
const Footer = () => {
  const { resolvedTheme } = useTheme();
  const { pathname } = useLocation();
  const [showFab, setShowFab] = useState(false);
  const reducedMotion = useReducedMotion();

  // Letter-by-letter 3D entrance. Reduced motion collapses to a plain fade.
  const letterVariants = reducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
      }
    : {
        hidden: { opacity: 0, y: 30, rotateX: 40 },
        visible: {
          opacity: 1,
          y: 0,
          rotateX: 0,
          transition: { duration: 0.7, ease: MOTION_EASE },
        },
      };

  const rowVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.03,
        delayChildren: reducedMotion ? 0 : 0.1,
      },
    },
  };

  // Dynamic brand behavior — the Agent product owns /message-agent entirely,
  // so its footer never renders (this component returns null there). Every
  // other route (default + Shield pages) reveals the WhatsApp Shield brand.
  const isAgentRoute = pathname === AGENT_HOME || pathname.startsWith(`${AGENT_HOME}/`);

  // Floating action button appears after scrolling past the first viewport.
  useEffect(() => {
    const onScroll = () => setShowFab(window.scrollY > 320);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (isAgentRoute) return null;

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Split a word into individually-tracked letters for the staggered 3D
  // flip-up entrance. Accent letters carry the animated sheen layer.
  const renderWordLetters = (word, accent, start) =>
    Array.from(word).map((char, i) => (
      <motion.span
        key={`${accent ? 'accent' : 'text'}-${i}`}
        variants={letterVariants}
        className={cn(
          'footer-wordmark-letter',
          accent ? 'footer-wordmark-accent' : 'footer-wordmark-text'
        )}
        style={accent && !reducedMotion ? { animationDelay: `${-(start + i) * 0.22}s` } : undefined}
        aria-hidden="true"
      >
        {char}
      </motion.span>
    ));

  return (
    <>
      {/* Floating scroll-to-top action (WhatsApp-style bubble, scroll-to-top) */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll back to top"
        className={cn('footer-fab', showFab && 'footer-fab-visible')}
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>

      <footer
        className={cn('footer-premium', resolvedTheme === 'light' && 'footer-premium-light')}
      >
        {/* Ambient background glow */}
        <div className="footer-premium-glow" aria-hidden="true" />

        <div className="app-container footer-premium-inner relative z-10">
          {/* ===== Top row: trust badge + 4 link columns ===== */}
          <div className="footer-top">
            <div className="footer-badge-wrap">
              <Link to={SHIELD_HOME} className="footer-badge group" aria-label="WhatsApp Shield home">
                <span className="footer-badge-mark">
                  <WhatsAppShieldLogo
                    size={22}
                    className="text-[#00d97a] group-hover:scale-105 transition-transform duration-300"
                  />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="footer-badge-title">WhatsApp Shield</span>
                  <span className="footer-badge-sub">Business verification platform</span>
                </span>
              </Link>
              <p className="footer-tagline">
                Enterprise-grade WhatsApp number verification and audience management
                platform. Keep your communications safe and effective.
              </p>
            </div>

            <nav className="footer-nav" aria-label="Footer navigation">
              {LINK_COLUMNS.map((column) => (
                <FooterColumn key={column.title} title={column.title} links={column.links} />
              ))}
            </nav>
          </div>

          <div className="footer-divider" aria-hidden="true" />

          {/* ===== Oversized animated brand wordmark ===== */}
          <div className="footer-wordmark" role="img" aria-label="WhatsApp Shield">
            <motion.div
              className="footer-wordmark-glow"
              style={{ x: '-50%', y: '-50%' }}
              animate={
                reducedMotion
                  ? { opacity: 0.35 }
                  : { scale: [0.95, 1.05, 0.95], opacity: [0.3, 0.5, 0.3] }
              }
              transition={
                reducedMotion
                  ? { duration: 0.6 }
                  : { duration: 5, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              }
              aria-hidden="true"
            />
            {!reducedMotion && PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                className="footer-wordmark-particle"
                style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
                animate={{ y: [0, -24, 0], x: [0, p.driftX, 0], opacity: [0.12, 0.5, 0.12] }}
                transition={{
                  duration: 6 + i * 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.9,
                }}
                aria-hidden="true"
              />
            ))}
            <motion.div
              className="footer-wordmark-row"
              variants={rowVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
            >
              {renderWordLetters('WhatsApp', false, 0)}
              {renderWordLetters('Shield', true, 8)}
            </motion.div>
          </div>

          <div className="footer-divider" aria-hidden="true" />

          {/* ===== Bottom row: legal info left, status right ===== */}
          <div className="footer-bottom">
            <div className="flex flex-col gap-1">
              <p className="footer-copyright">
                &copy; 2026 WhatsApp Shield. All rights reserved.
              </p>
              <p className="footer-made-with">
                Made with&nbsp;
                <span className="text-[#00d97a]" aria-hidden="true">&#10084;</span>
                <span className="sr-only">love</span>
                &nbsp;for WhatsApp teams.
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="footer-status">
                <span className="footer-status-dot" aria-hidden="true" />
                <span className="sr-only">System status:</span>
                All systems operational
              </span>
              <span className="footer-version">
                <Circle size={8} aria-hidden="true" className="footer-version-icon" />
                v1.5.0
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;