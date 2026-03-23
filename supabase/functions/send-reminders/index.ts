import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  "mailto:admin@ledgr.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function sendPush(subscription: object, title: string, body: string) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
  } catch (err) {
    console.error("Push failed:", err);
  }
}

async function alreadySent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  referenceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("reminder_log")
    .select("id")
    .eq("user_id", userId)
    .eq("reference_id", referenceId)
    .maybeSingle();
  return !!data;
}

async function logReminder(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  reminderType: string,
  referenceId: string,
  scheduledFor: string
) {
  await supabase.from("reminder_log").insert({
    user_id: userId,
    reminder_type: reminderType,
    reference_id: referenceId,
    scheduled_for: scheduledFor,
  });
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription");

  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ sent: [] }), { status: 200 });
  }

  const sent: string[] = [];

  for (const { user_id, subscription } of subscriptions) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("notifications_enabled, eod_reminder_time")
      .eq("id", user_id)
      .maybeSingle();

    if (!profile?.notifications_enabled) continue;

    // ── Appointment reminders ─────────────────────────────────────────────
    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, scheduled_at")
      .eq("user_id", user_id)
      .eq("completed", false)
      .not("scheduled_at", "is", null);

    for (const appt of appointments ?? []) {
      const apptTime = new Date(appt.scheduled_at);
      const diffMin = (apptTime.getTime() - now.getTime()) / 60000;

      // 30-min pre-appointment reminder
      if (diffMin >= 25 && diffMin < 35) {
        const ref = `pre_${appt.id}`;
        if (!(await alreadySent(supabase, user_id, ref))) {
          await sendPush(
            subscription,
            "Upcoming Appointment",
            "Your next appointment starts in 30 minutes — get ready!"
          );
          await logReminder(supabase, user_id, "pre_appointment", ref, apptTime.toISOString());
          sent.push(ref);
        }
      }

      // Start-time reminder
      if (diffMin >= -5 && diffMin < 5) {
        const ref = `start_${appt.id}`;
        if (!(await alreadySent(supabase, user_id, ref))) {
          await sendPush(
            subscription,
            "Appointment Starting",
            "Your appointment just started — don't forget to start your timer or log this cut!"
          );
          await logReminder(supabase, user_id, "appointment_start", ref, apptTime.toISOString());
          sent.push(ref);
        }
      }
    }

    // ── EOD reminder ──────────────────────────────────────────────────────
    if (profile.eod_reminder_time) {
      const [eodH, eodM] = profile.eod_reminder_time.split(":").map(Number);
      const eodTime = new Date(`${today}T${String(eodH).padStart(2, "0")}:${String(eodM).padStart(2, "0")}:00`);
      const eodDiff = Math.abs((eodTime.getTime() - now.getTime()) / 60000);

      if (eodDiff < 5) {
        const ref = `eod_${today}_${user_id}`;
        if (!(await alreadySent(supabase, user_id, ref))) {
          await sendPush(
            subscription,
            "End of Day",
            "End of day — did you log all your cuts today?"
          );
          await logReminder(supabase, user_id, "eod", ref, eodTime.toISOString());
          sent.push(ref);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
