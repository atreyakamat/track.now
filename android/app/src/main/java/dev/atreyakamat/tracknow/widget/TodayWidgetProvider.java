package dev.atreyakamat.tracknow.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native Android Home Screen Widget Provider for Track.now.
 * Displays glanceable today progress, habit streaks, and upcoming tasks.
 */
public class TodayWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_WIDGET_DATA = "tracknow_widget_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager,
                                          int appWidgetId, Bundle newOptions) {
        updateAppWidget(context, appWidgetManager, appWidgetId);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if ("dev.atreyakamat.tracknow.ACTION_REFRESH_WIDGET".equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, TodayWidgetProvider.class);
            int[] allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            for (int widgetId : allWidgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId);
            }
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        boolean isSmall = minWidth < 180;

        String packageName = context.getPackageName();
        int layoutId = isSmall
                ? context.getResources().getIdentifier("widget_today_small", "layout", packageName)
                : context.getResources().getIdentifier("widget_today_medium", "layout", packageName);

        if (layoutId == 0) return;

        RemoteViews views = new RemoteViews(packageName, layoutId);

        // PendingIntent to launch app into today's queue
        Intent launchIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://trackapp.atreyakamat.dev/today"));
        launchIntent.setPackage(context.getPackageName());
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (isSmall) {
            int rootId = context.getResources().getIdentifier("widget_small_root", "id", packageName);
            if (rootId != 0) views.setOnClickPendingIntent(rootId, pendingIntent);
        } else {
            int rootId = context.getResources().getIdentifier("widget_medium_root", "id", packageName);
            if (rootId != 0) views.setOnClickPendingIntent(rootId, pendingIntent);
        }

        // Read cached widget payload
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawJson = prefs.getString(KEY_WIDGET_DATA, null);

        if (rawJson == null || rawJson.trim().isEmpty()) {
            populateFallback(context, views, isSmall);
        } else {
            populateFromPayload(context, views, rawJson, isSmall);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static void populateFallback(Context context, RemoteViews views, boolean isSmall) {
        String pkg = context.getPackageName();
        if (isSmall) {
            int countId = context.getResources().getIdentifier("widget_progress_count", "id", pkg);
            int percentId = context.getResources().getIdentifier("widget_progress_percent", "id", pkg);
            int nextId = context.getResources().getIdentifier("widget_next_task", "id", pkg);
            int streakId = context.getResources().getIdentifier("widget_streak", "id", pkg);

            if (countId != 0) views.setTextViewText(countId, "0 / 0");
            if (percentId != 0) views.setTextViewText(percentId, "Open to sync");
            if (nextId != 0) views.setTextViewText(nextId, "Tap to launch Track.now");
            if (streakId != 0) views.setTextViewText(streakId, "🔥 0d");
        } else {
            int progId = context.getResources().getIdentifier("widget_medium_progress", "id", pkg);
            int streakId = context.getResources().getIdentifier("widget_medium_streak", "id", pkg);
            int item1Text = context.getResources().getIdentifier("widget_item_1_text", "id", pkg);

            if (progId != 0) views.setTextViewText(progId, "Open Track.now to sync today's items");
            if (streakId != 0) views.setTextViewText(streakId, "🔥 0d");
            if (item1Text != 0) views.setTextViewText(item1Text, "Ready to start executing today");
        }
    }

    private static void populateFromPayload(Context context, RemoteViews views, String rawJson, boolean isSmall) {
        String pkg = context.getPackageName();
        try {
            JSONObject data = new JSONObject(rawJson);
            JSONObject progress = data.optJSONObject("progress");
            int total = progress != null ? progress.optInt("total", 0) : 0;
            int done = progress != null ? progress.optInt("done", 0) : 0;
            int percent = progress != null ? progress.optInt("percent", 0) : 0;
            int streak = progress != null ? progress.optInt("activeStreakDays", 0) : 0;

            JSONArray items = data.optJSONArray("items");

            if (isSmall) {
                int countId = context.getResources().getIdentifier("widget_progress_count", "id", pkg);
                int percentId = context.getResources().getIdentifier("widget_progress_percent", "id", pkg);
                int nextId = context.getResources().getIdentifier("widget_next_task", "id", pkg);
                int streakId = context.getResources().getIdentifier("widget_streak", "id", pkg);

                if (countId != 0) views.setTextViewText(countId, done + " / " + total);
                if (percentId != 0) views.setTextViewText(percentId, percent + "% Completed");
                if (streakId != 0) views.setTextViewText(streakId, "🔥 " + streak + "d");

                if (nextId != 0) {
                    if (items != null && items.length() > 0) {
                        JSONObject first = items.getJSONObject(0);
                        views.setTextViewText(nextId, first.optString("title", "Next item"));
                    } else {
                        views.setTextViewText(nextId, "All done for today! 🎉");
                    }
                }
            } else {
                int progId = context.getResources().getIdentifier("widget_medium_progress", "id", pkg);
                int streakId = context.getResources().getIdentifier("widget_medium_streak", "id", pkg);
                int timeId = context.getResources().getIdentifier("widget_medium_timestamp", "id", pkg);

                if (progId != 0) views.setTextViewText(progId, done + " of " + total + " completed (" + percent + "%)");
                if (streakId != 0) views.setTextViewText(streakId, "🔥 " + streak + "d streak");
                if (timeId != 0) {
                    String lastUpdated = data.optString("lastUpdated", "");
                    if (lastUpdated.length() >= 16) {
                        views.setTextViewText(timeId, "Updated " + lastUpdated.substring(11, 16));
                    }
                }

                // Populate up to 3 items
                int[] textIds = {
                        context.getResources().getIdentifier("widget_item_1_text", "id", pkg),
                        context.getResources().getIdentifier("widget_item_2_text", "id", pkg),
                        context.getResources().getIdentifier("widget_item_3_text", "id", pkg)
                };
                int[] tagIds = {
                        context.getResources().getIdentifier("widget_item_1_tag", "id", pkg),
                        context.getResources().getIdentifier("widget_item_2_tag", "id", pkg),
                        context.getResources().getIdentifier("widget_item_3_tag", "id", pkg)
                };
                int[] rowIds = {
                        context.getResources().getIdentifier("widget_item_1", "id", pkg),
                        context.getResources().getIdentifier("widget_item_2", "id", pkg),
                        context.getResources().getIdentifier("widget_item_3", "id", pkg)
                };

                int itemCount = items != null ? items.length() : 0;
                for (int i = 0; i < 3; i++) {
                    if (i < itemCount) {
                        JSONObject it = items.getJSONObject(i);
                        if (textIds[i] != 0) views.setTextViewText(textIds[i], it.optString("title", "Task"));
                        if (tagIds[i] != 0) {
                            boolean overdue = it.optBoolean("overdue", false);
                            String time = it.optString("time", "");
                            if (overdue) {
                                views.setTextViewText(tagIds[i], "OVERDUE");
                                views.setTextColor(tagIds[i], 0xFFEF4444);
                            } else if (!time.isEmpty()) {
                                views.setTextViewText(tagIds[i], time);
                                views.setTextColor(tagIds[i], 0xFF888888);
                            } else {
                                views.setTextViewText(tagIds[i], it.optString("type", "task").toUpperCase());
                                views.setTextColor(tagIds[i], 0xFF888888);
                            }
                        }
                        if (rowIds[i] != 0) views.setViewVisibility(rowIds[i], View.VISIBLE);
                    } else {
                        if (rowIds[i] != 0) views.setViewVisibility(rowIds[i], View.GONE);
                    }
                }
            }
        } catch (Exception e) {
            populateFallback(context, views, isSmall);
        }
    }
}
