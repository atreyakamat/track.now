import WidgetKit
import SwiftUI

@main
public struct TrackNowWidgetBundle: WidgetBundle {
    public init() {}

    public var body: some Widget {
        TodayWidget()
    }
}

public struct TodayWidget: Widget {
    public let kind: String = "dev.atreyakamat.tracknow.TodayWidget"

    public init() {}

    public var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayTimelineProvider()) { entry in
            TodayWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today's Execution")
        .description("Quickly monitor your daily progress and upcoming habit streaks.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
