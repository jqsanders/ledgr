import React, { useState, useEffect } from "react";
import {
  Settings,
  Plus,
  DollarSign,
  Clock,
  TrendingUp,
  Calendar,
  ClipboardList,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./AuthContext";

const storage = {
  get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      return { value };
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  },
};

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function parseCut(cut) {
  const meta = safeJsonParse(cut.notes, {});
  const startMs = new Date(cut.start_time).getTime();
  const endMs = cut.end_time ? new Date(cut.end_time).getTime() : startMs;
  const durationMinutes = Math.floor((endMs - startMs) / 60000);
  return {
    log_ID: cut.id,
    client_name: meta.client_name || "",
    service_type: meta.service_type || "",
    service_start_time: cut.start_time,
    service_end_time: cut.end_time,
    duration_minutes: durationMinutes,
    payout_amount: cut.pay || 0,
    tax_set_aside: meta.tax_set_aside || 0,
    date: cut.start_time.slice(0, 10),
  };
}

function formatAMPM(isoString) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildTimestamp(dateStr, hour, minute, ampm) {
  let h = parseInt(hour, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${minute}:00`).toISOString();
}

function to24h(hour, min, ampm) {
  let h = parseInt(hour, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function to12h(timeStr) {
  if (!timeStr) return { hour: "8", min: "00", ampm: "PM" };
  const [h, m] = timeStr.split(":").map(Number);
  return { hour: String(h % 12 || 12), min: String(m).padStart(2, "0"), ampm: h >= 12 ? "PM" : "AM" };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

const B = {
  bg: "#121212",
  surface: "#1e1e1e",
  gold: "#c4a35d",
  text: "#f5f5f0",
  muted: "#888888",
  border: "#2a2a2a",
  error: "#e05252",
  success: "#4caf7d",
};

export default function LedgrMvp() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [view, setView] = useState("dashboard");
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [historyInterval, setHistoryInterval] = useState("Weekly");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [historicalData, setHistoricalData] = useState(null);

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [clientName, setClientName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentCutId, setCurrentCutId] = useState(null);

  const [showPastCutModal, setShowPastCutModal] = useState(false);
  const [pastCutDate, setPastCutDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [pastCutStartHour, setPastCutStartHour] = useState("9");
  const [pastCutStartMin, setPastCutStartMin] = useState("00");
  const [pastCutStartAmpm, setPastCutStartAmpm] = useState("AM");
  const [pastCutEndHour, setPastCutEndHour] = useState("10");
  const [pastCutEndMin, setPastCutEndMin] = useState("00");
  const [pastCutEndAmpm, setPastCutEndAmpm] = useState("AM");
  const [pastCutServiceType, setPastCutServiceType] = useState("");
  const [pastCutClientName, setPastCutClientName] = useState("");
  const [pastCutPay, setPastCutPay] = useState("");
  const [pastCutSaving, setPastCutSaving] = useState(false);

  const [showPrepModal, setShowPrepModal] = useState(false);
  const [prepClientName, setPrepClientName] = useState("");
  const [prepServiceType, setPrepServiceType] = useState("");
  const [prepTime, setPrepTime] = useState("");

  const [taxRate, setTaxRate] = useState("25");
  const [rentAmount, setRentAmount] = useState("250");
  const [rentFrequency, setRentFrequency] = useState("Weekly");
  const [workingDays, setWorkingDays] = useState("5");

  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [eodReminderHour, setEodReminderHour] = useState("8");
  const [eodReminderMin, setEodReminderMin] = useState("00");
  const [eodReminderAmpm, setEodReminderAmpm] = useState("PM");
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  const serviceTypes = [
    "Haircut", "Color", "Highlights", "Manicure", "Pedicure",
    "Gel Nails", "Beard Trim", "Shave", "Blowout", "Extensions", "Braids", "Other",
  ];

  useEffect(() => {
    if (userId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (view === "history") loadHistoricalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, historyInterval, selectedDate]);

  useEffect(() => {
    let interval;
    if (isTimerRunning && startTime) {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, startTime]);

  const loadData = async () => {
    try {
      // Settings (localStorage)
      const settingsResult = storage.get("ledgr_settings");
      if (settingsResult?.value) {
        const parsed = safeJsonParse(settingsResult.value, null);
        if (parsed) {
          setSettings(parsed);
          setTaxRate(String(parsed.taxRate ?? 25));
          setRentAmount(String(parsed.rentAmount ?? 250));
          setRentFrequency(parsed.rentFrequency ?? "Weekly");
          setWorkingDays(String(parsed.workingDays ?? 5));
        }
      }

      // Appointments (localStorage)
      const today = new Date().toISOString().split("T")[0];
      const apptResult = storage.get("ledgr_appointments_" + today);
      if (apptResult?.value) {
        setAppointments(safeJsonParse(apptResult.value, []));
      }

      // Today's completed cuts from Supabase
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const { data: cuts } = await supabase
        .from("cuts")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", todayStart.toISOString())
        .lt("start_time", todayEnd.toISOString())
        .not("end_time", "is", null)
        .not("pay", "is", null)
        .order("start_time", { ascending: true });

      if (cuts) setLogs(cuts.map(parseCut));

      // Profile — auto-create if missing
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfileDisplayName(profileData.display_name || "");
        const notifOn = profileData.notifications_enabled ?? true;
        setNotificationsEnabled(notifOn);
        const t = to12h(profileData.eod_reminder_time || "20:00");
        setEodReminderHour(t.hour);
        setEodReminderMin(t.min);
        setEodReminderAmpm(t.ampm);
        if (notifOn && "Notification" in window && Notification.permission === "default") {
          setShowNotifPrompt(true);
        }
      } else {
        await supabase.from("profiles").insert({ id: userId });
        if ("Notification" in window && Notification.permission === "default") {
          setShowNotifPrompt(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    if (!settings || !userId) return;
    try {
      const { startDate, endDate } = getDateRange(historyInterval, selectedDate);
      const { data: cuts, error } = await supabase
        .from("cuts")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", startDate.toISOString())
        .lt("start_time", endDate.toISOString())
        .not("end_time", "is", null)
        .not("pay", "is", null)
        .order("start_time", { ascending: true });

      if (error) { setHistoricalData(null); return; }
      setHistoricalData(calculateHistoricalMetrics((cuts || []).map(parseCut)));
    } catch {
      setHistoricalData(null);
    }
  };

  const getDateRange = (interval, referenceDate) => {
    const date = new Date(referenceDate);
    let startDate, endDate;
    if (interval === "Daily") {
      startDate = new Date(date); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 1);
    } else if (interval === "Weekly") {
      startDate = new Date(date); startDate.setDate(date.getDate() - date.getDay()); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 7);
    } else if (interval === "Monthly") {
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    } else if (interval === "Quarterly") {
      const q = Math.floor(date.getMonth() / 3);
      startDate = new Date(date.getFullYear(), q * 3, 1);
      endDate = new Date(date.getFullYear(), q * 3 + 3, 1);
    } else {
      startDate = new Date(date.getFullYear(), 0, 1);
      endDate = new Date(date.getFullYear() + 1, 0, 1);
    }
    return { startDate, endDate };
  };

  const calculateHistoricalMetrics = (logsList) => {
    if (!logsList.length) {
      return { totalRevenue: 0, totalServiceTime: 0, avgMoneyPerHour: 0, totalTaxSetAside: 0, totalRentContribution: 0, totalSetAsides: 0, totalTrueNetIncome: 0, logs: [], daysWorked: 0 };
    }
    const totalRevenue = logsList.reduce((s, l) => s + (l.payout_amount || 0), 0);
    const totalServiceTime = logsList.reduce((s, l) => s + (l.duration_minutes || 0), 0) / 60;
    const avgMoneyPerHour = totalServiceTime > 0 ? totalRevenue / totalServiceTime : 0;
    const totalTaxSetAside = logsList.reduce((s, l) => s + (l.tax_set_aside || 0), 0);
    const uniqueDates = Array.from(new Set(logsList.map((l) => l.date)));
    const daysWorked = uniqueDates.length;
    const dailyRent = settings.rentFrequency === "Weekly"
      ? settings.rentAmount / settings.workingDays
      : settings.rentAmount / (settings.workingDays * 4.33);
    const totalRentContribution = dailyRent * daysWorked;
    const totalSetAsides = totalTaxSetAside + totalRentContribution;
    const totalTrueNetIncome = totalRevenue - totalSetAsides;
    return { totalRevenue, totalServiceTime, avgMoneyPerHour, totalTaxSetAside, totalRentContribution, totalSetAsides, totalTrueNetIncome, logs: logsList, daysWorked };
  };

  const navigateDate = (direction) => {
    const d = new Date(selectedDate);
    if (historyInterval === "Daily") d.setDate(d.getDate() + direction);
    else if (historyInterval === "Weekly") d.setDate(d.getDate() + direction * 7);
    else if (historyInterval === "Monthly") d.setMonth(d.getMonth() + direction);
    else if (historyInterval === "Quarterly") d.setMonth(d.getMonth() + direction * 3);
    else d.setFullYear(d.getFullYear() + direction);
    setSelectedDate(d);
  };

  const getDateRangeLabel = () => {
    const date = selectedDate;
    if (historyInterval === "Daily") {
      return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } else if (historyInterval === "Weekly") {
      const s = new Date(date); s.setDate(date.getDate() - date.getDay());
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return s.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } else if (historyInterval === "Monthly") {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (historyInterval === "Quarterly") {
      return "Q" + (Math.floor(date.getMonth() / 3) + 1) + " " + date.getFullYear();
    }
    return date.getFullYear().toString();
  };

  const saveSettings = async () => {
    const settingsData = {
      taxRate: parseFloat(taxRate),
      rentAmount: parseFloat(rentAmount),
      rentFrequency,
      workingDays: parseInt(workingDays, 10),
    };
    const ok = storage.set("ledgr_settings", JSON.stringify(settingsData));
    if (!ok) { alert("Error saving settings"); return; }

    await supabase.from("profiles").upsert({
      id: userId,
      notifications_enabled: notificationsEnabled,
      eod_reminder_time: to24h(eodReminderHour, eodReminderMin, eodReminderAmpm),
    });

    setSettings(settingsData);
    setView("dashboard");
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: profileDisplayName });
    setProfileSaving(false);
    setProfileMsg(error ? { type: "error", text: error.message } : { type: "success", text: "Profile saved." });
  };

  const addAppointment = async () => {
    if (!prepClientName || !prepServiceType) { alert("Please enter client name and service type"); return; }

    let supabaseId = null;
    if (prepTime) {
      const today = new Date().toISOString().split("T")[0];
      const scheduledAt = new Date(`${today}T${prepTime}:00`).toISOString();
      const { data } = await supabase.from("appointments").insert({
        user_id: userId,
        client_name: prepClientName,
        service_type: prepServiceType,
        scheduled_at: scheduledAt,
      }).select().single();
      supabaseId = data?.id ?? null;
    }

    const newAppt = { id: Date.now().toString(), supabaseId, clientName: prepClientName, serviceType: prepServiceType, scheduledTime: prepTime, completed: false };
    const updated = appointments.concat(newAppt).sort((a, b) => {
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
    setAppointments(updated);
    storage.set("ledgr_appointments_" + new Date().toISOString().split("T")[0], JSON.stringify(updated));
    setPrepClientName(""); setPrepServiceType(""); setPrepTime("");
  };

  const removeAppointment = async (id) => {
    const apt = appointments.find((a) => a.id === id);
    const updated = appointments.filter((a) => a.id !== id);
    setAppointments(updated);
    storage.set("ledgr_appointments_" + new Date().toISOString().split("T")[0], JSON.stringify(updated));
    if (apt?.supabaseId) {
      await supabase.from("appointments").delete().eq("id", apt.supabaseId);
    }
  };

  const openLogModalForAppointment = (apt) => {
    setSelectedAppointment(apt);
    setClientName(apt.clientName);
    setServiceType(apt.serviceType);
    setShowLogModal(true);
  };

  const startTimerFunc = async () => {
    const now = Date.now();
    setStartTime(now);
    setIsTimerRunning(true);

    const { data, error } = await supabase
      .from("cuts")
      .insert({ user_id: userId, start_time: new Date(now).toISOString() })
      .select()
      .single();

    if (error) { alert("Failed to start timer: " + error.message); return; }
    setCurrentCutId(data.id);
  };

  const stopTimerFunc = async () => {
    const now = Date.now();
    setEndTime(now);
    setIsTimerRunning(false);

    if (currentCutId) {
      await supabase
        .from("cuts")
        .update({ end_time: new Date(now).toISOString() })
        .eq("id", currentCutId);
    }
  };

  const logTransaction = async () => {
    if (!clientName || !serviceType || !payoutAmount || !startTime || !endTime || !currentCutId) {
      alert("Please complete all fields");
      return;
    }
    if (!settings) { alert("Please set your settings first"); return; }

    const payout = parseFloat(payoutAmount);
    const taxSetAside = payout * (settings.taxRate / 100);
    const notes = JSON.stringify({ client_name: clientName, service_type: serviceType, tax_set_aside: taxSetAside });

    const { error } = await supabase
      .from("cuts")
      .update({ pay: payout, notes })
      .eq("id", currentCutId);

    if (error) { alert("Failed to log: " + error.message); return; }

    if (selectedAppointment) {
      const today = new Date().toISOString().split("T")[0];
      const updated = appointments.map((a) => a.id === selectedAppointment.id ? { ...a, completed: true } : a);
      setAppointments(updated);
      storage.set("ledgr_appointments_" + today, JSON.stringify(updated));
      if (selectedAppointment.supabaseId) {
        await supabase.from("appointments").update({ completed: true }).eq("id", selectedAppointment.supabaseId);
      }
    }

    // Reload today's cuts
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    const { data: cuts } = await supabase
      .from("cuts").select("*").eq("user_id", userId)
      .gte("start_time", todayStart.toISOString()).lt("start_time", todayEnd.toISOString())
      .not("end_time", "is", null).not("pay", "is", null)
      .order("start_time", { ascending: true });
    if (cuts) setLogs(cuts.map(parseCut));

    resetModal();
  };

  const resetModal = () => {
    setShowLogModal(false);
    setSelectedAppointment(null);
    setClientName(""); setServiceType("");
    setIsTimerRunning(false);
    setStartTime(null); setEndTime(null);
    setPayoutAmount("");
    setElapsedSeconds(0);
    setCurrentCutId(null);
  };

  const resetPastCutModal = () => {
    setShowPastCutModal(false);
    setPastCutDate(new Date().toISOString().split("T")[0]);
    setPastCutStartHour("9"); setPastCutStartMin("00"); setPastCutStartAmpm("AM");
    setPastCutEndHour("10"); setPastCutEndMin("00"); setPastCutEndAmpm("AM");
    setPastCutServiceType(""); setPastCutClientName(""); setPastCutPay("");
  };

  const requestPushPermission = async () => {
    setShowNotifPrompt(false);
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      });
      await supabase.from("push_subscriptions").delete().eq("user_id", userId);
      await supabase.from("push_subscriptions").insert({ user_id: userId, subscription: sub.toJSON() });
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  };

  const savePastCut = async () => {
    if (!pastCutServiceType || !pastCutPay) {
      alert("Please enter service type and pay amount");
      return;
    }
    const startISO = buildTimestamp(pastCutDate, pastCutStartHour, pastCutStartMin, pastCutStartAmpm);
    const endISO = buildTimestamp(pastCutDate, pastCutEndHour, pastCutEndMin, pastCutEndAmpm);
    if (new Date(endISO) <= new Date(startISO)) {
      alert("End time must be after start time");
      return;
    }
    const taxSetAside = parseFloat(pastCutPay) * ((settings?.taxRate ?? 25) / 100);
    const notes = JSON.stringify({ client_name: pastCutClientName, service_type: pastCutServiceType, tax_set_aside: taxSetAside });

    setPastCutSaving(true);
    const { error } = await supabase.from("cuts").insert({
      user_id: userId,
      start_time: startISO,
      end_time: endISO,
      pay: parseFloat(pastCutPay),
      notes,
    });
    setPastCutSaving(false);

    if (error) { alert("Failed to save: " + error.message); return; }

    resetPastCutModal();

    // Refresh dashboard if the logged cut is from today
    const todayStr = new Date().toISOString().split("T")[0];
    if (pastCutDate === todayStr) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
      const { data: cuts } = await supabase
        .from("cuts").select("*").eq("user_id", userId)
        .gte("start_time", todayStart.toISOString()).lt("start_time", todayEnd.toISOString())
        .not("end_time", "is", null).not("pay", "is", null)
        .order("start_time", { ascending: true });
      if (cuts) setLogs(cuts.map(parseCut));
    }
  };

  const calculateMetrics = () => {
    if (!settings || logs.length === 0) return { totalRevenue: 0, totalServiceTime: 0, moneyPerHour: 0, totalTaxSetAside: 0, dailyRent: 0, tdni: 0 };
    const totalRevenue = logs.reduce((s, l) => s + (l.payout_amount || 0), 0);
    const totalServiceTime = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0) / 60;
    const moneyPerHour = totalServiceTime > 0 ? totalRevenue / totalServiceTime : 0;
    const totalTaxSetAside = logs.reduce((s, l) => s + (l.tax_set_aside || 0), 0);
    const dailyRent = settings.rentFrequency === "Weekly"
      ? settings.rentAmount / settings.workingDays
      : settings.rentAmount / (settings.workingDays * 4.33);
    const tdni = totalRevenue - (totalTaxSetAside + dailyRent);
    return { totalRevenue, totalServiceTime, moneyPerHour, totalTaxSetAside, dailyRent, tdni };
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hrs, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: B.bg }}>
        <p style={{ color: B.gold }} className="text-xl">Loading LEDGR…</p>
      </div>
    );
  }

  // ── Settings view ────────────────────────────────────────────────────────
  if (!settings || view === "settings") {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: B.bg, color: B.text }}>
        <div className="max-w-md mx-auto">
          <div className="mb-8 flex items-center gap-4">
            {settings && (
              <button onClick={() => setView("dashboard")} style={{ color: B.muted }}>
                <ChevronLeft size={24} />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-widest" style={{ color: B.gold }}>LEDGR</h1>
              <p className="text-xs" style={{ color: B.muted }}>by The Fade Collective</p>
            </div>
          </div>

          <div className="rounded-lg p-6 space-y-6" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
            <h2 className="text-xl font-semibold" style={{ color: B.gold }}>App Settings</h2>

            {[
              { label: "Estimated Tax Rate (%)", value: taxRate, set: setTaxRate, placeholder: "25" },
              { label: "Rent / Booth Fee ($)", value: rentAmount, set: setRentAmount, placeholder: "250" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>{label}</label>
                <input type="number" value={value} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-lg px-4 py-2 focus:outline-none text-sm"
                  style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                  onFocus={(e) => (e.target.style.borderColor = B.gold)}
                  onBlur={(e) => (e.target.style.borderColor = B.border)}
                  placeholder={placeholder} />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Rent Frequency</label>
              <select value={rentFrequency} onChange={(e) => setRentFrequency(e.target.value)}
                className="w-full rounded-lg px-4 py-2 focus:outline-none text-sm"
                style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>
                Working Days Per {rentFrequency === "Weekly" ? "Week" : "Month"}
              </label>
              <input type="number" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)}
                className="w-full rounded-lg px-4 py-2 focus:outline-none text-sm"
                style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                onFocus={(e) => (e.target.style.borderColor = B.gold)}
                onBlur={(e) => (e.target.style.borderColor = B.border)}
                placeholder="5" />
            </div>

            {/* Notifications section */}
            <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: "1.5rem" }}>
              <h3 className="text-base font-semibold mb-4" style={{ color: B.gold }}>Notifications</h3>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm" style={{ color: B.text }}>Enable reminders</span>
                <button onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className="w-12 h-6 rounded-full transition-colors relative"
                  style={{ backgroundColor: notificationsEnabled ? B.gold : B.border }}>
                  <span className="absolute top-1 w-4 h-4 rounded-full transition-all"
                    style={{ backgroundColor: B.bg, left: notificationsEnabled ? "calc(100% - 1.25rem)" : "0.25rem" }} />
                </button>
              </div>

              {notificationsEnabled && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>End of day reminder</label>
                  <div className="flex gap-2 items-center">
                    <select value={eodReminderHour} onChange={(e) => setEodReminderHour(e.target.value)}
                      className="flex-1 rounded-lg px-3 py-2 focus:outline-none text-sm"
                      style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={String(h)}>{h}</option>
                      ))}
                    </select>
                    <span style={{ color: B.muted }}>:</span>
                    <select value={eodReminderMin} onChange={(e) => setEodReminderMin(e.target.value)}
                      className="flex-1 rounded-lg px-3 py-2 focus:outline-none text-sm"
                      style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                      {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${B.border}` }}>
                      {["AM", "PM"].map((a) => (
                        <button key={a} onClick={() => setEodReminderAmpm(a)}
                          className="px-3 py-2 text-sm font-semibold"
                          style={{ backgroundColor: eodReminderAmpm === a ? B.gold : B.bg, color: eodReminderAmpm === a ? B.bg : B.muted }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveSettings}
              className="w-full font-semibold py-3 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: B.gold, color: B.bg }}>
              Save Settings
            </button>

            {settings && (
              <button onClick={() => setView("dashboard")}
                className="w-full font-semibold py-3 rounded-lg"
                style={{ backgroundColor: "transparent", border: `1px solid ${B.border}`, color: B.text }}>
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Profile view ─────────────────────────────────────────────────────────
  if (view === "profile") {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: B.bg, color: B.text }}>
        <div className="max-w-md mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <button onClick={() => setView("dashboard")} style={{ color: B.muted }}>
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold uppercase tracking-widest" style={{ color: B.gold }}>Profile</h1>
          </div>

          <div className="rounded-lg p-6 space-y-5" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
            {profileMsg && (
              <div className="rounded-lg px-4 py-2 text-sm" style={{
                backgroundColor: profileMsg.type === "error" ? `${B.error}20` : `${B.success}20`,
                border: `1px solid ${profileMsg.type === "error" ? B.error : B.success}`,
                color: profileMsg.type === "error" ? B.error : B.success,
              }}>
                {profileMsg.text}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: B.text }}>Display Name</label>
              <input type="text" value={profileDisplayName} onChange={(e) => setProfileDisplayName(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                onFocus={(e) => (e.target.style.borderColor = B.gold)}
                onBlur={(e) => (e.target.style.borderColor = B.border)}
                placeholder="Your name" />
            </div>

            <button onClick={saveProfile} disabled={profileSaving}
              className="w-full font-semibold py-3 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: B.gold, color: B.bg, opacity: profileSaving ? 0.5 : 1 }}>
              {profileSaving ? "Saving…" : "Save Profile"}
            </button>

            <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: "1rem" }}>
              <p className="text-xs mb-3" style={{ color: B.muted }}>{session?.user?.email}</p>
              <button onClick={() => supabase.auth.signOut()}
                className="w-full font-semibold py-3 rounded-lg"
                style={{ backgroundColor: "transparent", border: `1px solid ${B.border}`, color: B.muted }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── History view ─────────────────────────────────────────────────────────
  if (view === "history") {
    return (
      <div className="min-h-screen pb-6" style={{ backgroundColor: B.bg, color: B.text }}>
        <div className="p-6 sticky top-0 z-10" style={{ backgroundColor: B.bg }}>
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setView("dashboard")} style={{ color: B.muted }}>
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-2xl font-bold uppercase tracking-widest" style={{ color: B.gold }}>History</h1>
            </div>

            <select value={historyInterval} onChange={(e) => setHistoryInterval(e.target.value)}
              className="w-full rounded-lg px-4 py-3 mb-4 focus:outline-none text-sm"
              style={{ backgroundColor: B.surface, border: `1px solid ${B.gold}`, color: B.text }}>
              <option value="Daily">Daily View</option>
              <option value="Weekly">Weekly View</option>
              <option value="Monthly">Monthly View</option>
              <option value="Quarterly">Quarterly View</option>
              <option value="Yearly">Yearly View</option>
            </select>

            <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
              <button onClick={() => navigateDate(-1)} style={{ color: B.muted }}><ChevronLeft size={20} /></button>
              <span className="text-sm font-medium" style={{ color: B.gold }}>{getDateRangeLabel()}</span>
              <button onClick={() => navigateDate(1)} style={{ color: B.muted }}><ChevronRight size={20} /></button>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-6 mt-6">
          {historicalData ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg p-4" style={{ backgroundColor: B.surface, border: `1px solid ${B.gold}` }}>
                  <p className="text-xs mb-1" style={{ color: B.muted }}>Total Net Income</p>
                  <p className="text-2xl font-bold" style={{ color: B.gold }}>${historicalData.totalTrueNetIncome.toFixed(2)}</p>
                </div>
                <div className="rounded-lg p-4" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
                  <p className="text-xs mb-1" style={{ color: B.muted }}>Avg $/Hour</p>
                  <p className="text-2xl font-bold" style={{ color: B.text }}>${historicalData.avgMoneyPerHour.toFixed(2)}</p>
                </div>
              </div>

              <div className="rounded-lg p-4 mb-6 space-y-3" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
                {[
                  { label: "Total Revenue", value: `$${historicalData.totalRevenue.toFixed(2)}`, color: B.success },
                  { label: "Tax Set-Aside", value: `-$${historicalData.totalTaxSetAside.toFixed(2)}`, color: B.error },
                  { label: "Rent Contribution", value: `-$${historicalData.totalRentContribution.toFixed(2)}`, color: B.error },
                  { label: "Service Time", value: `${historicalData.totalServiceTime.toFixed(1)} hrs`, color: B.text },
                  { label: "Days Worked", value: String(historicalData.daysWorked), color: B.gold },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between">
                    <span style={{ color: B.muted }}>{label}</span>
                    <span className="font-semibold" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>

              {historyInterval === "Daily" && historicalData.logs.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">Services ({historicalData.logs.length})</h2>
                  {historicalData.logs.map((log) => (
                    <div key={log.log_ID} className="rounded-lg p-4" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold" style={{ color: B.text }}>{log.client_name}</p>
                          <p className="text-sm" style={{ color: B.muted }}>{log.service_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" style={{ color: B.gold }}>${log.payout_amount.toFixed(2)}</p>
                          <p className="text-xs" style={{ color: B.muted }}>{log.duration_minutes} min</p>
                        </div>
                      </div>
                      <p className="text-xs" style={{ color: B.muted }}>{formatAMPM(log.service_start_time)}</p>
                    </div>
                  ))}
                </div>
              )}

              {historicalData.logs.length === 0 && (
                <div className="text-center py-12" style={{ color: B.muted }}>
                  <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No data for this period</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: B.muted }}>
              <p>Loading…</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  const metrics = calculateMetrics();
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const pendingAppointments = appointments.filter((a) => !a.completed);

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: B.bg, color: B.text }}>
      {/* Header */}
      <div className="p-6 sticky top-0 z-10" style={{ backgroundColor: B.bg }}>
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-widest" style={{ color: B.gold }}>LEDGR</h1>
              <p className="text-xs" style={{ color: B.muted }}>by The Fade Collective</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setView("history")} style={{ color: B.muted }} className="hover:opacity-80">
                <BarChart3 size={22} />
              </button>
              <button onClick={() => setView("settings")} style={{ color: B.muted }} className="hover:opacity-80">
                <Settings size={22} />
              </button>
              <button onClick={() => setView("profile")} style={{ color: B.muted }} className="hover:opacity-80">
                <User size={22} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} style={{ color: B.muted }} />
            <p className="text-sm" style={{ color: B.muted }}>{todayLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg p-4" style={{ backgroundColor: B.surface, border: `1px solid ${B.gold}` }}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} style={{ color: B.gold }} />
                <p className="text-xs" style={{ color: B.muted }}>TDNI</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: B.gold }}>${metrics.tdni.toFixed(2)}</p>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} style={{ color: B.gold }} />
                <p className="text-xs" style={{ color: B.muted }}>$/Hour</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: B.text }}>${metrics.moneyPerHour.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 mt-4">
        {/* Notification permission prompt */}
        {showNotifPrompt && (
          <div className="rounded-lg p-4 mb-4 flex gap-3 items-start" style={{ backgroundColor: B.surface, border: `1px solid ${B.gold}` }}>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1" style={{ color: B.text }}>Enable appointment reminders</p>
              <p className="text-xs" style={{ color: B.muted }}>Get notified before appointments and at end of day.</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={requestPushPermission}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: B.gold, color: B.bg }}>
                Enable
              </button>
              <button onClick={() => setShowNotifPrompt(false)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: B.muted, border: `1px solid ${B.border}` }}>
                Later
              </button>
            </div>
          </div>
        )}

        {/* Metrics breakdown */}
        <div className="rounded-lg p-4 mb-6 space-y-3" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
          {[
            { label: "Total Revenue", value: `$${metrics.totalRevenue.toFixed(2)}`, color: B.success },
            { label: "Tax Set-Aside", value: `-$${metrics.totalTaxSetAside.toFixed(2)}`, color: B.error },
            { label: "Daily Rent", value: `-$${metrics.dailyRent.toFixed(2)}`, color: B.error },
            { label: "Service Time", value: `${metrics.totalServiceTime.toFixed(1)} hrs`, color: B.text },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between">
              <span style={{ color: B.muted }}>{label}</span>
              <span className="font-semibold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Pending appointments */}
        {pendingAppointments.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3">Scheduled ({pendingAppointments.length})</h2>
            <div className="space-y-3">
              {pendingAppointments.map((apt) => (
                <div key={apt.id} onClick={() => openLogModalForAppointment(apt)}
                  className="rounded-lg p-4 cursor-pointer"
                  style={{ backgroundColor: B.surface, border: `1px solid ${B.gold}` }}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      {apt.scheduledTime && <p className="text-xs font-mono mb-1" style={{ color: B.gold }}>{apt.scheduledTime}</p>}
                      <p className="font-semibold" style={{ color: B.text }}>{apt.clientName}</p>
                      <p className="text-sm" style={{ color: B.muted }}>{apt.serviceType}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeAppointment(apt.id); }}
                      className="text-sm" style={{ color: B.muted }}>Remove</button>
                  </div>
                  <p className="text-xs" style={{ color: B.gold }}>Tap to start →</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed services */}
        <h2 className="text-base font-semibold mb-3">Today's Services ({logs.length})</h2>
        {logs.length === 0 ? (
          <div className="text-center py-12" style={{ color: B.muted }}>
            <Clock size={48} className="mx-auto mb-4 opacity-40" />
            <p>No services logged yet.</p>
            <p className="text-sm mt-1">Prep your day or add a walk-in!</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {logs.map((log) => (
              <div key={log.log_ID} className="rounded-lg p-4" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold" style={{ color: B.text }}>{log.client_name}</p>
                    <p className="text-sm" style={{ color: B.muted }}>{log.service_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold" style={{ color: B.gold }}>${log.payout_amount.toFixed(2)}</p>
                    <p className="text-xs" style={{ color: B.muted }}>{log.duration_minutes} min</p>
                  </div>
                </div>
                <p className="text-xs" style={{ color: B.muted }}>{formatAMPM(log.service_start_time)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6" style={{ background: `linear-gradient(to top, ${B.bg} 70%, transparent)` }}>
        <div className="max-w-md mx-auto space-y-3">
          <button onClick={() => setShowPrepModal(true)}
            className="w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: "transparent", border: `1px solid ${B.gold}`, color: B.gold }}>
            <ClipboardList size={20} /> Prep Day
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowLogModal(true)}
              className="font-bold py-4 rounded-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: B.gold, color: B.bg }}>
              <Plus size={20} /> Add Walk-in
            </button>
            <button onClick={() => setShowPastCutModal(true)}
              className="font-bold py-4 rounded-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: B.gold, color: B.bg }}>
              <Clock size={20} /> Log Past Cut
            </button>
          </div>
        </div>
      </div>

      {/* Prep modal */}
      {showPrepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(0,0,0,0.92)" }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
            <div className="p-6 space-y-5">
              <h2 className="text-xl font-bold" style={{ color: B.gold }}>Prep Your Day</h2>

              {[
                { label: "Client Name", value: prepClientName, set: setPrepClientName, type: "text", placeholder: "Enter client name" },
              ].map(({ label, value, set, type, placeholder }) => (
                <div key={label}>
                  <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>{label}</label>
                  <input type={type} value={value} onChange={(e) => set(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                    onFocus={(e) => (e.target.style.borderColor = B.gold)}
                    onBlur={(e) => (e.target.style.borderColor = B.border)}
                    placeholder={placeholder} />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Service Type</label>
                <select value={prepServiceType} onChange={(e) => setPrepServiceType(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm"
                  style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                  <option value="">Select service</option>
                  {serviceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Scheduled Time (Optional)</label>
                <input type="time" value={prepTime} onChange={(e) => setPrepTime(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm"
                  style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                  onFocus={(e) => (e.target.style.borderColor = B.gold)}
                  onBlur={(e) => (e.target.style.borderColor = B.border)} />
              </div>

              <button onClick={addAppointment}
                className="w-full font-semibold py-3 rounded-lg hover:opacity-90"
                style={{ backgroundColor: B.gold, color: B.bg }}>
                Add Client
              </button>

              {appointments.length > 0 && (
                <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: "1rem" }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: B.muted }}>Today's Schedule</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {appointments.map((apt) => (
                      <div key={apt.id} className="flex justify-between items-center rounded-lg p-3"
                        style={{ backgroundColor: B.bg }}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: B.text }}>{apt.clientName}</p>
                          <p className="text-xs" style={{ color: B.muted }}>
                            {apt.serviceType}{apt.scheduledTime && " · " + apt.scheduledTime}
                          </p>
                        </div>
                        {apt.completed
                          ? <span className="text-xs" style={{ color: B.success }}>✓</span>
                          : <button onClick={() => removeAppointment(apt.id)} className="text-xs" style={{ color: B.error }}>Remove</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setShowPrepModal(false)}
                className="w-full font-semibold py-3 rounded-lg"
                style={{ backgroundColor: "transparent", border: `1px solid ${B.border}`, color: B.text }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log service modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(0,0,0,0.92)" }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
            <div className="p-6 space-y-5">
              <h2 className="text-xl font-bold" style={{ color: B.gold }}>Log Service</h2>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Client Name</label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                  disabled={selectedAppointment !== null}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm disabled:opacity-50"
                  style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                  onFocus={(e) => (e.target.style.borderColor = B.gold)}
                  onBlur={(e) => (e.target.style.borderColor = B.border)}
                  placeholder="Enter client name" />
              </div>

              {!endTime && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Service Type</label>
                  <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                    disabled={selectedAppointment !== null}
                    className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm disabled:opacity-50"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                    <option value="">Select service</option>
                    {serviceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              <div className="rounded-lg p-6 text-center" style={{ backgroundColor: B.bg, border: `1px solid ${B.border}` }}>
                <p className="text-sm mb-2" style={{ color: B.muted }}>Service Time</p>
                <p className="text-4xl font-mono font-bold mb-4" style={{ color: B.gold }}>{formatTime(elapsedSeconds)}</p>

                {!isTimerRunning && !endTime && (
                  <button onClick={startTimerFunc}
                    className="w-full font-semibold py-3 rounded-lg"
                    style={{ backgroundColor: B.success, color: B.bg }}>
                    Start Service
                  </button>
                )}
                {isTimerRunning && (
                  <button onClick={stopTimerFunc}
                    className="w-full font-semibold py-3 rounded-lg"
                    style={{ backgroundColor: B.error, color: B.text }}>
                    Service Complete
                  </button>
                )}
                {endTime && <p className="font-semibold" style={{ color: B.success }}>✓ Service Completed</p>}
              </div>

              {endTime && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Final Payout ($)</label>
                  <input type="number" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                    onFocus={(e) => (e.target.style.borderColor = B.gold)}
                    onBlur={(e) => (e.target.style.borderColor = B.border)}
                    placeholder="0.00" />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={resetModal} className="flex-1 font-semibold py-3 rounded-lg"
                  style={{ backgroundColor: "transparent", border: `1px solid ${B.border}`, color: B.text }}>
                  Cancel
                </button>
                {endTime && (
                  <button onClick={logTransaction} className="flex-1 font-semibold py-3 rounded-lg hover:opacity-90"
                    style={{ backgroundColor: B.gold, color: B.bg }}>
                    Log Transaction
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Log past cut modal */}
      {showPastCutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(0,0,0,0.92)" }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg" style={{ backgroundColor: B.surface, border: `1px solid ${B.border}` }}>
            <div className="p-6 space-y-5">
              <h2 className="text-xl font-bold" style={{ color: B.gold }}>Log Past Cut</h2>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Date</label>
                <input type="date" value={pastCutDate} onChange={(e) => setPastCutDate(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm"
                  style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text, colorScheme: "dark" }}
                  onFocus={(e) => (e.target.style.borderColor = B.gold)}
                  onBlur={(e) => (e.target.style.borderColor = B.border)} />
              </div>

              {/* Start time */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Start Time</label>
                <div className="flex gap-2 items-center">
                  <select value={pastCutStartHour} onChange={(e) => setPastCutStartHour(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-3 focus:outline-none text-sm"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={String(h)}>{h}</option>
                    ))}
                  </select>
                  <span style={{ color: B.muted }}>:</span>
                  <select value={pastCutStartMin} onChange={(e) => setPastCutStartMin(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-3 focus:outline-none text-sm"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                    {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${B.border}` }}>
                    {["AM", "PM"].map((a) => (
                      <button key={a} onClick={() => setPastCutStartAmpm(a)}
                        className="px-3 py-3 text-sm font-semibold"
                        style={{ backgroundColor: pastCutStartAmpm === a ? B.gold : B.bg, color: pastCutStartAmpm === a ? B.bg : B.muted }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* End time */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>End Time</label>
                <div className="flex gap-2 items-center">
                  <select value={pastCutEndHour} onChange={(e) => setPastCutEndHour(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-3 focus:outline-none text-sm"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={String(h)}>{h}</option>
                    ))}
                  </select>
                  <span style={{ color: B.muted }}>:</span>
                  <select value={pastCutEndMin} onChange={(e) => setPastCutEndMin(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-3 focus:outline-none text-sm"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                    {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${B.border}` }}>
                    {["AM", "PM"].map((a) => (
                      <button key={a} onClick={() => setPastCutEndAmpm(a)}
                        className="px-3 py-3 text-sm font-semibold"
                        style={{ backgroundColor: pastCutEndAmpm === a ? B.gold : B.bg, color: pastCutEndAmpm === a ? B.bg : B.muted }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Service type */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Service Type</label>
                <select value={pastCutServiceType} onChange={(e) => setPastCutServiceType(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm"
                  style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}>
                  <option value="">Select service</option>
                  {serviceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Client name */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>
                  Client Name <span style={{ color: B.muted }}>(optional)</span>
                </label>
                <input type="text" value={pastCutClientName} onChange={(e) => setPastCutClientName(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none text-sm"
                  style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                  onFocus={(e) => (e.target.style.borderColor = B.gold)}
                  onBlur={(e) => (e.target.style.borderColor = B.border)}
                  placeholder="Enter client name" />
              </div>

              {/* Pay amount */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: B.text }}>Pay Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold" style={{ color: B.muted }}>$</span>
                  <input type="number" step="0.01" value={pastCutPay} onChange={(e) => setPastCutPay(e.target.value)}
                    className="w-full rounded-lg pl-8 pr-4 py-3 focus:outline-none text-sm"
                    style={{ backgroundColor: B.bg, border: `1px solid ${B.border}`, color: B.text }}
                    onFocus={(e) => (e.target.style.borderColor = B.gold)}
                    onBlur={(e) => (e.target.style.borderColor = B.border)}
                    placeholder="0.00" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={resetPastCutModal} className="flex-1 font-semibold py-3 rounded-lg"
                  style={{ backgroundColor: "transparent", border: `1px solid ${B.border}`, color: B.text }}>
                  Cancel
                </button>
                <button onClick={savePastCut} disabled={pastCutSaving} className="flex-1 font-semibold py-3 rounded-lg hover:opacity-90"
                  style={{ backgroundColor: B.gold, color: B.bg, opacity: pastCutSaving ? 0.5 : 1 }}>
                  {pastCutSaving ? "Saving…" : "Save Cut"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
