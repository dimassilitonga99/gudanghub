import * as React from "react"
import { Crown } from "lucide-react"

import { cn } from "@/lib/utils"

export interface LeaderboardRanking {
  userId: string
  userName: string
  rank: number
  value: number
}

interface LeaderboardPodiumProps {
  rankings: LeaderboardRanking[]
  className?: string
}

const MEDAL_STYLES: Record<
  number,
  { chip: string; avatar: string; pedestal: string }
> = {
  1: {
    chip: "bg-amber-400/15 text-amber-500 dark:text-amber-400",
    avatar: "bg-amber-400/15 text-amber-600 ring-2 ring-amber-400/60 dark:text-amber-400",
    pedestal: "from-amber-400/50 to-amber-400/5",
  },
  2: {
    chip: "bg-slate-400/15 text-slate-500 dark:text-slate-300",
    avatar: "bg-slate-400/15 text-slate-600 ring-2 ring-slate-400/50 dark:text-slate-200",
    pedestal: "from-slate-400/40 to-slate-400/5",
  },
  3: {
    chip: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    avatar: "bg-orange-500/15 text-orange-600 ring-2 ring-orange-500/50 dark:text-orange-400",
    pedestal: "from-orange-500/40 to-orange-500/5",
  },
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) return "?"
  return parts.map((p) => p.charAt(0).toUpperCase()).join("")
}

function PodiumSlot({
  ranking,
  size,
}: {
  ranking: LeaderboardRanking | undefined
  size: "sm" | "md" | "lg"
}) {
  if (!ranking) {
    return <div className="flex-1" aria-hidden="true" />
  }

  const style = MEDAL_STYLES[ranking.rank] ?? MEDAL_STYLES[3]

  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-2">
      <div
        className={cn(
          "font-bold tabular-nums",
          size === "lg" ? "text-2xl" : "text-xl",
        )}
      >
        {ranking.value.toLocaleString("id-ID")}
      </div>

      <div className="relative">
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full font-semibold",
            size === "lg" && "h-16 w-16 text-lg",
            size !== "lg" && "text-sm",
            style.avatar,
          )}
        >
          {getInitials(ranking.userName)}
        </span>
        {ranking.rank === 1 && (
          <Crown
            className="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2 text-amber-500"
            strokeWidth={2.2}
          />
        )}
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ring-background",
            style.chip,
          )}
        >
          {ranking.rank}
        </span>
      </div>

      <p className="max-w-[120px] truncate text-center text-xs font-medium text-muted-foreground">
        {ranking.userName}
      </p>

      <div
        className={cn(
          "w-full rounded-t-lg border border-b-0 border-border bg-gradient-to-b",
          style.pedestal,
          size === "lg" ? "h-24" : size === "md" ? "h-16" : "h-12",
        )}
        aria-hidden="true"
      />
    </div>
  )
}

const LeaderboardPodium = React.forwardRef<HTMLDivElement, LeaderboardPodiumProps>(
  ({ rankings, className, ...props }, ref) => {
    const sorted = React.useMemo(
      () =>
        [...rankings]
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 3),
      [rankings],
    )

    const byRank = (rank: number) => sorted.find((r) => r.rank === rank)
    const first = byRank(1)

    return (
      <div
        ref={ref}
        role="list"
        aria-label="Peringkat teratas"
        className={cn("grid grid-cols-3 items-end gap-3", className)}
        {...props}
      >
        {sorted.length === 0 ? (
          <div className="col-span-3 py-8 text-center text-sm text-muted-foreground">
            Belum ada data peringkat
          </div>
        ) : (
          <>
            <PodiumSlot ranking={byRank(2)} size="md" />
            <PodiumSlot ranking={first} size="lg" />
            <PodiumSlot ranking={byRank(3)} size="sm" />
          </>
        )}
      </div>
    )
  },
)
LeaderboardPodium.displayName = "LeaderboardPodium"

export { LeaderboardPodium }
export type { LeaderboardPodiumProps }
