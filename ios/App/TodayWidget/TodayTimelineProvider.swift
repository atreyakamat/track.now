import WidgetKit
import SwiftUI

public struct WidgetItemEntry: Identifiable, Decodable {
    public let id: String
    public let title: String
    public let type: String
    public let priority: String
    public let time: String?
    public let overdue: Bool?
    public let planTitle: String?
}

public struct WidgetProgressEntry: Decodable {
    public let total: Int
    public let done: Int
    public let percent: Int
    public let activeStreakDays: Int
}

public struct TodayWidgetPayload: Decodable {
    public let version: Int
    public let lastUpdated: String
    public let progress: WidgetProgressEntry
    public let items: [WidgetItemEntry]
}

public struct TodayEntry: TimelineEntry {
    public let date: Date
    public let payload: TodayWidgetPayload?
}

public struct TodayTimelineProvider: TimelineProvider {
    private let appGroupId = "group.dev.atreyakamat.tracknow"
    private let payloadKey = "tracknow_widget_data"

    public init() {}

    public func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), payload: fallbackPayload())
    }

    public func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        let entry = TodayEntry(date: Date(), payload: loadPayload() ?? fallbackPayload())
        completion(entry)
    }

    public func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let currentDate = Date()
        let payload = loadPayload()
        let entry = TodayEntry(date: currentDate, payload: payload)

        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: currentDate) ?? currentDate
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadPayload() -> TodayWidgetPayload? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupId),
              let jsonString = sharedDefaults.string(forKey: payloadKey),
              let data = jsonString.data(using: .utf8) else {
            return nil
        }

        let decoder = JSONDecoder()
        return try? decoder.decode(TodayWidgetPayload.self, from: data)
    }

    private func fallbackPayload() -> TodayWidgetPayload {
        TodayWidgetPayload(
            version: 1,
            lastUpdated: ISO8601DateFormatter().string(from: Date()),
            progress: WidgetProgressEntry(total: 4, done: 2, percent: 50, activeStreakDays: 5),
            items: [
                WidgetItemEntry(id: "1", title: "Morning 5km Run", type: "habit", priority: "high", time: "08:00", overdue: false, planTitle: "Fitness"),
                WidgetItemEntry(id: "2", title: "Review Pull Requests", type: "task", priority: "medium", time: "11:00", overdue: false, planTitle: "Career")
            ]
        )
    }
}
