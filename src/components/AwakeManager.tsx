import React, { useEffect, useState, useCallback } from "react";
import { Zap, ZapOff, Activity } from "lucide-react";

export const AwakeManager: React.FC = () => {
  const [isAwake, setIsAwake] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [lastPing, setLastPing] = useState<Date | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request("screen");
        setWakeLock(lock);
        setIsAwake(true);
        console.log("Screen Wake Lock is active");

        lock.addEventListener("release", () => {
          setIsAwake(false);
          setWakeLock(null);
          console.log("Screen Wake Lock was released");
        });
      } catch (err: any) {
        console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
    }
  }, [wakeLock]);

  useEffect(() => {
    // Initial request
    requestWakeLock();

    // Re-request if visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Aggressive server pinging (every 2 minutes)
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
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      <div className="relative">
        <Zap className={`w-3.5 h-3.5 ${isAwake ? "text-emerald-400 fill-emerald-400" : "text-slate-500"}`} />
        {isAwake && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none">Always Awake</span>
        <span className="text-[8px] text-slate-500 font-medium">Server Live & Screen Locked</span>
      </div>
      {lastPing && (
        <div className="ml-2 pl-2 border-l border-white/5 flex items-center gap-1">
          <Activity className="w-3 h-3 text-emerald-500/50" />
          <span className="text-[8px] text-slate-600 font-mono">
            {lastPing.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
};
