import { useEffect, useRef, useState } from 'react'
import { generateHeatmapMatrix, type HeatmapCell, type HeatmapMatrix } from '@/domain/streaks'

const parseCellDate = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const pluralCompletions = (count: number) => `${count} completion${count === 1 ? '' : 's'}`

/** Long date for assistive text, including the year, e.g. "Mon, 12 Oct 2026". */
export function formatHeatmapDate(date: string, locale?: string): string {
  return parseCellDate(date).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Count text for one past/present day, e.g. "3 completions" or "No completions (not scheduled)". */
export function formatHeatmapCount(cell: HeatmapCell): string {
  const unscheduled = cell.isScheduled === false ? ' (not scheduled)' : ''
  return `${cell.count === 0 ? 'No completions' : pluralCompletions(cell.count)}${unscheduled}`
}

/** Past and present days in chronological order — the rows of the accessible table. */
export function heatmapAccessibleDays(matrix: HeatmapMatrix): HeatmapCell[] {
  const days: HeatmapCell[] = []
  for (const week of matrix.weeks) {
    for (const cell of week.days) {
      if (cell && !cell.isFuture) days.push(cell)
    }
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

interface CalendarHeatmapProps {
  dailyCounts: Record<string, number>
  weeksCount?: number
  now?: Date
  schedule?: { frequency?: string; days_of_week?: number[] | null } | null
  title?: string
  subtitle?: string
}

export function CalendarHeatmap({
  dailyCounts,
  weeksCount = 12,
  now = new Date(),
  schedule,
  title,
  subtitle,
}: CalendarHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // On narrow screens the grid scrolls horizontally; start at the most recent weeks.
  useEffect(() => {
    const el = scrollRef.current
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth
  }, [weeksCount])

  const matrix: HeatmapMatrix = generateHeatmapMatrix(dailyCounts, now, weeksCount, schedule)

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  // Colors adapted to theme tokens with graceful CSS fallbacks
  const getCellBg = (level: 0 | 1 | 2 | 3 | 4, isFuture: boolean): string => {
    if (isFuture) return 'transparent'
    switch (level) {
      case 0:
        return 'var(--surface-muted)'
      case 1:
        return 'rgba(200, 241, 105, 0.35)'
      case 2:
        return 'rgba(200, 241, 105, 0.60)'
      case 3:
        return 'rgba(200, 241, 105, 0.85)'
      case 4:
        return 'var(--accent-primary, #c8f169)'
    }
  }

  const formatTooltip = (cell: HeatmapCell): string => {
    const dateStr = parseCellDate(cell.date).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (cell.isFuture) return `${dateStr} (Upcoming)`
    if (cell.count === 0) return `${dateStr}: No completions`
    return `${dateStr}: ${cell.count} completion${cell.count > 1 ? 's' : ''}`
  }

  return (
    <div
      className="card heatmap-container"
      style={{
        padding: 'var(--space-4)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-3)',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div>
          {title && <h3 className="t-h3" style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>}
          {subtitle && (
            <p className="t-meta" style={{ margin: 0, color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="row" style={{ gap: 'var(--space-3)', fontSize: 'var(--text-caption)' }}>
          <span className="t-meta">
            <strong>{matrix.totalCompletions}</strong> completions
          </span>
          <span className="t-meta">
            <strong>{matrix.activeDays}</strong> active days
          </span>
        </div>
      </div>

      {/* Text alternative for assistive technology; the visual grid itself is decorative. */}
      <p className="sr-only">
        {`Last ${weeksCount} weeks: ${matrix.totalCompletions} completion${matrix.totalCompletions === 1 ? '' : 's'} on ${matrix.activeDays} active day${matrix.activeDays === 1 ? '' : 's'}${matrix.maxDailyCount > 0 ? `, busiest day had ${matrix.maxDailyCount}` : ''}.`}
      </p>
      {/* Per-day details (hover-only in the visual grid) exposed as a table for screen readers. */}
      <div className="sr-only">
        <table>
          <caption>{`${title ? `${title}: ` : ''}completions per day, last ${weeksCount} weeks`}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Completions</th>
            </tr>
          </thead>
          <tbody>
            {heatmapAccessibleDays(matrix).map((cell) => {
              const dateLabel = formatHeatmapDate(cell.date)
              return (
                <tr key={cell.date}>
                  <th scope="row">{cell.isToday ? `${dateLabel} (today)` : dateLabel}</th>
                  <td>{formatHeatmapCount(cell)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div
        ref={scrollRef}
        aria-hidden="true"
        style={{
          width: '100%',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'thin',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            gap: '6px',
            alignItems: 'flex-start',
            minWidth: 'max-content',
          }}
        >
          {/* Day of Week Labels Column */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'repeat(7, 12px)',
              gap: '3px',
              paddingTop: '2px',
              marginRight: '4px',
            }}
          >
            {dayLabels.map((lbl, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '9px',
                  lineHeight: '12px',
                  color: 'var(--text-secondary)',
                  textAlign: 'right',
                  height: '12px',
                }}
              >
                {lbl}
              </span>
            ))}
          </div>

          {/* Weeks Columns */}
          {matrix.weeks.map((week) => (
            <div
              key={week.weekIndex}
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(7, 12px)',
                gap: '3px',
              }}
            >
              {week.days.map((cell, dayIdx) => {
                if (!cell) {
                  return (
                    <div
                      key={dayIdx}
                      style={{
                        width: '12px',
                        height: '12px',
                        visibility: 'hidden',
                      }}
                    />
                  )
                }

                const isHovered = hoveredCell?.date === cell.date

                return (
                  <div
                    key={cell.date}
                    title={formatTooltip(cell)}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      background: getCellBg(cell.level, cell.isFuture),
                      border: cell.isToday
                        ? '1px solid var(--text-primary)'
                        : isHovered
                        ? '1px solid var(--text-primary)'
                        : '1px solid transparent',
                      // Cells are not interactive; details are in the hover readout and the sr-only table.
                      cursor: 'default',
                      transition: 'transform 0.1s ease, border-color 0.1s ease',
                      transform: isHovered ? 'scale(1.2)' : 'none',
                      zIndex: isHovered ? 2 : 1,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Legend / Active Cell Details */}
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--space-3)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ minHeight: '16px' }}>
          {hoveredCell ? (
            <span>{formatTooltip(hoveredCell)}</span>
          ) : (
            <span>Rolling {weeksCount}-week consistency heatmap</span>
          )}
        </div>

        <div className="row" style={{ gap: '4px', alignItems: 'center' }} aria-hidden="true">
          <span>Less</span>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(0, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(1, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(2, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(3, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(4, false),
            }}
          />
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
