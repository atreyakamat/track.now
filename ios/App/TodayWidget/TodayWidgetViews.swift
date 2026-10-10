import WidgetKit
import SwiftUI

public struct TodayWidgetSmallView: View {
    let payload: TodayWidgetPayload?

    private var accentColor: Color { Color(red: 200/255, green: 241/255, blue: 105/255) }
    private var darkBg: Color { Color(red: 20/255, green: 20/255, blue: 22/255) }

    public var body: some View {
        let progress = payload?.progress
        let total = progress?.total ?? 0
        let done = progress?.done ?? 0
        let percent = progress?.percent ?? 0
        let streak = progress?.activeStreakDays ?? 0
        let nextTask = payload?.items.first?.title ?? "All tasks done 🎉"

        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("TRACK.NOW")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(accentColor)
                    .tracking(1.0)
                Spacer()
                Text("🔥 \(streak)d")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
            }

            Spacer()

            VStack(alignment: .center, spacing: 2) {
                Text("\(done) / \(total)")
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                Text("\(percent)% Done")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color.gray)
            }
            .frame(maxWidth: .infinity)

            Spacer()

            VStack(alignment: .leading, spacing: 2) {
                Text("NEXT UP")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(accentColor)
                Text(nextTask)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }
        }
        .padding(12)
        .background(darkBg)
    }
}

public struct TodayWidgetMediumView: View {
    let payload: TodayWidgetPayload?

    private var accentColor: Color { Color(red: 200/255, green: 241/255, blue: 105/255) }
    private var darkBg: Color { Color(red: 20/255, green: 20/255, blue: 22/255) }

    public var body: some View {
        let progress = payload?.progress
        let total = progress?.total ?? 0
        let done = progress?.done ?? 0
        let percent = progress?.percent ?? 0
        let streak = progress?.activeStreakDays ?? 0
        let items = payload?.items ?? []

        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("TRACK.NOW · TODAY")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(accentColor)
                    .tracking(0.8)
                Spacer()
                Text("🔥 \(streak)d streak")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
            }

            // Progress bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("\(done) of \(total) completed (\(percent)%)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Color.gray)
                    Spacer()
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(white: 0.2))
                            .frame(height: 5)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(accentColor)
                            .frame(width: geo.size.width * CGFloat(min(1.0, max(0.0, Double(percent) / 100.0))), height: 5)
                    }
                }
                .frame(height: 5)
            }

            // Task list
            VStack(alignment: .leading, spacing: 4) {
                if items.isEmpty {
                    Text("No tasks scheduled for today")
                        .font(.system(size: 12))
                        .foregroundColor(Color.gray)
                        .padding(.top, 4)
                } else {
                    ForEach(items.prefix(3)) { item in
                        HStack(spacing: 6) {
                            Circle()
                                .stroke(accentColor, lineWidth: 1.5)
                                .frame(width: 8, height: 8)
                            Text(item.title)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Spacer()
                            if let isOverdue = item.overdue, isOverdue {
                                Text("OVERDUE")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(Color.red)
                            } else if let time = item.time, !time.isEmpty {
                                Text(time)
                                    .font(.system(size: 10))
                                    .foregroundColor(Color.gray)
                            }
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(darkBg)
    }
}

public struct TodayWidgetEntryView: View {
    var entry: TodayTimelineProvider.Entry
    @Environment(\.widgetFamily) var family

    public var body: some View {
        Group {
            switch family {
            case .systemSmall:
                TodayWidgetSmallView(payload: entry.payload)
            default:
                TodayWidgetMediumView(payload: entry.payload)
            }
        }
        .widgetURL(URL(string: "https://trackapp.atreyakamat.dev/today"))
    }
}
