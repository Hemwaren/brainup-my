import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

// ─── Token Management ─────────────────────────────────────────────────────────

async function getValidToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_integrations")
    .select("access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (!data) return null;

  // Check if token is still valid (with 5 min buffer)
  const expiry = new Date(data.token_expiry);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiry.getTime() - now.getTime() > bufferMs) {
    // Token still valid
    return data.access_token;
  }

  // Token expired — refresh it
  if (!data.refresh_token) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await res.json();
    if (!res.ok) return null;

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Save refreshed token
    await supabaseAdmin
      .from("user_integrations")
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "google");

    return tokens.access_token;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarSignals {
  meeting_hours_this_week: number;
  meeting_hours_last_week: number;
  after_hours_meetings: number;
  back_to_back_meetings: number;
  focus_time_ratio: number; // 0-1, higher = more free time
  signal: "BALANCED" | "MODERATE" | "OVERLOADED" | "NO_DATA";
  score: number; // 0-100
}

export interface GmailSignals {
  emails_sent_this_week: number;
  emails_sent_last_week: number;
  after_hours_emails: number;
  avg_response_time_hours: number;
  volume_delta: number;
  signal: "NORMAL" | "ELEVATED" | "HIGH_VOLUME" | "NO_DATA";
  score: number; // 0-100
}

// ─── Calendar Signals ─────────────────────────────────────────────────────────

export async function fetchCalendarSignals(
  userId: string
): Promise<CalendarSignals> {
  const NO_DATA: CalendarSignals = {
    meeting_hours_this_week: 0,
    meeting_hours_last_week: 0,
    after_hours_meetings: 0,
    back_to_back_meetings: 0,
    focus_time_ratio: 1,
    signal: "NO_DATA",
    score: 50,
  };

  const token = await getValidToken(userId);
  if (!token) return NO_DATA;

  try {
    const now = new Date();

    // This week: Mon to now
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - now.getDay() + 1);
    thisMonday.setHours(0, 0, 0, 0);

    // Last week: Mon to Sun
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setMilliseconds(-1);

    // Fetch this week's events
    const [thisWeekRes, lastWeekRes] = await Promise.all([
      fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin: thisMonday.toISOString(),
          timeMax: now.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
        }),
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin: lastMonday.toISOString(),
          timeMax: lastSunday.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
        }),
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    ]);

    if (!thisWeekRes.ok) return NO_DATA;

    const thisWeekData = await thisWeekRes.json();
    const lastWeekData = lastWeekRes.ok ? await lastWeekRes.json() : { items: [] };

    const thisEvents = (thisWeekData.items ?? []).filter(
      (e: any) => e.status !== "cancelled" && e.start?.dateTime
    );
    const lastEvents = (lastWeekData.items ?? []).filter(
      (e: any) => e.status !== "cancelled" && e.start?.dateTime
    );

    // Compute meeting hours
    function totalHours(events: any[]): number {
      return events.reduce((sum, e) => {
        const start = new Date(e.start.dateTime).getTime();
        const end = new Date(e.end?.dateTime ?? e.start.dateTime).getTime();
        return sum + (end - start) / 3_600_000;
      }, 0);
    }

    // After hours = before 9am or after 6pm
    function countAfterHours(events: any[]): number {
      return events.filter(e => {
        const hour = new Date(e.start.dateTime).getHours();
        return hour < 9 || hour >= 18;
      }).length;
    }

    // Back to back = next meeting starts within 5 mins of previous ending
    function countBackToBack(events: any[]): number {
      let count = 0;
      const sorted = [...events].sort(
        (a, b) =>
          new Date(a.start.dateTime).getTime() -
          new Date(b.start.dateTime).getTime()
      );
      for (let i = 1; i < sorted.length; i++) {
        const prevEnd = new Date(sorted[i - 1].end?.dateTime ?? sorted[i - 1].start.dateTime).getTime();
        const nextStart = new Date(sorted[i].start.dateTime).getTime();
        if (nextStart - prevEnd <= 5 * 60 * 1000) count++;
      }
      return count;
    }

    const meetingHoursTW = Math.round(totalHours(thisEvents) * 10) / 10;
    const meetingHoursLW = Math.round(totalHours(lastEvents) * 10) / 10;
    const afterHours = countAfterHours(thisEvents);
    const backToBack = countBackToBack(thisEvents);

    // Focus time ratio: assume 40 work hours/week, meeting time reduces focus
    const workDaysSoFar = Math.max(1, now.getDay() === 0 ? 5 : now.getDay());
    const availableHours = workDaysSoFar * 8;
    const focusRatio = Math.max(0, (availableHours - meetingHoursTW) / availableHours);

    // Signal
    const signal =
      meetingHoursTW === 0 && thisEvents.length === 0 ? "NO_DATA"
      : meetingHoursTW >= 30 || afterHours >= 3 ? "OVERLOADED"
      : meetingHoursTW >= 15 || afterHours >= 1 ? "MODERATE"
      : "BALANCED";

    // Score (higher = healthier)
    let score = 100;
    score -= Math.min(40, meetingHoursTW * 1.5);  // penalise heavy meetings
    score -= afterHours * 8;                        // penalise after hours
    score -= backToBack * 5;                        // penalise back to back
    score += focusRatio * 20;                       // reward focus time
    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      meeting_hours_this_week: meetingHoursTW,
      meeting_hours_last_week: meetingHoursLW,
      after_hours_meetings: afterHours,
      back_to_back_meetings: backToBack,
      focus_time_ratio: Math.round(focusRatio * 100) / 100,
      signal,
      score: signal === "NO_DATA" ? 50 : score,
    };
  } catch {
    return NO_DATA;
  }
}

