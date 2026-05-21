"use client";
import { useEffect, useState } from "react";

interface SLATimerProps {
  createdAt: string;
  slaDurationHours?: number;
  className?: string;
}

// Gate 0 SLA countdown — PRD v1.3 §2.2: 48h window, never auto-approve.
export function SLATimer({ createdAt, slaDurationHours = 48, className = "" }: SLATimerProps) {
  const [remaining, setRemaining] = useState<string>("");
  const [isOverdue, setIsOverdue] = useState(false);
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const deadline = new Date(createdAt).getTime() + slaDurationHours * 3600 * 1000;

    function tick() {
      const now  = Date.now();
      const diff = deadline - now;
      const total = slaDurationHours * 3600 * 1000;

      if (diff <= 0) {
        setIsOverdue(true);
        setRemaining("OVERDUE");
        setPct(0);
        return;
      }

      setIsOverdue(false);
      setPct(Math.round((diff / total) * 100));
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}m remaining`);
    }

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [createdAt, slaDurationHours]);

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverdue  ? "bg-red-500"    :
            pct < 25   ? "bg-orange-400" :
            pct < 50   ? "bg-amber-400"  :
                         "bg-aa-orange"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-medium ${isOverdue ? "text-red-600" : "text-aa-gray"}`}>
        {remaining || "calculating…"}
      </span>
    </div>
  );
}
