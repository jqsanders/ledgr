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
} from "lucide-react";

// Simple storage wrapper that works on Vercel (browser localStorage)
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

export default function LedgrMvp() {
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

  const [showPrepModal, setShowPrepModal] = useState(false);
  const [prepClientName, setPrepClientName] = useState("");
  const [prepServiceType, setPrepServiceType] = useState("");
  const [prepTime, setPrepTime] = useState("");

  // Settings form state (defaults)
  const [taxRate, setTaxRate] = useState("25");
  const [rentAmount, setRentAmount] = useState("250");
  const [rentFrequency, setRentFrequency] = useState("Weekly");
  const [workingDays, setWorkingDays] = useState("5");

  const serviceTypes = [
    "Haircut",
    "Color",
    "Highlights",
    "Manicure",
    "Pedicure",
    "Gel Nails",
    "Beard Trim",
    "Shave",
    "Blowout",
    "Extensions",
    "Braids",
    "Other",
  ];

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "history") {
      loadHistoricalData();
    }
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
      // Settings
      const settingsResult = storage.get("ledgr_settings");
      if (settingsResult?.value) {
        const parsed = safeJsonParse(settingsResult.value, null);
        if (parsed) {
          setSettings(parsed);
          // also hydrate form fields so Settings screen shows current values
          setTaxRate(String(parsed.taxRate ?? 25));
          setRentAmount(String(parsed.rentAmount ?? 250));
          setRentFrequency(parsed.rentFrequency ?? "Weekly");
          setWorkingDays(String(parsed.workingDays ?? 5));
        }
      }

      const today = new Date().toISOString().split("T")[0];

      // Logs
      const logsResult = storage.get("ledgr_logs_" + today);
      if (logsResult?.value) {
        setLogs(safeJsonParse(logsResult.value, []));
      }

      // Appointments
      const appointmentsResult = storage.get("ledgr_appointments_" + today);
      if (appointmentsResult?.value) {
        setAppointments(safeJsonParse(appointmentsResult.value, []));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    if (!settings) return;

    try {
      const dates = getDateRangeForInterval(historyInterval, selectedDate);
      let allLogs = [];

      for (const date of dates) {
        const dateStr = date.toISOString().split("T")[0];
        const logsResult = storage.get("ledgr_logs_" + dateStr);
        if (logsResult?.value) {
          const dayLogs = safeJsonParse(logsResult.value, []);
          allLogs = allLogs.concat(
            dayLogs.map((log) => Object.assign({}, log, { date: dateStr }))
          );
        }
      }

      setHistoricalData(calculateHistoricalMetrics(allLogs));
    } catch (error) {
      setHistoricalData(null);
    }
  };

  const getDateRangeForInterval = (interval, referenceDate) => {
    const dates = [];
    const date = new Date(referenceDate);

    if (interval === "Daily") {
      dates.push(new Date(date));
    } else if (interval === "Weekly") {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        dates.push(day);
      }
    } else if (interval === "Monthly") {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        dates.push(new Date(year, month, i));
      }
    } else if (interval === "Quarterly") {
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3);
      const startMonth = quarter * 3;
      for (let month = startMonth; month < startMonth + 3; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          dates.push(new Date(year, month, day));
        }
      }
    } else if (interval === "Yearly") {
      const year = date.getFullYear();
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          dates.push(new Date(year, month, day));
        }
      }
    }

    return dates;
  };

  const calculateHistoricalMetrics = (logsInput) => {
    const logsList = logsInput || [];

    if (logsList.length === 0) {
      return {
        totalRevenue: 0,
        totalServiceTime: 0,
        avgMoneyPerHour: 0,
        totalTaxSetAside: 0,
        totalRentContribution: 0,
        totalSetAsides: 0,
        totalTrueNetIncome: 0,
        logs: [],
        daysWorked: 0,
      };
    }

    const totalRevenue = logsList.reduce((sum, log) => sum + (log.payout_amount || 0), 0);
    const totalServiceTime = logsList.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) / 60;
    const avgMoneyPerHour = totalServiceTime > 0 ? totalRevenue / totalServiceTime : 0;
    const totalTaxSetAside = logsList.reduce((sum, log) => sum + (log.tax_set_aside || 0), 0);

    const uniqueDates = Array.from(new Set(logsList.map((log) => log.date)));
    const daysWorked = uniqueDates.length;

    const dailyRent =
      settings.rentFrequency === "Weekly"
        ? settings.rentAmount / settings.workingDays
        : settings.rentAmount / (settings.workingDays * 4.33);

    const totalRentContribution = dailyRent * daysWorked;
    const totalSetAsides = totalTaxSetAside + totalRentContribution;
    const totalTrueNetIncome = totalRevenue - totalSetAsides;

    return {
      totalRevenue,
      totalServiceTime,
      avgMoneyPerHour,
      totalTaxSetAside,
      totalRentContribution,
      totalSetAsides,
      totalTrueNetIncome,
      logs: logsList,
      daysWorked,
    };
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);

    if (historyInterval === "Daily") {
      newDate.setDate(newDate.getDate() + direction);
    } else if (historyInterval === "Weekly") {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else if (historyInterval === "Monthly") {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (historyInterval === "Quarterly") {
      newDate.setMonth(newDate.getMonth() + direction * 3);
    } else if (historyInterval === "Yearly") {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }

    setSelectedDate(newDate);
  };

  const getDateRangeLabel = () => {
    const date = selectedDate;

    if (historyInterval === "Daily") {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else if (historyInterval === "Weekly") {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const start = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const end = endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return start + " - " + end;
    } else if (historyInterval === "Monthly") {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (historyInterval === "Quarterly") {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return "Q" + quarter + " " + date.getFullYear();
    } else if (historyInterval === "Yearly") {
      return date.getFullYear().toString();
    }
    return "";
  };

  const saveSettings = async () => {
    const settingsData = {
      taxRate: parseFloat(taxRate),
      rentAmount: parseFloat(rentAmount),
      rentFrequency,
      workingDays: parseInt(workingDays, 10),
    };

    const ok = storage.set("ledgr_settings", JSON.stringify(settingsData));
    if (!ok) {
      alert("Error saving settings");
      return;
    }

    setSettings(settingsData);
    setView("dashboard");
  };

  const addAppointment = async () => {
    if (!prepClientName || !prepServiceType) {
      alert("Please enter client name and service type");
      return;
    }

    const newAppointment = {
      id: Date.now().toString(),
      clientName: prepClientName,
      serviceType: prepServiceType,
      scheduledTime: prepTime,
      completed: false,
    };

    const updatedAppointments = appointments
      .concat(newAppointment)
      .sort((a, b) => {
        if (!a.scheduledTime) return 1;
        if (!b.scheduledTime) return -1;
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });

    setAppointments(updatedAppointments);

    const today = new Date().toISOString().split("T")[0];
    storage.set("ledgr_appointments_" + today, JSON.stringify(updatedAppointments));

    setPrepClientName("");
    setPrepServiceType("");
    setPrepTime("");
  };

  const removeAppointment = async (appointmentId) => {
    const updatedAppointments = appointments.filter((apt) => apt.id !== appointmentId);
    setAppointments(updatedAppointments);

    const today = new Date().toISOString().split("T")[0];
    storage.set("ledgr_appointments_" + today, JSON.stringify(updatedAppointments));
  };

  const openLogModalForAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setClientName(appointment.clientName);
    setServiceType(appointment.serviceType);
    setShowLogModal(true);
  };

  const startTimerFunc = () => {
    setStartTime(Date.now());
    setIsTimerRunning(true);
  };

  const stopTimerFunc = () => {
    setEndTime(Date.now());
    setIsTimerRunning(false);
  };

  const logTransaction = async () => {
    if (!clientName || !serviceType || !payoutAmount || !startTime || !endTime) {
      alert("Please complete all fields");
      return;
    }

    const durationMinutes = Math.floor((endTime - startTime) / 60000);
    const payout = parseFloat(payoutAmount);

    if (!settings) {
      alert("Please set your settings first");
      return;
    }

    const taxSetAside = payout * (settings.taxRate / 100);

    const newLog = {
      log_ID: Date.now().toString(),
      date_time_logged: new Date().toISOString(),
      client_name: clientName,
      service_type: serviceType,
      service_start_time: new Date(startTime).toISOString(),
      service_end_time: new Date(endTime).toISOString(),
      duration_minutes: durationMinutes,
      payout_amount: payout,
      tax_rate_used: settings.taxRate,
      tax_set_aside: taxSetAside,
    };

    const updatedLogs = logs.concat(newLog);
    setLogs(updatedLogs);

    const today = new Date().toISOString().split("T")[0];
    storage.set("ledgr_logs_" + today, JSON.stringify(updatedLogs));

    if (selectedAppointment) {
      const updatedAppointments = appointments.map((apt) =>
        apt.id === selectedAppointment.id ? Object.assign({}, apt, { completed: true }) : apt
      );
      setAppointments(updatedAppointments);
      storage.set("ledgr_appointments_" + today, JSON.stringify(updatedAppointments));
    }

    resetModal();
  };

  const resetModal = () => {
    setShowLogModal(false);
    setSelectedAppointment(null);
    setClientName("");
    setServiceType("");
    setIsTimerRunning(false);
    setStartTime(null);
    setEndTime(null);
    setPayoutAmount("");
    setElapsedSeconds(0);
  };

  const calculateMetrics = () => {
    if (!settings || logs.length === 0) {
      return {
        totalRevenue: 0,
        totalServiceTime: 0,
        moneyPerHour: 0,
        totalTaxSetAside: 0,
        dailyRent: 0,
        tdni: 0,
      };
    }

    const totalRevenue = logs.reduce((sum, log) => sum + (log.payout_amount || 0), 0);
    const totalServiceTime = logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) / 60;
    const moneyPerHour = totalServiceTime > 0 ? totalRevenue / totalServiceTime : 0;
    const totalTaxSetAside = logs.reduce((sum, log) => sum + (log.tax_set_aside || 0), 0);

    const dailyRent =
      settings.rentFrequency === "Weekly"
        ? settings.rentAmount / settings.workingDays
        : settings.rentAmount / (settings.workingDays * 4.33);

    const tdni = totalRevenue - (totalTaxSetAside + dailyRent);

    return {
      totalRevenue,
      totalServiceTime,
      moneyPerHour,
      totalTaxSetAside,
      dailyRent,
      tdni,
    };
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const hrsStr = hrs.toString().padStart(2, "0");
    const minsStr = mins.toString().padStart(2, "0");
    const secsStr = secs.toString().padStart(2, "0");
    return hrsStr + ":" + minsStr + ":" + secsStr;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-yellow-500 text-xl">Loading LEDGR...</div>
      </div>
    );
  }

  if (!settings || view === "settings") {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-md mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-yellow-500 mb-2">LEDGR</h1>
            <p className="text-sm text-gray-400">by The Fade Collective</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold text-yellow-500 mb-4">Settings</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Estimated Tax Rate (%)</label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                placeholder="25"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Rent/Booth Fee ($)</label>
              <input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                placeholder="250"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Rent Frequency</label>
              <select
                value={rentFrequency}
                onChange={(e) => setRentFrequency(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
              >
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Working Days Per {rentFrequency === "Weekly" ? "Week" : "Month"}
              </label>
              <input
                type="number"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                placeholder="5"
              />
            </div>

            <button
              onClick={saveSettings}
              className="w-full bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition"
            >
              Save Settings
            </button>

            {settings && (
              <button
                onClick={() => setView("dashboard")}
                className="w-full bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="min-h-screen bg-black text-white pb-6">
        <div className="bg-gradient-to-b from-gray-900 to-black p-6 sticky top-0 z-10">
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setView("dashboard")} className="text-gray-400 hover:text-yellow-500 transition">
                <ChevronLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-yellow-500">Performance History</h1>
                <p className="text-xs text-gray-400">by The Fade Collective</p>
              </div>
            </div>

            <div className="mb-4">
              <select
                value={historyInterval}
                onChange={(e) => setHistoryInterval(e.target.value)}
                className="w-full bg-black border border-yellow-500 rounded px-4 py-3 text-white focus:border-yellow-400 focus:outline-none"
              >
                <option value="Daily">Daily View</option>
                <option value="Weekly">Weekly View</option>
                <option value="Monthly">Monthly View</option>
                <option value="Quarterly">Quarterly View</option>
                <option value="Yearly">Yearly View</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-gray-900 rounded-lg p-3">
              <button onClick={() => navigateDate(-1)} className="text-gray-400 hover:text-yellow-500 transition">
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-medium text-yellow-500">{getDateRangeLabel()}</span>
              <button onClick={() => navigateDate(1)} className="text-gray-400 hover:text-yellow-500 transition">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-6 mt-6">
          {historicalData ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-900 rounded-lg p-4 border border-yellow-500">
                  <p className="text-xs text-gray-400 mb-1">Total Net Income</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    ${historicalData.totalTrueNetIncome.toFixed(2)}
                  </p>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Avg Money/Hour</p>
                  <p className="text-2xl font-bold text-white">${historicalData.avgMoneyPerHour.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Revenue</span>
                  <span className="font-semibold text-green-400">${historicalData.totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tax Set-Aside</span>
                  <span className="font-semibold text-red-400">-${historicalData.totalTaxSetAside.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rent Contribution</span>
                  <span className="font-semibold text-red-400">-${historicalData.totalRentContribution.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-800 pt-3">
                  <span className="text-gray-400">Total Set-Asides</span>
                  <span className="font-semibold text-red-400">-${historicalData.totalSetAsides.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Service Time</span>
                  <span className="font-semibold">{historicalData.totalServiceTime.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Days Worked</span>
                  <span className="font-semibold text-yellow-500">{historicalData.daysWorked}</span>
                </div>
              </div>

              {historyInterval === "Daily" && historicalData.logs.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Services Logged ({historicalData.logs.length})</h2>
                  <div className="space-y-3">
                    {historicalData.logs.map((log) => (
                      <div key={log.log_ID} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-white">{log.client_name}</p>
                            <p className="text-sm text-gray-400">{log.service_type}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-yellow-500">${log.payout_amount.toFixed(2)}</p>
                            <p className="text-xs text-gray-400">{log.duration_minutes} min</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(log.service_start_time).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {historicalData.logs.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No data for this period</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Loading historical data...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const metrics = calculateMetrics();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pendingAppointments = appointments.filter((apt) => !apt.completed);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="bg-gradient-to-b from-gray-900 to-black p-6 sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-yellow-500">LEDGR</h1>
              <p className="text-xs text-gray-400">by The Fade Collective</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setView("history")} className="text-gray-400 hover:text-yellow-500 transition">
                <BarChart3 size={24} />
              </button>
              <button onClick={() => setView("settings")} className="text-gray-400 hover:text-yellow-500 transition">
                <Settings size={24} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-gray-400" />
            <p className="text-sm text-gray-300">{today}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-yellow-500">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-yellow-500" />
                <p className="text-xs text-gray-400">TDNI</p>
              </div>
              <p className="text-2xl font-bold text-yellow-500">${metrics.tdni.toFixed(2)}</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-yellow-500" />
                <p className="text-xs text-gray-400">Money/Hour</p>
              </div>
              <p className="text-2xl font-bold text-white">${metrics.moneyPerHour.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 mt-6">
        <div className="bg-gray-900 rounded-lg p-4 mb-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Revenue</span>
            <span className="font-semibold text-green-400">${metrics.totalRevenue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Tax Set-Aside</span>
            <span className="font-semibold text-red-400">-${metrics.totalTaxSetAside.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Daily Rent</span>
            <span className="font-semibold text-red-400">-${metrics.dailyRent.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Service Time</span>
            <span className="font-semibold">{metrics.totalServiceTime.toFixed(1)} hrs</span>
          </div>
        </div>

        {pendingAppointments.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Scheduled Appointments ({pendingAppointments.length})</h2>
            <div className="space-y-3 mb-6">
              {pendingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => openLogModalForAppointment(apt)}
                  className="bg-gradient-to-r from-yellow-900 to-gray-900 rounded-lg p-4 border border-yellow-600 cursor-pointer hover:border-yellow-500 transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {apt.scheduledTime && <span className="text-xs font-mono text-yellow-500">{apt.scheduledTime}</span>}
                        <Clock size={14} className="text-yellow-500" />
                      </div>
                      <p className="font-semibold text-white">{apt.clientName}</p>
                      <p className="text-sm text-gray-300">{apt.serviceType}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAppointment(apt.id);
                      }}
                      className="text-gray-400 hover:text-red-400 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-yellow-400">Tap to start service →</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4">Completed Services ({logs.length})</h2>

        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No services logged yet.</p>
            <p className="text-sm mt-2">Prep your day or add a walk-in!</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {logs.map((log) => (
              <div key={log.log_ID} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-white">{log.client_name}</p>
                    <p className="text-sm text-gray-400">{log.service_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-500">${log.payout_amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{log.duration_minutes} min</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(log.service_start_time).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black to-transparent">
        <div className="max-w-md mx-auto space-y-3">
          <button
            onClick={() => setShowPrepModal(true)}
            className="w-full bg-gray-800 text-yellow-500 font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-700 transition border border-yellow-500"
          >
            <ClipboardList size={20} />
            Prep Day
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="w-full bg-yellow-500 text-black font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-yellow-400 transition shadow-lg"
          >
            <Plus size={24} />
            Add Walk-in
          </button>
        </div>
      </div>

      {showPrepModal && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-yellow-500">Prep Your Day</h2>

              <div>
                <label className="block text-sm font-medium mb-2">Client Name</label>
                <input
                  type="text"
                  value={prepClientName}
                  onChange={(e) => setPrepClientName(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                  placeholder="Enter client name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Service Type</label>
                <select
                  value={prepServiceType}
                  onChange={(e) => setPrepServiceType(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                >
                  <option value="">Select service</option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Scheduled Time (Optional)</label>
                <input
                  type="time"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <button
                onClick={addAppointment}
                className="w-full bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition"
              >
                Add Client
              </button>

              {appointments.length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold mb-3 text-gray-400">Today's Schedule</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {appointments.map((apt) => (
                      <div key={apt.id} className="flex justify-between items-center bg-black rounded p-3">
                        <div>
                          <p className="text-sm font-medium text-white">{apt.clientName}</p>
                          <p className="text-xs text-gray-400">
                            {apt.serviceType} {apt.scheduledTime && "• " + apt.scheduledTime}
                          </p>
                        </div>
                        {apt.completed ? (
                          <span className="text-xs text-green-400">✓</span>
                        ) : (
                          <button onClick={() => removeAppointment(apt.id)} className="text-xs text-red-400 hover:text-red-300">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowPrepModal(false)}
                className="w-full bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-yellow-500">Log Service</h2>

              <div>
                <label className="block text-sm font-medium mb-2">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={selectedAppointment !== null}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-3 text-white focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                  placeholder="Enter client name"
                />
              </div>

              {!endTime && (
                <div>
                  <label className="block text-sm font-medium mb-2">Service Type</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    disabled={selectedAppointment !== null}
                    className="w-full bg-black border border-gray-700 rounded px-4 py-3 text-white focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Select service</option>
                    {serviceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-black rounded-lg p-6 text-center border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">Service Time</p>
                <p className="text-4xl font-mono font-bold text-yellow-500 mb-4">{formatTime(elapsedSeconds)}</p>

                {!isTimerRunning && !endTime && (
                  <button
                    onClick={startTimerFunc}
                    className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-500 transition"
                  >
                    Start Service
                  </button>
                )}

                {isTimerRunning && (
                  <button
                    onClick={stopTimerFunc}
                    className="w-full bg-red-600 text-white font-semibold py-3 rounded-lg hover:bg-red-500 transition"
                  >
                    Service Complete
                  </button>
                )}

                {endTime && <div className="text-green-400 font-semibold">✓ Service Completed</div>}
              </div>

              {endTime && (
                <div>
                  <label className="block text-sm font-medium mb-2">Final Payout Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button onClick={resetModal} className="flex-1 bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition">
                  Cancel
                </button>
                {endTime && (
                  <button onClick={logTransaction} className="flex-1 bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition">
                    Log Transaction
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
