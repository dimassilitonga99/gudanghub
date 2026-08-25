import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface LeaderboardRankingItem {
  userId: string
  rank: number
  userName: string
  byline?: string
  value: number
  displayed?: boolean
}

interface LeaderboardRankingsProps {
  rankings: LeaderboardRankingItem[]
  currentUserId?: string
  className?: string
  showPagination?: boolean
  defaultPageSize?: number
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) return "?"
  return parts.map((p) => p.charAt(0).toUpperCase()).join("")
}

const LeaderboardRankings = React.forwardRef<HTMLDivElement, LeaderboardRankingsProps>(
  (
    {
      rankings,
      currentUserId,
      className,
      showPagination = false,
      defaultPageSize = 10,
    },
    ref,
  ) => {
    const sorted = React.useMemo(
      () => [...rankings].sort((a, b) => a.rank - b.rank),
      [rankings],
    )

    const pageSize = Math.max(1, defaultPageSize)
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
    const [page, setPage] = React.useState(1)

    React.useEffect(() => {
      setPage(1)
    }, [rankings])

    const safePage = Math.min(page, totalPages)
    const visible = showPagination
      ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
      : sorted

    if (sorted.length === 0) {
      return (
        <div
          ref={ref}
          className={cn("py-6 text-center text-sm text-muted-foreground", className)}
        >
          Belum ada data peringkat
        </div>
      )
    }

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        <ul role="list" className="space-y-2">
          {visible.map((item) => {
            const isCurrentUser = Boolean(currentUserId) && item.userId === currentUserId
            return (
              <li key={item.userId}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    isCurrentUser
                      ? "border-brand/40 bg-brand/10"
                      : "hover:bg-accent/60",
                    item.displayed === false && "opacity-50 saturate-0",
                  )}
                >
                  <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-muted-foreground tabular-nums">
                    {item.rank}
                  </span>

                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isCurrentUser ? "bg-brand text-white" : "bg-primary/15 text-primary",
                    )}
                  >
                    {getInitials(item.userName)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {item.userName}
                      {isCurrentUser && (
                        <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-brand">
                          Anda
                        </span>
                      )}
                    </p>
                    {item.byline && (
                      <p className="truncate text-xs text-muted-foreground">{item.byline}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {item.value.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      pesanan
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {showPagination && totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Halaman {safePage} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Berikutnya
            </Button>
          </div>
        )}
      </div>
    )
  },
)
LeaderboardRankings.displayName = "LeaderboardRankings"

export { LeaderboardRankings }
export type { LeaderboardRankingsProps }