// ─── Gmail Signals ────────────────────────────────────────────────────────────

export async function fetchGmailSignals(
  userId: string
): Promise<GmailSignals> {
  const NO_DATA: GmailSignals = {
    emails_sent_this_week: 0,
    emails_sent_last_week: 0,
    after_hours_emails: 0,
    avg_response_time_hours: 0,
    volume_delta: 0,
    signal: "NO_DATA",
    score: 50,
  };

  const token = await getValidToken(userId);
  if (!token) return NO_DATA;

  try {
    const now = new Date();

    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - now.getDay() + 1);
    thisMonday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setMilliseconds(-1);

    // Gmail uses epoch seconds for after:/ before: queries
    const thisMondaySec = Math.floor(thisMonday.getTime() / 1000);
    const lastMondaySec = Math.floor(lastMonday.getTime() / 1000);
    const lastSundaySec = Math.floor(lastSunday.getTime() / 1000);

    // Fetch sent emails — this week and last week
    const [thisWeekRes, lastWeekRes] = await Promise.all([
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
        new URLSearchParams({
          q: `in:sent after:${thisMondaySec}`,
          maxResults: "100",
        }),
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
        new URLSearchParams({
          q: `in:sent after:${lastMondaySec} before:${lastSundaySec}`,
          maxResults: "100",
        }),
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    ]);

    if (!thisWeekRes.ok) return NO_DATA;

    const thisWeekData = await thisWeekRes.json();
    const lastWeekData = lastWeekRes.ok ? await lastWeekRes.json() : { messages: [] };

    const sentThisWeek = (thisWeekData.messages ?? []).length;
    const sentLastWeek = (lastWeekData.messages ?? []).length;
    const volumeDelta = sentThisWeek - sentLastWeek;

    // Fetch message details for after-hours detection
    // Only fetch first 20 to avoid rate limits
    const messageIds = (thisWeekData.messages ?? []).slice(0, 20);

    let afterHoursCount = 0;
    let responseTimes: number[] = [];

    if (messageIds.length > 0) {
      const detailResults = await Promise.allSettled(
        messageIds.map((m: any) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json())
        )
      );

      for (const result of detailResults) {
        if (result.status !== "fulfilled") continue;
        const msg = result.value;
        const dateHeader = msg.payload?.headers?.find(
          (h: any) => h.name === "Date"
        );
        if (!dateHeader) continue;

        const sentDate = new Date(dateHeader.value);
        const hour = sentDate.getHours();
        if (hour < 9 || hour >= 18) afterHoursCount++;

        // Simple response time: internalDate vs received estimate
        if (msg.internalDate) {
          const sentMs = parseInt(msg.internalDate);
          const hourOfDay = new Date(sentMs).getHours();
          // Flag late-night emails as high stress signal
          if (hourOfDay >= 22 || hourOfDay < 6) {
            responseTimes.push(hourOfDay); // use as proxy
          }
        }
      }
    }

    // Signal
    const signal =
      sentThisWeek === 0 ? "NO_DATA"
      : sentThisWeek >= 80 || afterHoursCount >= 5 ? "HIGH_VOLUME"
      : sentThisWeek >= 40 || afterHoursCount >= 2 ? "ELEVATED"
      : "NORMAL";

    // Score (higher = healthier)
    let score = 100;
    score -= Math.min(30, sentThisWeek * 0.3);   // penalise high volume
    score -= afterHoursCount * 6;                  // penalise after hours
    if (volumeDelta > 20) score -= 15;             // penalise sudden spike
    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      emails_sent_this_week: sentThisWeek,
      emails_sent_last_week: sentLastWeek,
      after_hours_emails: afterHoursCount,
      avg_response_time_hours: 0,
      volume_delta: volumeDelta,
      signal,
      score: signal === "NO_DATA" ? 50 : score,
    };
  } catch {
    return NO_DATA;
  }
}

