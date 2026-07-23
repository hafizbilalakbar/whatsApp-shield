import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Shield, LogOut, ArrowRight, Loader2, QrCode, AlertTriangle, Wifi, RotateCcw, UserPlus, History, CheckCircle2, Trash2 } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/AlertDialog';
import { cn } from '../ui/cn';

const Step1Auth = ({ onNext }) => {
  const navigate = useNavigate();
  const { 
    status, 
    isConnected, 
    isAuthenticated,
    qrCode, 
    sessionUser, 
    previouslyConnected, 
    logout,
    sendMessage,
    restoreFailed: ctxRestoreFailed,
    setRestoreFailed: setCtxRestoreFailed
  } = useWebSocket();

  const [restoring, setRestoring] = React.useState(false);
  const [restoreAttempted, setRestoreAttempted] = React.useState(false);
  const [userIp, setUserIp] = React.useState(null);
  const [ipLoaded, setIpLoaded] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);
  const [connectionPhase, setConnectionPhase] = React.useState(null);
  const [exiting, setExiting] = React.useState(false);
  const restoreTimeoutRef = React.useRef(null);
  const connectedRef = React.useRef(false);
  const prevStatusRef = React.useRef(status);
  const wasQrScanRef = React.useRef(false);

  // Phase machine: detects QR_CODE→CONNECTED transition
  React.useEffect(() => {
    const wasQr = prevStatusRef.current === 'QR_CODE';
    prevStatusRef.current = status;
    if (!isConnected) {
      setConnectionPhase(null);
      connectedRef.current = false;
      return;
    }
    if (wasQr) {
      wasQrScanRef.current = true;
      setConnectionPhase('authenticating');
    } else if (connectionPhase === null) {
      wasQrScanRef.current = false;
      setConnectionPhase('connected');
    }
  }, [status, isConnected, connectionPhase]);

  // Phase timer: authenticating → connected → auto-advance
  React.useEffect(() => {
    if (connectionPhase === 'authenticating') {
      const t = setTimeout(() => setConnectionPhase('connected'), 500);
      return () => clearTimeout(t);
    }
    if (connectionPhase === 'connected') {
      if (restoring) {
        setRestoring(false);
        setRestoreAttempted(false);
        setCtxRestoreFailed(false);
      }
      connectedRef.current = true;
      const delay = wasQrScanRef.current ? 1200 : 400;
      const t = setTimeout(() => {
        setExiting(true);
        setTimeout(() => onNext(), 300);
      }, delay);
      return () => clearTimeout(t);
    }
  }, [connectionPhase, onNext, restoring, setCtxRestoreFailed]);

  // Watch context restoreFailed flag
  React.useEffect(() => {
    if (ctxRestoreFailed && restoring) {
      setRestoring(false);
      setRestoreAttempted(false);
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }
    }
  }, [ctxRestoreFailed, restoring]);

  React.useEffect(() => {
    return () => {
      if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);
    };
  }, []);

  // Fetch user IP on mount
  React.useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        if (data.ip) setUserIp(data.ip);
        setIpLoaded(true);
      })
      .catch(() => setIpLoaded(true));
  }, []);

  // Save IP to session history on successful connection
  React.useEffect(() => {
    if (isConnected && sessionUser && userIp) {
      try {
        const sessionHistory = JSON.parse(localStorage.getItem('session_history') || '[]');
        const existingIdx = sessionHistory.findIndex(s => s.number === sessionUser.number);
        const entry = {
          number: sessionUser.number,
          name: sessionUser.name || 'Unknown',
          avatar: sessionUser.avatar || null,
          ip: userIp,
          lastSeen: new Date().toISOString()
        };
        if (existingIdx !== -1) {
          sessionHistory[existingIdx] = entry;
        } else {
          sessionHistory.push(entry);
        }
        localStorage.setItem('session_history', JSON.stringify(sessionHistory));
      } catch (e) {}
    }
  }, [isConnected, sessionUser, userIp]);

  const handleGenerateQR = () => {
    setCtxRestoreFailed(false);
    sendMessage({ type: 'generate_qr' });
  };

  const handleReconnect = async (phone) => {
    setRestoring(true);
    setRestoreAttempted(true);
    setCtxRestoreFailed(false);
    sendMessage({ type: 'restore_session', phone: phone || '' });
    if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);
    restoreTimeoutRef.current = setTimeout(() => {
      setRestoring(false);
      setRestoreAttempted(false);
      setCtxRestoreFailed(true);
    }, 15000);
  };

  const handleDeleteSession = async (phone) => {
    if (!phone) return;
    setDeleting(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const res = await fetch(`/api/sessions/${cleanPhone}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.previouslyConnected) {
          sendMessage({ type: 'delete_session', phone: cleanPhone });
        }
      } else {
        sendMessage({ type: 'delete_session', phone: cleanPhone });
      }
    } catch (e) {
      sendMessage({ type: 'delete_session', phone });
    }
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const history = JSON.parse(localStorage.getItem('session_history') || '[]');
      localStorage.setItem('session_history', JSON.stringify(history.filter(s => s.number !== cleanPhone)));
    } catch (e) {}
    setDeleteTarget(null);
    setDeleting(false);
  };

  const sessionHistory = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session_history') || '[]');
    } catch { return []; }
  }, [isConnected]);

  const ipMatchedProfile = React.useMemo(() => {
    if (!userIp || !ipLoaded) return null;
    return sessionHistory.find(s => s.ip === userIp) || null;
  }, [userIp, ipLoaded, sessionHistory]);

  const allPreviousSessions = React.useMemo(() => {
    const serverSessions = previouslyConnected || [];
    let localSessions = [];
    try {
      localSessions = JSON.parse(localStorage.getItem('ws_shield_sessions') || '[]');
    } catch (e) {}
    const merged = [...serverSessions];
    localSessions.forEach(ls => {
      if (!merged.some(s => s.number === ls.number)) {
        merged.push(ls);
      }
    });
    return merged;
  }, [previouslyConnected]);

  const hasPreviousSessions = allPreviousSessions.length > 0;

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
          <Shield className="text-primary" /> Sign In
        </h2>
        <p className="text-text-secondary mt-1">Connect your WhatsApp account to get started with Shield validation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 flex-grow">
        
        {/* Left Col (3/5): QR Login for New Users */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="flex-grow flex flex-col overflow-hidden relative">
            <CardHeader className="bg-background/50 border-b border-border pb-4">
              <CardTitle className="flex justify-between items-center text-lg">
                <span className="flex items-center gap-2">
                  <UserPlus size={18} className="text-primary" /> New Connection
                </span>
                <Badge variant={isConnected ? "success" : (status === "CONNECTING" ? "warning" : "outline")} className="font-mono text-xs">
                  {status === 'CONNECTED' && <><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse inline-block" /> Connected</>}
                  {status === 'CONNECTING' && <Loader2 size={12} className="animate-spin mr-1.5 inline-block" />}
                  {status === 'QR_CODE' && <><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-warning animate-pulse inline-block" /> Scan Ready</>}
                  {status === 'DISCONNECTED' && 'Disconnected'}
                </Badge>
              </CardTitle>
              {!isConnected && status !== 'CONNECTING' && (
                <CardDescription>
                  Scan the QR code below with your phone to link your WhatsApp account.
                </CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="flex-grow flex flex-col items-center justify-center p-6 md:p-8">
              <AnimatePresence mode="wait">
                {connectionPhase === 'authenticating' ? (
                  <motion.div
                    key="authenticating"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="text-center flex flex-col items-center justify-center py-12 space-y-6"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-border rounded-full animate-pulse" />
                      <div className="w-16 h-16 border-4 border-primary rounded-full border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <div>
                      <p className="text-text-primary font-semibold text-lg">QR Code Scanned!</p>
                      <p className="text-text-secondary text-sm mt-1">Authenticating your device...</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="flex -space-x-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>Linking your WhatsApp account</span>
                    </div>
                  </motion.div>
                ) : isConnected && sessionUser ? (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={exiting ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-center flex flex-col items-center"
                  >
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 p-1 mb-4 relative">
                      {sessionUser.avatar ? (
                        <img src={sessionUser.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                          {sessionUser.name ? sessionUser.name.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 w-4 h-4 bg-success border-2 border-surface rounded-full shadow-sm" />
                    </div>
                    <h3 className="text-lg font-display font-semibold mb-1">{sessionUser.name || 'WhatsApp Session'}</h3>
                    <p className="text-sm text-text-secondary font-mono mb-4">{sessionUser.number}</p>
                    <div className="flex items-center gap-2 text-xs text-success mb-3">
                      <CheckCircle2 size={14} /> Connected successfully
                    </div>
                    <div className="flex gap-3 w-full max-w-xs">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-error hover:text-error hover:bg-error/10 border-error/20">
                            <LogOut size={14} className="mr-1" /> Disconnect
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect Session?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will clear your local authentication keys. You will need to scan a new QR code to reconnect.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={logout} className="bg-error hover:bg-error/90 text-white">Disconnect</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button size="sm" onClick={() => { setExiting(true); setTimeout(() => { navigate('/dashboard'); onNext(); }, 200); }}>
                        Dashboard <ArrowRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </motion.div>
                ) : restoring ? (
                  <motion.div
                    key="restoring"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center flex flex-col items-center justify-center text-text-muted space-y-4"
                  >
                    <div className="relative">
                      <div className="w-14 h-14 border-4 border-border rounded-full animate-pulse" />
                      <div className="w-14 h-14 border-4 border-primary rounded-full border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <p className="text-sm">Restoring previous session...</p>
                  </motion.div>
                ) : (status === 'QR_CODE' && qrCode) ? (
                  <motion.div
                    key="qr"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="text-center flex flex-col items-center w-full max-w-sm"
                  >
                    {ctxRestoreFailed && (
                      <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning w-full">
                        <AlertTriangle size={16} className="shrink-0" /> Session restore expired — new QR ready.
                      </div>
                    )}
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-lg mb-5 relative overflow-hidden group">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 md:w-56 md:h-56 relative z-10" />
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_10px_rgba(0,217,126,1)] z-20 animate-scan-line pointer-events-none" />
                    </div>
                    <h3 className="font-semibold mb-3">Scan to Link Your Device</h3>
                    <ol className="text-sm text-text-secondary text-left space-y-2 max-w-xs mx-auto">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">1</span>
                        Open WhatsApp on your phone
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">2</span>
                        Go to <strong>Settings</strong> &rarr; <strong>Linked Devices</strong>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">3</span>
                        Tap <strong>Link a Device</strong> and scan this code
                      </li>
                    </ol>
                  </motion.div>
                ) : status === 'CONNECTING' ? (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center flex flex-col items-center justify-center text-text-muted space-y-4"
                  >
                    <div className="relative">
                      <div className="w-14 h-14 border-4 border-border rounded-full animate-pulse" />
                      <div className="w-14 h-14 border-4 border-primary rounded-full border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <p className="text-sm">Initializing secure gateway...</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="disconnected"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center flex flex-col items-center justify-center text-text-muted space-y-5 py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center border-2 border-dashed border-border">
                      <QrCode size={28} className="opacity-40" />
                    </div>
                    <div>
                      <p className="text-text-primary font-semibold mb-1">Ready to Connect</p>
                      <p className="text-sm">Click below to generate your secure QR code.</p>
                    </div>
                    <Button onClick={handleGenerateQR} variant="default" size="sm" disabled={isConnected || status === 'CONNECTING'}>
                      {status === 'CONNECTING' ? <><Loader2 size={14} className="animate-spin mr-2" /> Initializing...</> : <><QrCode size={16} className="mr-2" /> Generate QR Code</>}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Right Col (2/5): Returning Users — Restore */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {ipMatchedProfile && !isConnected && !restoring && (
            <Card className="border-primary/40 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-500">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Wifi size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary mb-1">
                    Welcome back{ipMatchedProfile.name ? `, ${ipMatchedProfile.name}` : ''}
                  </p>
                  <p className="text-xs text-text-secondary mb-3">
                    Same network detected. Restore instantly?
                  </p>
                  <Button size="sm" onClick={() => handleReconnect(ipMatchedProfile.number)} disabled={restoring}>
                    {restoring ? <Loader2 size={14} className="animate-spin mr-1" /> : <RotateCcw size={14} className="mr-1" />}
                    Restore Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="flex-grow flex flex-col bg-background/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <History size={16} className="text-text-secondary" /> Saved Sessions
              </CardTitle>
              <CardDescription className="text-xs">
                {hasPreviousSessions
                  ? 'Click Restore to reconnect without scanning a QR code.'
                  : 'After your first connection, sessions appear here for quick restore.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto custom-scrollbar">
              {hasPreviousSessions ? (
                <div className="space-y-2">
                  {allPreviousSessions.map((profile, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:border-primary/40 transition-colors group">
                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-background shrink-0 border border-border">
                          {profile.avatar ? (
                            <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs">
                              {profile.name ? profile.name.charAt(0).toUpperCase() : '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate text-text-primary">{profile.name || 'Unknown'}</span>
                          <span className="text-xs text-text-muted font-mono truncate">{profile.number}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-text-secondary hover:text-primary"
                          onClick={() => handleReconnect(profile.number)}
                          disabled={isConnected || restoring || deleting}
                        >
                          {restoring ? <Loader2 size={12} className="animate-spin" /> : 'Restore'}
                        </Button>
                        <AlertDialog open={deleteTarget === profile.number} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setDeleteTarget(profile.number)}
                              disabled={isConnected || restoring || deleting}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Saved Session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove <strong>{profile.name || profile.number}</strong> ({profile.number}) and all associated data including chat history, contacts, and campaign records. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                              <Button
                                onClick={() => handleDeleteSession(profile.number)}
                                disabled={deleting}
                                className="bg-error hover:bg-error/90 text-white"
                              >
                                {deleting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Trash2 size={14} className="mr-1.5" />}
                                Delete Permanently
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-text-muted space-y-4 py-8">
                  <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center">
                    <Smartphone size={20} className="opacity-40" />
                  </div>
                  <p className="text-sm max-w-[200px]">No saved sessions yet. Scan the QR code to connect for the first time.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default Step1Auth;
