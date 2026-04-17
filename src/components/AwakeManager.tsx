import React, { useEffect, useState, useCallback } from "react";
import { Zap, ZapOff, Activity, RefreshCw, Power } from "lucide-react";
import { cn } from "@/src/lib/utils";

export const AwakeManager: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [lastPing, setLastPing] = useState<Date | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) {
      setIsBlocked(true);
      return;
    }
    
    // Page must be visible to acquire wake lock
    if (document.visibilityState !== "visible") return;

    try {
      // Release existing lock if any
      if (wakeLock) {
        try { await wakeLock.release(); } catch(e) {}
      }
      
      const lock = await (navigator as any).wakeLock.request("screen");
      setWakeLock(lock);
      setIsAwake(true);
      setIsBlocked(false);
      console.log("Screen Wake Lock is active");

      lock.addEventListener("release", () => {
        setIsAwake(false);
        setWakeLock(null);
        console.log("Screen Wake Lock was released");
        // Don't auto-reset isEnabled here, the user choice persists
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setIsBlocked(true);
      }
      console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
    }
  }, [wakeLock]);

  const toggleAwakeMode = () => {
    if (isEnabled) {
      setIsEnabled(false);
      if (wakeLock) wakeLock.release();
      setIsAwake(false);
    } else {
      setIsEnabled(true);
      requestWakeLock();
    }
  };

  useEffect(() => {
    // Re-request if visibility changes and it was previously enabled by user
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isEnabled) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Aggressive server pinging (every 2 minutes) - this runs regardless of wake lock
    const pingServer = async () => {
      try {
        await fetch("/api/health");
        setLastPing(new Date());
      } catch (e) {
        console.warn("Ping failed", e);
      }
    };

    const interval = setInterval(pingServer, 2 * 60 * 1000);
    pingServer(); // Immediate ping

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
      if (wakeLock) wakeLock.release();
    };
  }, [isEnabled, requestWakeLock, wakeLock]);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
      isAwake ? "bg-emerald-500/10 border-emerald-500/20" : 
      isBlocked ? "bg-amber-500/10 border-amber-500/20" :
      isEnabled ? "bg-blue-500/10 border-blue-500/20" :
      "bg-slate-500/5 border-white/5"
    )}>
      <button 
        onClick={toggleAwakeMode}
        className={cn(
          "relative p-1 rounded-md transition-all",
          isEnabled ? "bg-white/10" : "hover:bg-white/5"
        )}
        title={isEnabled ? "Disable Always Awake" : "Enable Always Awake"}
      >
        {isBlocked ? (
          <ZapOff className="w-4 h-4 text-amber-500" />
        ) : isEnabled ? (
          <Zap className={cn("w-4 h-4", isAwake ? "text-emerald-400 fill-emerald-400" : "text-blue-400")} />
        ) : (
          <Power className="w-4 h-4 text-slate-500" />
        )}
        {isAwake && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
        )}
      </button>

      <div className="flex flex-col min-w-[120px]">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-widest leading-none",
          isAwake ? "text-emerald-400" : isBlocked ? "text-amber-500" : isEnabled ? "text-blue-400" : "text-slate-500"
        )}>
          {isBlocked ? "System Restricted" : isEnabled ? (isAwake ? "System Awake" : "Connecting...") : "Stay Online"}
        </span>
        <span className="text-[8px] text-slate-500 font-medium whitespace-nowrap">
          {isBlocked ? "Browser Policy Limitation" : isAwake ? "Device Sleep Prohibited" : "Prevent automated sleep"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 ml-1">
        {lastPing && (
          <div className="pl-2 border-l border-white/10 flex items-center gap-1" title="Last Server Activity">
            <Activity className="w-3 h-3 text-emerald-500/50" />
            <span className="text-[8px] text-slate-600 font-mono">
              {lastPing.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        
        {isBlocked && (
          <div className="flex items-center gap-1">
            <button 
              onClick={() => requestWakeLock()}
              className="p-1 hover:bg-white/5 rounded-md transition-colors text-amber-500"
              title="Retry Connection"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-[9px] font-bold rounded uppercase transition-all"
              title="Open in new window to bypass policies"
            >
              Open New Tab
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