// ─── Mock fallback for employees without Google connected ─────────────────────

export function getMockCalendarSignals(userId: string): CalendarSignals {
  // Deterministic mock based on userId so same employee always gets same data
  const seed = userId.charCodeAt(0) + userId.charCodeAt(1);
  const meetingHours = 10 + (seed % 25); // 10-35 hours
  const afterHours = seed % 4;
  const backToBack = seed % 3;
  const focusRatio = Math.max(0.1, 1 - meetingHours / 40);

  const signal =
    meetingHours >= 30 ? "OVERLOADED"
    : meetingHours >= 15 ? "MODERATE"
    : "BALANCED";

  let score = 100;
  score -= Math.min(40, meetingHours * 1.5);
  score -= afterHours * 8;
  score -= backToBack * 5;
  score += focusRatio * 20;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    meeting_hours_this_week: meetingHours,
    meeting_hours_last_week: meetingHours - 2 + (seed % 5),
    after_hours_meetings: afterHours,
    back_to_back_meetings: backToBack,
    focus_time_ratio: Math.round(focusRatio * 100) / 100,
    signal,
    score,
  };
}

export function getMockGmailSignals(userId: string): GmailSignals {
  const seed = userId.charCodeAt(0) + userId.charCodeAt(2);
  const sentThisWeek = 15 + (seed % 60); // 15-75 emails
  const sentLastWeek = sentThisWeek - 5 + (seed % 10);
  const afterHours = seed % 5;
  const volumeDelta = sentThisWeek - sentLastWeek;

  const signal =
    sentThisWeek >= 80 ? "HIGH_VOLUME"
    : sentThisWeek >= 40 ? "ELEVATED"
    : "NORMAL";

  let score = 100;
  score -= Math.min(30, sentThisWeek * 0.3);
  score -= afterHours * 6;
  if (volumeDelta > 20) score -= 15;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    emails_sent_this_week: sentThisWeek,
    emails_sent_last_week: sentLastWeek,
    after_hours_emails: afterHours,
    avg_response_time_hours: 0,
    volume_delta: volumeDelta,
    signal,
    score,
  };
}