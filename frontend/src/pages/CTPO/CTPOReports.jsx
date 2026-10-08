import React, { useEffect, useMemo, useState } from "react";

import {
  FiDownload as Download,
  FiCalendar as CalendarDays,
  FiFileText as FileText,
  FiTrendingUp as TrendingUp,
  FiPieChart as PieChartIcon,
  FiRefreshCw as RefreshCw,
  FiDownloadCloud as FileDown,
  FiX as X,
} from "react-icons/fi";
import { 
  FaClipboardList as ClipboardList,
  FaClock as Clock,
  FaCircleCheck as CheckCircle,
  FaCircleCheck as CheckCircle2,
  FaCircleXmark as XCircle
} from "react-icons/fa6";
import { FaFileExcel as FileSpreadsheet } from "react-icons/fa";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import DashboardLayout from "../../components/DashboardLayout";
import api from "../../lib/api";
import { getSimplifiedStatus } from "../../lib/utils";

// ============================================================
// CTPO REPORTS
// ============================================================

export default function CTPOReports() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [period, setPeriod] = useState("Last 7 Days");


  const [requests, setRequests] = useState([]);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Requests currently waiting for THIS CTPO.
  // This comes from the same endpoint used by the CTPO Pending page.
  const [ctpoPendingIds, setCtpoPendingIds] = useState(new Set());

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Top report period and line-chart period are kept synchronized.
  const [chartPeriod, setChartPeriod] = useState("last7");

  // ==========================================================
  // DATE HELPERS
  // ==========================================================

  const formatInputDate = (date) => {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getPeriodDates = (selectedPeriod) => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);

    // --------------------------------------------------------
    // TODAY
    // --------------------------------------------------------

    if (selectedPeriod === "Today") {
      start = new Date(today);
      end = new Date(today);
    }

    // --------------------------------------------------------
    // THIS WEEK
    // Monday -> Today
    // --------------------------------------------------------
    else if (selectedPeriod === "This Week") {
      const day = today.getDay();

      const difference = day === 0 ? 6 : day - 1;

      start = new Date(today);

      start.setDate(today.getDate() - difference);

      end = new Date(today);
    }

    // --------------------------------------------------------
    // THIS MONTH
    // --------------------------------------------------------
    else if (selectedPeriod === "This Month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);

      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // --------------------------------------------------------
    // LAST MONTH
    // --------------------------------------------------------
    else if (selectedPeriod === "Last Month") {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);

      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    // --------------------------------------------------------
    // LAST 7 DAYS
    // --------------------------------------------------------
    else if (selectedPeriod === "Last 7 Days") {
      start = new Date(today);
      start.setDate(today.getDate() - 6);
      end = new Date(today);
    }

    // --------------------------------------------------------
    // LAST 30 DAYS
    // --------------------------------------------------------
    else if (selectedPeriod === "Last 30 Days") {
      start = new Date(today);
      start.setDate(today.getDate() - 29);
      end = new Date(today);
    }

    // --------------------------------------------------------
    // LAST 6 MONTHS
    // --------------------------------------------------------
    else if (selectedPeriod === "Last 6 Months") {
      start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      end = new Date(today);
    }

    // --------------------------------------------------------
    // THIS YEAR
    // --------------------------------------------------------
    else if (selectedPeriod === "This Year") {
      start = new Date(today.getFullYear(), 0, 1);

      end = new Date(today.getFullYear(), 11, 31);
    }

    return {
      from: formatInputDate(start),
      to: formatInputDate(end),
    };
  };

  // ==========================================================
  // PERIOD BUTTON CLICK
  // ==========================================================

  const handlePeriodChange = (selectedPeriod) => {
    setPeriod(selectedPeriod);

    const periodToChart = {
      "Last 7 Days": "last7",
      "Last 30 Days": "last30",
      "Last 6 Months": "last6m",
      "This Year": "year",
    };

    setChartPeriod(periodToChart[selectedPeriod] || "last30");
  };

  const handleChartPeriodChange = (key) => {
    const chartToPeriod = {
      last7: "Last 7 Days",
      last30: "Last 30 Days",
      last6m: "Last 6 Months",
      year: "This Year",
    };

    const selectedPeriod = chartToPeriod[key];
    if (!selectedPeriod) return;

    setChartPeriod(key);
    setPeriod(selectedPeriod);
  };

  // ==========================================================
  // LOAD CTPO REQUESTS
  // ==========================================================

  const loadRequests = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      // ------------------------------------------------------
      // 1. Load all requests for this CTPO
      // ------------------------------------------------------
      const allResponse = await api.get("/outpass/all/for-me");

      const allData = allResponse?.data;

      let loadedRequests = [];

      if (Array.isArray(allData)) {
        loadedRequests = allData;
      } else if (Array.isArray(allData?.requests)) {
        loadedRequests = allData.requests;
      } else if (Array.isArray(allData?.data)) {
        loadedRequests = allData.data;
      } else if (Array.isArray(allData?.data?.requests)) {
        loadedRequests = allData.data.requests;
      } else if (Array.isArray(allData?.results)) {
        loadedRequests = allData.results;
      }

      // ------------------------------------------------------
      // 2. Load ONLY requests currently pending for this CTPO
      // ------------------------------------------------------
      // IMPORTANT: Do not calculate CTPO pending as
      // "anything that is not approved/rejected".
      // That was causing HOD/Placement/etc. pending requests
      // to be counted as CTPO pending.
      const pendingResponse = await api.get("/outpass/pending/for-me");

      const pendingData = pendingResponse?.data;
      let pendingRequests = [];

      if (Array.isArray(pendingData)) {
        pendingRequests = pendingData;
      } else if (Array.isArray(pendingData?.requests)) {
        pendingRequests = pendingData.requests;
      } else if (Array.isArray(pendingData?.data)) {
        pendingRequests = pendingData.data;
      } else if (Array.isArray(pendingData?.data?.requests)) {
        pendingRequests = pendingData.data.requests;
      }

      const getRequestId = (request) =>
        String(request?._id || request?.id || request?.requestId || "");

      const pendingIds = new Set(
        pendingRequests.map(getRequestId).filter(Boolean),
      );

      setRequests(Array.isArray(loadedRequests) ? loadedRequests : []);

      setCtpoPendingIds(pendingIds);
      setLastUpdated(new Date());

      console.log("CTPO REPORT - all requests:", loadedRequests);

      console.log("CTPO REPORT - pending for me:", pendingRequests);
    } catch (err) {
      console.error("CTPO Reports Error:", err);

      setRequests([]);
      setCtpoPendingIds(new Set());

      setError(err?.response?.data?.message || "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // INITIAL LOAD + AUTO REFRESH
  // ==========================================================

  useEffect(() => {
    loadRequests();

    // Refresh the report data periodically so newly submitted
    // requests are reflected in the counters without changing
    // any existing report/filter functionality.
    const refreshTimer = setInterval(() => {
      loadRequests(true);
    }, 30000);

    // Refresh immediately when the user returns to this tab.
    const handleWindowFocus = () => {
      loadRequests(true);
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      clearInterval(refreshTimer);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  // ==========================================================
  // NORMALIZE REQUEST DATA
  // ==========================================================

  const normalizedRequests = useMemo(() => {
    return requests.map((request) => {
      // ----------------------------------------------------
      // STATUS
      // ----------------------------------------------------

      const status = String(
        request?.status ||
        request?.approvalStatus ||
        request?.requestStatus ||
        request?.currentStatus ||
        "",
      ).toUpperCase();

      // ----------------------------------------------------
      // PERMISSION TYPE
      // ----------------------------------------------------

      let rawType =
        request?.permissionType?.name ||
        request?.permissionType?.label ||
        request?.permissionTypeName ||
        request?.requestType ||
        request?.type ||
        request?.permissionType ||
        "Other";

      let permissionType = String(rawType);

      const typeMap = {
        OUTPASS: "Out-Pass",

        OUT_PASS: "Out-Pass",

        OUT_PASS_REQUEST: "Out-Pass",

        MESS: "Mess Fee",

        MESS_FEE: "Mess Fee",

        INTERNSHIP: "Internship",

        LIBRARY: "Library",

        WORKSHOP: "Workshop / Seminar",

        SEMINAR: "Workshop / Seminar",

        EVENT: "Event",

        INDUSTRIAL_VISIT: "Industrial Visit",

        HOSTEL_LEAVE: "Hostel Leave",
      };

      const normalizedTypeKey = permissionType
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");

      permissionType = typeMap[normalizedTypeKey] || permissionType;

      const submittedDate =
        request?.createdAt ||
        request?.submittedAt ||
        request?.submittedOn ||
        request?.date ||
        request?.created_at;

      const id = request?._id || request?.id || request?.requestId;

      return {
        ...request,

        _id: id,

        _status: status,

        _permissionType: permissionType,

        _submittedDate: submittedDate,
      };
    });
  }, [requests]);

  // ==========================================================
  // CTPO PENDING STATUS
  // ==========================================================

  const isPendingForThisCTPO = (request) => {
    const id = String(request?._id || "");
    return id && ctpoPendingIds.has(id);
  };

  // ==========================================================
  // FILTER REQUESTS BY THE SELECTED REPORT PERIOD
  // ==========================================================

  const filteredRequests = useMemo(() => {
    const dates = getPeriodDates(period);
    const start = new Date(`${dates.from}T00:00:00`);
    const end = new Date(`${dates.to}T23:59:59`);

    return normalizedRequests.filter((request) => {
      if (!request._submittedDate) return true;

      const requestDate = new Date(request._submittedDate);
      if (Number.isNaN(requestDate.getTime())) return true;

      return requestDate >= start && requestDate <= end;
    });
  }, [normalizedRequests, period]);

  // ==========================================================
  // CTPO DECISION HELPERS
  // ==========================================================

  const getApprovalStages = (request) => {
    const sources = [
      request?.approvalStages,
      request?.approvalHistory,
      request?.approvals,
      request?.workflowStages,
      request?.stages,
    ];

    return sources.filter(Array.isArray).flat();
  };

  const normalizeDecision = (value) => {
    const decision = String(value || "")
      .trim()
      .toUpperCase();

    if (
      ["APPROVED", "APPROVE", "ACCEPTED", "ACCEPT", "CLEARED"].includes(
        decision,
      )
    ) {
      return "APPROVED";
    }

    if (["REJECTED", "REJECT", "DENIED", "DENY"].includes(decision)) {
      return "REJECTED";
    }

    return "";
  };

  const getStageRole = (stage) =>
    String(
      stage?.approverRole ||
      stage?.role ||
      stage?.approver?.role ||
      stage?.authorityRole ||
      stage?.approver?.authorityRole ||
      stage?.approverType ||
      "",
    )
      .trim()
      .toUpperCase();

  const getStageDecision = (stage) =>
    normalizeDecision(
      stage?.decision ||
      stage?.action ||
      stage?.status ||
      stage?.approvalStatus,
    );

  // IMPORTANT:
  // Reports measure the CTPO's own decision.
  // CTPO APPROVED -> HOD REJECTED remains CTPO Approved.
  // Only CTPO REJECTED is counted as CTPO Rejected.
  //
  // SINGLE SOURCE OF TRUTH: This logic is kept identical to
  // CTPOHistory's getCTPODecision() so that Dashboard, History,
  // and Reports always produce the same counts.
  const getCTPODecision = (request) => {
    // --------------------------------------------------------
    // 1. DIRECT CTPO DECISION FIELD
    // --------------------------------------------------------
    const directDecision = normalizeDecision(
      request?.ctpoDecision ||
      request?.ctpoStatus ||
      request?.ctpoApprovalStatus ||
      request?.ctpoDecisionStatus,
    );

    if (directDecision) {
      return directDecision;
    }

    // --------------------------------------------------------
    // 2. APPROVAL STAGES
    // --------------------------------------------------------
    const stages = getApprovalStages(request);

    const ctpoStages = stages.filter((stage) => {
      const role = getStageRole(stage);
      return (
        (role === "CTPO" || role.includes("CTPO")) &&
        Boolean(getStageDecision(stage))
      );
    });

    if (ctpoStages.length > 0) {
      return getStageDecision(ctpoStages[ctpoStages.length - 1]);
    }

    // --------------------------------------------------------
    // 3. STATUS FALLBACK
    // --------------------------------------------------------
    const status = String(
      request?._status ||
      request?.status ||
      request?.requestStatus ||
      request?.currentStatus ||
      request?.approvalStatus ||
      "",
    )
      .trim()
      .toUpperCase();

    // CTPO explicitly rejected
    if (
      status === "REJECTED_CTPO" ||
      status === "REJECTED CTPO" ||
      status === "CTPO_REJECTED" ||
      status === "CTPO REJECTED"
    ) {
      return "REJECTED";
    }

    // Still waiting for CTPO
    if (
      status.includes("PENDING_CTPO") ||
      status.includes("PENDING CTPO")
    ) {
      return "";
    }

    // Later workflow stage means CTPO already approved
    if (
      status.includes("HOD") ||
      status.includes("WARDEN") ||
      status.includes("HOSTEL") ||
      status.includes("PLACEMENT") ||
      status.includes("DEAN") ||
      status.includes("PRINCIPAL") ||
      status.includes("SECURITY") ||
      status.includes("FACULTY") ||
      status === "PENDING_HOD" ||
      status === "PENDING_PLACEMENT_OFFICER" ||
      status === "PENDING_HOSTEL_INCHARGE" ||
      status === "APPROVED" ||
      status === "CLEARED" ||
      status === "FINALIZED" ||
      status === "COMPLETED" ||
      status === "ISSUED" ||
      status === "VERIFIED" ||
      status === "USED" ||
      status === "RETURNED"
    ) {
      return "APPROVED";
    }

    // Generic REJECTED — use rejectedByRole to determine who rejected
    if (
      status === "REJECTED" ||
      status === "DENIED" ||
      status === "REJECT"
    ) {
      const rejectedByRole = String(
        request?.rejectedByRole ||
        request?.rejectedBy?.role ||
        request?.rejectedBy?.authorityRole ||
        request?.lastActionByRole ||
        request?.lastDecisionByRole ||
        request?.lastApproverRole ||
        "",
      )
        .trim()
        .toUpperCase();

      if (
        rejectedByRole === "CTPO" ||
        rejectedByRole.includes("CTPO")
      ) {
        return "REJECTED";
      }

      if (
        rejectedByRole.includes("HOD") ||
        rejectedByRole.includes("WARDEN") ||
        rejectedByRole.includes("HOSTEL") ||
        rejectedByRole.includes("PLACEMENT") ||
        rejectedByRole.includes("DEAN") ||
        rejectedByRole.includes("PRINCIPAL") ||
        rejectedByRole.includes("SECURITY") ||
        rejectedByRole.includes("FACULTY")
      ) {
        // Another authority rejected after CTPO approved
        return "APPROVED";
      }

      if (
        request?.hodDecision ||
        request?.hodStatus ||
        request?.hodApprovalStatus ||
        request?.hodRemarks ||
        request?.hodRejectedAt ||
        request?.hostelDecision ||
        request?.placementDecision
      ) {
        return "APPROVED";
      }
    }

    return "";
  };

  const getCTPODecisionDate = (request, decision) => {
    const stage = getApprovalStages(request).find((item) => {
      const role = getStageRole(item);

      return (
        (role === "CTPO" || role.includes("CTPO")) &&
        getStageDecision(item) === decision
      );
    });

    if (stage) {
      const stageDate =
        stage?.decidedAt ||
        stage?.decisionAt ||
        (decision === "APPROVED" ? stage?.approvedAt : stage?.rejectedAt);

      if (stageDate) {
        return stageDate;
      }
    }

    if (decision === "APPROVED") {
      return (
        request?.ctpoApprovedAt ||
        request?.ctpoApprovalAt ||
        request?.approvedAt ||
        null
      );
    }

    return (
      request?.ctpoRejectedAt ||
      request?.ctpoRejectionAt ||
      request?.rejectedAt ||
      null
    );
  };

  // ==========================================================
  // STATUS HELPERS
  // ==========================================================

  const isApproved = (request) => {
    return getCTPODecision(request) === "APPROVED";
  };

  const isRejected = (request) => {
    return getCTPODecision(request) === "REJECTED";
  };

  // isPending now uses getCTPODecision() === "" — same as
  // CTPOHistory — for a single source of truth.
  const isPending = (request) => {
    return getCTPODecision(request) === "";
  };

  // ==========================================================
  // REPORT DATA
  // ==========================================================

  const reportData = useMemo(() => {
    const total = filteredRequests.length;

    // SINGLE SOURCE OF TRUTH:
    // All three counts use getCTPODecision() — identical to
    // CTPOHistory's counting logic. This guarantees:
    //   Total = Approved + Pending + Rejected
    // across Dashboard, History, and Reports.

    const pending = filteredRequests.filter((request) =>
      getCTPODecision(request) === "",
    ).length;

    const rejected = filteredRequests.filter((request) =>
      isRejected(request),
    ).length;

    const approved = filteredRequests.filter((request) =>
      isApproved(request),
    ).length;



    // --------------------------------------------------------
    // PERMISSION TYPES
    // --------------------------------------------------------

    const permissionTypes = {};

    filteredRequests.forEach((request) => {
      const type = request._permissionType || "Other";

      permissionTypes[type] = (permissionTypes[type] || 0) + 1;
    });

    // --------------------------------------------------------
    // DAILY CTPO ACTIVITY
    // --------------------------------------------------------

    const dailyMap = {};

    filteredRequests.forEach((request) => {
      const decision = getCTPODecision(request);

      // Pending has no decision yet, so keep it on the submitted date.
      // Approved / Rejected use the CTPO decision date when available.
      const dateValue =
        decision === "APPROVED" || decision === "REJECTED"
          ? getCTPODecisionDate(request, decision)
          : request._submittedDate;

      if (!dateValue) {
        return;
      }

      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const key = date.toLocaleDateString("en-CA");

      if (!dailyMap[key]) {
        dailyMap[key] = {
          date: date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          }),

          approved: 0,

          pending: 0,

          rejected: 0,
        };
      }

      if (decision === "REJECTED") {
        dailyMap[key].rejected += 1;
      } else if (decision === "") {
        // Pending = no CTPO decision yet (matches CTPOHistory counting)
        dailyMap[key].pending += 1;
      } else if (decision === "APPROVED") {
        dailyMap[key].approved += 1;
      }
    });

    const daily = Object.keys(dailyMap)
      .sort()
      .map((key) => dailyMap[key]);

    return {
      total,

      approved,

      pending,

      rejected,

      permissionTypes,

      daily,
    };
  }, [filteredRequests]);

  // ==========================================================
  // MAX DAILY VALUE
  // ==========================================================

  const maxDailyValue = Math.max(
    ...reportData.daily.map((item) =>
      Math.max(item.approved, item.pending, item.rejected),
    ),

    1,
  );

  // ==========================================================
  // CHART COLORS
  // ==========================================================

  const DONUT_COLORS = [
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#64748b",
  ];

  // ==========================================================
  // CHART PERIOD DATA
  //
  // The line chart and report totals use the SAME selected
  // period. The top dropdown and chart buttons stay synchronized.
  //
  // Rules:
  //  - Each calendar day (or month for last6m/year) in the
  //    window gets exactly one data point.
  //  - Days with no requests show 0 — never fake values.
  //  - Requests are bucketed by their submission date.
  //  - Approved / Pending / Rejected use getCTPODecision().
  //  - total = approved + pending + rejected.
  // ==========================================================

  const visibleChartData = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // --------------------------------------------------------
    // Determine window start and grouping granularity
    // --------------------------------------------------------
    let windowStart;
    let granularity; // "day" | "month"

    if (chartPeriod === "last7") {
      windowStart = new Date(today);
      windowStart.setDate(today.getDate() - 6);
      windowStart.setHours(0, 0, 0, 0);
      granularity = "day";
    } else if (chartPeriod === "last30") {
      windowStart = new Date(today);
      windowStart.setDate(today.getDate() - 29);
      windowStart.setHours(0, 0, 0, 0);
      granularity = "day";
    } else if (chartPeriod === "last6m") {
      windowStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      windowStart.setHours(0, 0, 0, 0);
      granularity = "month";
    } else {
      // "year" — 1 Jan of the current year
      windowStart = new Date(today.getFullYear(), 0, 1);
      windowStart.setHours(0, 0, 0, 0);
      granularity = "month";
    }

    // --------------------------------------------------------
    // Build the ordered set of bucket keys covering the window
    // --------------------------------------------------------
    const bucketKeys = [];

    if (granularity === "day") {
      const cursor = new Date(windowStart);
      while (cursor <= today) {
        bucketKeys.push(cursor.toLocaleDateString("en-CA")); // YYYY-MM-DD
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      // month buckets: YYYY-MM
      const cursor = new Date(
        windowStart.getFullYear(),
        windowStart.getMonth(),
        1,
      );
      const endMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      );
      while (cursor <= endMonth) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        bucketKeys.push(`${y}-${m}`);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    // Initialise all buckets with zeros
    const bucketMap = {};
    bucketKeys.forEach((key) => {
      bucketMap[key] = { approved: 0, pending: 0, rejected: 0 };
    });

    // --------------------------------------------------------
    // Bucket ALL requests by their submitted date
    // --------------------------------------------------------
    // The chart-period buttons control the rolling chart window independently of the page filter.
    normalizedRequests.forEach((request) => {
      const dateValue = request._submittedDate;
      if (!dateValue) return;

      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return;

      // Only count requests inside the window
      if (d < windowStart || d > today) return;

      let key;
      if (granularity === "day") {
        key = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
      } else {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        key = `${y}-${m}`;
      }

      if (!bucketMap[key]) return; // outside window (safety)

      const decision = getCTPODecision(request);
      if (decision === "APPROVED") {
        bucketMap[key].approved += 1;
      } else if (decision === "REJECTED") {
        bucketMap[key].rejected += 1;
      } else {
        bucketMap[key].pending += 1;
      }
    });

    // --------------------------------------------------------
    // Convert to chart-ready array with display labels
    // --------------------------------------------------------
    return bucketKeys.map((key) => {
      const { approved, pending, rejected } = bucketMap[key];
      const total = approved + pending + rejected;

      let label;
      if (granularity === "day") {
        // "DD MMM"  e.g. "15 Sep"
        const d = new Date(`${key}T00:00:00`);
        label = d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        });
      } else {
        // "MMM YY"  e.g. "Apr 26"
        const [y, m] = key.split("-");
        const d = new Date(Number(y), Number(m) - 1, 1);
        label = d.toLocaleDateString("en-IN", {
          month: "short",
          year: "2-digit",
        });
      }

      return { date: label, total, approved, pending, rejected };
    });
  }, [normalizedRequests, chartPeriod]);

  // ==========================================================
  // PIE / DONUT DATA
  // ==========================================================

  const pieData = useMemo(
    () =>
      Object.entries(reportData.permissionTypes).map(([name, value]) => ({
        name,
        value,
      })),
    [reportData.permissionTypes],
  );

  // ==========================================================
  // PERCENTAGE
  // ==========================================================

  const percentage = (value) => {
    if (!reportData.total) {
      return 0;
    }

    return Math.round((value / reportData.total) * 100);
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDateForDisplay = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // ==========================================================
  // EXPORT HANDLERS
  // ==========================================================

  const getMappedRequest = (req) => {
    const rawStudent = req.student || req.studentId || req.user || req.userId || {};
    const branchObj = req.branchId || req.branch || rawStudent.branch || rawStudent.branchId || {};

    let year = req.year || rawStudent.year || rawStudent.yearOfStudy || branchObj.year || 'Unknown Year';
    // ensure year is a string if it's an object with a name property
    if (typeof year === 'object' && year.name) year = year.name;

    let branchName = branchObj.name || branchObj.code || branchObj.branchName || req.branchName || req.branchCode || req.branch || 'Unknown Branch';
    if (typeof branchName === 'object' && branchName.name) branchName = branchName.name;

    const sectionName = req.section || rawStudent.section || '';
    const sectionBranch = `${branchName} ${sectionName}`.trim();

    const studentName = req.studentName || rawStudent.name || rawStudent.fullName || '-';
    const rollNo = req.rollNo || req.rollNumber || rawStudent.rollNo || rawStudent.rollNumber || '-';

    let permissionType = req.permissionType?.name || req.permissionType?.label || req.permissionTypeName || req.type || req.requestType || req.permissionType || '-';
    if (typeof permissionType === 'object') {
      permissionType = permissionType.name || permissionType.label || '-';
    }

    const details = req.reason || req.purpose || req.description || req.details || '-';
    const date = new Date(req.createdAt || req.requestDate || Date.now()).toLocaleDateString();
    const status = getSimplifiedStatus(req._status || req.status);

    return {
      year,
      sectionBranch,
      studentName,
      rollNo,
      permissionType,
      details,
      date,
      status
    };
  };

  const groupRequestsByYearAndSection = () => {
    const grouped = {};
    requests.forEach(req => {
      const mapped = getMappedRequest(req);

      if (!grouped[mapped.year]) grouped[mapped.year] = {};
      if (!grouped[mapped.year][mapped.sectionBranch]) grouped[mapped.year][mapped.sectionBranch] = [];

      grouped[mapped.year][mapped.sectionBranch].push(mapped);
    });
    return grouped;
  };

  const handleExportPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('CTPO Requests Report', 14, 15);

      let currentY = 25;
      const grouped = groupRequestsByYearAndSection();

      Object.keys(grouped).sort().forEach(year => {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Year: ${year}`, 14, currentY);
        currentY += 8;

        Object.keys(grouped[year]).sort().forEach(section => {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`Section/Branch: ${section}`, 18, currentY);
          currentY += 6;

          const sectionRequests = grouped[year][section];

          const headers = ['Type', 'Student', 'Roll No', 'Details', 'Date', 'Status'];
          const rows = sectionRequests.map(mapped => [
            mapped.permissionType,
            mapped.studentName,
            mapped.rollNo,
            mapped.details,
            mapped.date,
            mapped.status
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [headers],
            body: rows,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [37, 99, 235] },
            margin: { left: 18 }
          });

          currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : currentY + 30;
          if (currentY > 270) {
            doc.addPage();
            currentY = 20;
          }
        });
        currentY += 5;
      });

      doc.save('CTPO_Permission_Report.pdf');
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
      setShowGenerateModal(false);
    }
  };

  const handleExportExcel = () => {
    setExporting(true);
    try {
      const grouped = groupRequestsByYearAndSection();
      const excelRows = [];

      Object.keys(grouped).sort().forEach(year => {
        Object.keys(grouped[year]).sort().forEach(section => {
          grouped[year][section].forEach(mapped => {
            excelRows.push({
              Year: year,
              'Section/Branch': section,
              'Request Type': mapped.permissionType,
              'Student Name': mapped.studentName,
              'Roll Number': mapped.rollNo,
              'Details': mapped.details,
              'Submitted Date': mapped.date,
              'CTPO Status': mapped.status
            });
          });
        });
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "CTPO Report");
      XLSX.writeFile(wb, 'CTPO_Permission_Report.xlsx');
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
      setShowGenerateModal(false);
    }
  };

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const grouped = groupRequestsByYearAndSection();
      const rows = [];

      rows.push(['Year', 'Section/Branch', 'Student Name', 'Roll Number', 'Permission Type', 'Request Date', 'Status']);

      const escapeCSV = (val) => {
        if (val == null) return '-';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      Object.keys(grouped).sort().forEach(year => {
        Object.keys(grouped[year]).sort().forEach(section => {
          grouped[year][section].forEach(mapped => {
            rows.push([
              escapeCSV(year),
              escapeCSV(section),
              escapeCSV(mapped.studentName),
              escapeCSV(mapped.rollNo),
              escapeCSV(mapped.permissionType),
              escapeCSV(mapped.date),
              escapeCSV(mapped.status)
            ]);
          });
        });
      });

      const csvContent = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "CTPO_Permission_Report.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
      setShowGenerateModal(false);
    }
  };

  // ==========================================================
  // GENERATE REPORT BUTTON
  // ==========================================================

  const handleGenerateReport = () => {
    setShowGenerateModal(true);
  };

  // ==========================================================
  // DOWNLOAD REPORT BUTTON
  // ==========================================================

  const handleDownload = () => {
    setShowGenerateModal(true);
  };

  // ==========================================================
  // LAST UPDATED
  // ==========================================================

  const formattedLastUpdated = lastUpdated.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <DashboardLayout>
        <div
          style={{
            padding: "40px",
            textAlign: "center",
          }}
        >
          Loading report data...
        </div>
      </DashboardLayout>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <DashboardLayout>
      <div className="ctpo-reports-page">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="ctpo-reports-header">
          <div className="ctpo-reports-title-row">
            <div>
              <h1>Reports &amp; Analytics</h1>

              <p>
                Monitor permission activity, approval status and request trends.
              </p>
            </div>
          </div>

          <div className="ctpo-header-right">
            <div className="ctpo-last-updated">
              Last updated: {formattedLastUpdated}
            </div>

            {/* PERIOD DROPDOWN + EXPORT BUTTON */}
            <div className="ctpo-header-controls">
              <div className="ctpo-period-dropdown-wrap">
                <CalendarDays size={15} className="ctpo-period-dropdown-icon" />
                <select
                  id="ctpo-report-period-select"
                  className="ctpo-period-dropdown"
                  value={period}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                >
                  {[
                    "Last 7 Days",
                    "Last 30 Days",
                    "Last 6 Months",
                    "This Year",
                  ].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                id="ctpo-export-report-btn"
                className="ctpo-export-button"
                onClick={handleDownload}
              >
                <Download size={15} />
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div
            style={{
              marginBottom: "15px",
              padding: "12px 15px",
              borderRadius: "8px",
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        <div className="ctpo-report-summary-grid">
          {/* TOTAL */}

          <div className="ctpo-summary-card">
            <div className="ctpo-summary-icon blue">
              <ClipboardList size={21} />
            </div>

            <div>
              <span>Total Requests</span>

              <strong>{reportData.total}</strong>

              <small>selected period</small>
            </div>
          </div>

          {/* APPROVED */}

          <div className="ctpo-summary-card">
            <div className="ctpo-summary-icon green">
              <CheckCircle size={21} />
            </div>

            <div>
              <span>Approved</span>

              <strong>{reportData.approved}</strong>

              <small>{percentage(reportData.approved)}% of total</small>
            </div>
          </div>

          {/* PENDING */}

          <div className="ctpo-summary-card">
            <div className="ctpo-summary-icon orange">
              <Clock size={21} />
            </div>

            <div>
              <span>Pending</span>

              <strong>{reportData.pending}</strong>

              <small>{percentage(reportData.pending)}% of total</small>
            </div>
          </div>

          {/* REJECTED */}

          <div className="ctpo-summary-card">
            <div className="ctpo-summary-icon red">
              <XCircle size={21} />
            </div>

            <div>
              <span>Rejected</span>

              <strong>{reportData.rejected}</strong>

              <small>{percentage(reportData.rejected)}% of total</small>
            </div>
          </div>
        </div>

        {/* =====================================================
            CHART SECTION — Recharts
        ===================================================== */}

        <div className="ctpo-report-main-grid">

          {/* CHART 1 — PERMISSION REQUESTS TREND */}

          <div className="ctpo-report-card">
            <div className="ctpo-trend-header">
              <div>
                <h2 className="ctpo-trend-title">
                  <TrendingUp size={18} />
                  Permission Requests Trend
                </h2>
                <p className="ctpo-trend-subtitle">
                  Daily request count and status over time
                </p>
              </div>

              <div className="ctpo-chart-period-btns">
                {[
                  { key: "last7", label: "Last 7 days" },
                  { key: "last30", label: "Last 30 days" },
                  { key: "last6m", label: "Last 6 months" },
                  { key: "year", label: "This year" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={chartPeriod === key ? "ctpo-cpbtn active" : "ctpo-cpbtn"}
                    onClick={() => handleChartPeriodChange(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {visibleChartData.length === 0 ? (
              <div className="ctpo-chart-empty">
                No data available for the selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={visibleChartData}
                  margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      fontSize: "12px",
                      boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                    }}
                    itemStyle={{ color: "#334155" }}
                    labelStyle={{ color: "#0f172a", fontWeight: 700 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} fill="url(#gradTotal)" dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2} fill="url(#gradApproved)" dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" strokeWidth={2} fill="url(#gradPending)" dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="rejected" name="Rejected" stroke="#ef4444" strokeWidth={2} fill="url(#gradRejected)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* CHART 2 — PERMISSION TYPE DISTRIBUTION */}


          <div className="ctpo-report-card">
            <div className="ctpo-card-header">
              <div>
                <h2 className="ctpo-trend-title">Requests by Permission Type</h2>

                <p className="ctpo-trend-subtitle">Distribution of permission requests by type</p>
              </div>
            </div>

            {pieData.length === 0 ? (
              <div className="ctpo-chart-empty">
                No data available for the selected period
              </div>
            ) : (
              <div className="ctpo-donut-wrapper">
                {/* Recharts PieChart donut with center label */}
                <div className="ctpo-recharts-donut">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        strokeWidth={0}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                          fontSize: "12px",
                          boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                        }}
                        formatter={(value, name) => [
                          `${value} (${percentage(value)}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Dynamic center label */}
                  <div className="ctpo-donut-center-label">
                    <strong>{reportData.total}</strong>
                    <span>Total Requests</span>
                  </div>
                </div>

                {/* Legend list */}
                <div className="ctpo-type-list">
                  {pieData.map((entry, index) => (
                    <div className="ctpo-type-item" key={entry.name}>
                      <div>
                        <i
                          style={{
                            background:
                              DONUT_COLORS[index % DONUT_COLORS.length],
                          }}
                        />
                        <span>{entry.name}</span>
                      </div>
                      <div className="ctpo-type-counts">
                        <strong>{entry.value}</strong>
                        <em>{percentage(entry.value)}%</em>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* =====================================================
          STYLES
      ===================================================== */}

      <style>{`

        .ctpo-reports-page {
          overflow-x: hidden;
          max-width: 1600px;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          background: #f8fafc;
          min-height: 100%;
          color: #0f172a;
        }

        .ctpo-reports-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 22px;
        }

        .ctpo-reports-header h1 {
          margin: 0;
          font-size: clamp(25px, 2vw, 31px);
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .ctpo-reports-header p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
        }

        .ctpo-last-updated {
          color: #94a3b8;
          font-size: 12px;
          padding-top: 7px;
          white-space: nowrap;
        }

        /* ====== HEADER RIGHT CONTROLS ====== */

        .ctpo-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        .ctpo-header-controls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .ctpo-period-dropdown-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .ctpo-period-dropdown-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
        }

        .ctpo-reports-page .ctpo-period-dropdown {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          height: 44px !important;
          box-sizing: border-box;
          line-height: 1.2;
          padding: 0 14px 0 30px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          outline: none;
          appearance: auto;
          box-shadow: 0 1px 3px rgba(15,23,42,.05);
          transition: border-color .15s ease, box-shadow .15s ease;
        }

        .ctpo-reports-page .ctpo-period-dropdown::picker-icon {
          display: block;
          margin-left: auto;
          color: #64748b;
          font-size: 10px;
        }

        .ctpo-period-dropdown:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,.12);
        }

        .ctpo-export-button {
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 16px;
          border: 1px solid #10b981;
          border-radius: 8px;
          background: #10b981;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 2px 5px rgba(37,99,235,0.2);
          transition: background .18s ease, box-shadow .18s ease, transform .18s ease;
        }

        .ctpo-export-button:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(37,99,235,0.28);
        }

        .ctpo-export-button:active {
          transform: translateY(1px);
        }

          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
        }

        .ctpo-date-input {
          height: 40px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #fff;
        }

        .ctpo-date-input input {
          border: none;
          outline: none;
          width: 100%;
          color: #334155;
        }

        .ctpo-report-field select {
          height: 40px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          padding: 0 10px;
          background: #fff;
          color: #334155;
          outline: none;
        }

        .ctpo-generate-button {
          min-width: 170px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 18px;
          border: 1px solid #10b981;
          border-radius: 8px;
          background: #10b981;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(37, 99, 235, 0.18);
          transition: background .18s ease, box-shadow .18s ease, transform .18s ease;
        }

        .ctpo-generate-button:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.22);
        }

        .ctpo-generate-button:active {
          transform: translateY(1px);
        }

        .ctpo-generate-button svg {
          flex-shrink: 0;
        }

        .ctpo-report-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .ctpo-summary-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          min-height: 100px;
          padding: 20px 24px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .ctpo-summary-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ctpo-summary-icon.blue {
          background: #ecfdf5;
          color: #10b981;
        }

        .ctpo-summary-icon.green {
          background: #ecfdf5;
          color: #10b981;
        }

        .ctpo-summary-icon.orange {
          background: #fff7ed;
          color: #f59e0b;
        }

        .ctpo-summary-icon.red {
          background: #fef2f2;
          color: #ef4444;
        }

        .ctpo-summary-card span {
          display: block;
          color: #94a3b8;
          font-size: 11px;
          margin-bottom: 3px;
        }

        .ctpo-summary-card strong {
          display: block;
          font-size: 24px;
          color: #0f172a;
        }

        .ctpo-summary-card small {
          color: #94a3b8;
          font-size: 10px;
        }

        .ctpo-report-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 15px;
          margin-bottom: 16px;
          border-radius: 9px;
          background: #ecfdf5;
          color: #475569;
          border: 1px solid #d1fae5;
          font-size: 13px;
        }

        .ctpo-report-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(340px, 1fr);
          gap: 16px;
          align-items: stretch;
          margin-bottom: 16px;
        }


        .ctpo-report-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 20px;
          box-sizing: border-box;
          min-width: 0;
          overflow: hidden;
        }

        .ctpo-card-header {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .ctpo-card-header h2 {
          margin: 0;
          font-size: 17px;
          color: #0f172a;
        }

        .ctpo-card-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .ctpo-card-header > span {
          color: #94a3b8;
          font-size: 12px;
        }

        .ctpo-chart {
          height: 220px;
          display: flex;
          min-width: 0;
        }

        /* ====== TREND CHART HEADER ====== */

        .ctpo-trend-header {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          text-align: left;
        }

        .ctpo-trend-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ctpo-trend-subtitle {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        /* ====== CHART PERIOD TOGGLE BUTTONS ====== */

        .ctpo-chart-period-btns {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
        }

        .ctpo-cpbtn {
          height: 32px;
          padding: 0 16px;
          border: none;
          background: transparent;
          color: #475569;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .ctpo-cpbtn:hover:not(.active) {
          background: #e2e8f0;
          color: #1e293b;
        }

        .ctpo-cpbtn.active {
          background: #10b981;
          color: #fff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        /* ====== CHART EMPTY STATE ====== */

        .ctpo-chart-empty {
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 13px;
        }

        /* ====== DONUT CHART (Recharts) ====== */

        .ctpo-donut-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          padding: 8px 0;
          flex-wrap: wrap;
        }

        .ctpo-recharts-donut {
          position: relative;
          flex-shrink: 0;
          width: 200px;
          min-width: 160px;
        }

        .ctpo-donut-center-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          text-align: center;
        }

        .ctpo-donut-center-label strong {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }

        .ctpo-donut-center-label span {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 3px;
          white-space: nowrap;
        }

        /* ====== TYPE LIST (legend) ====== */

        .ctpo-type-list {
          flex: 1;
          min-width: 130px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ctpo-type-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          font-size: 12px;
        }

        .ctpo-type-item div {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #475569;
          flex: 1;
          min-width: 0;
        }

        .ctpo-type-item span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ctpo-type-item i {
          width: 9px;
          height: 9px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .ctpo-type-counts {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .ctpo-type-counts strong {
          font-weight: 700;
          color: #0f172a;
          font-size: 13px;
          min-width: 22px;
          text-align: right;
        }

        .ctpo-type-counts em {
          font-style: normal;
          color: #94a3b8;
          font-size: 11px;
          min-width: 36px;
          text-align: right;
        }






        .day-scholar-dot,
        .hosteller-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .day-scholar-dot {
          background: #10b981;
        }

        .hosteller-dot {
          background: #10b981;
        }






        @media (max-width: 1200px) {

          .ctpo-report-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ctpo-generate-button {
            width: 100%;
          }

          .ctpo-report-main-grid {
            grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr);
          }

          .ctpo-header-controls {
            flex-wrap: wrap;
          }

        }

        @media (max-width: 900px) {

          .ctpo-reports-page {
            padding: 0;
          }

          .ctpo-report-main-grid {
            grid-template-columns: 1fr;
          }

          .ctpo-reports-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .ctpo-header-right {
            align-items: flex-start;
            width: 100%;
          }

          .ctpo-header-controls {
            width: 100%;
          }

          .ctpo-last-updated {
            padding-top: 0;
          }

        }

        @media (max-width: 600px) {

          .ctpo-reports-page {
            padding: 0;
          }

          .ctpo-reports-header {
            margin-bottom: 16px;
          }

          .ctpo-reports-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .ctpo-reports-header h1 {
            font-size: 22px;
          }

          .ctpo-reports-header p {
            font-size: 13px;
          }

          .ctpo-header-controls {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .ctpo-period-dropdown-wrap,
          .ctpo-period-dropdown {
            width: 100%;
          }

          .ctpo-export-button {
            width: 100%;
            justify-content: center;
          }

          .ctpo-report-card {
            border-radius: 12px;
            padding: 15px;
          }

          .ctpo-period-buttons {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ctpo-period-button {
            width: 100%;
          }

          .ctpo-report-summary-grid {
            grid-template-columns: 1fr;
          }

          .ctpo-summary-card {
            padding: 15px;
          }

          .ctpo-trend-header {
            flex-direction: column;
            gap: 10px;
          }

          .ctpo-chart-period-btns {
            width: 100%;
          }

          .ctpo-cpbtn {
            flex: 1;
          }

          .ctpo-card-header {
            align-items: flex-start;
          }

          .ctpo-donut-wrapper {
            flex-direction: column;
            align-items: center;
          }

          .ctpo-recharts-donut {
            width: 100%;
            max-width: 240px;
          }

          .ctpo-type-list {
            width: 100%;
            max-height: 220px;
          }

        }

            `}</style>

      {/* ====================================================
          GENERATE REPORT MODAL
      ==================================================== */}
      {showGenerateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 490, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 35, height: 35, borderRadius: 9, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileDown size={18} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Generate Report</h2>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>Choose a format to download the selected report.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowGenerateModal(false)} style={{ border: 'none', background: '#f3f4f6', width: 29, height: 29, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 12, marginBottom: 15 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Report Scope</span><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>All CTPO Sections</span></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Report Organization</span><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Year &amp; Section</span></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Requests</span><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{requests.length}</span></div>
              </div>
            </div>

            <div style={{ marginBottom: 15 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text)', marginBottom: 7 }}>Report Includes</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {['Year-wise Analysis', 'Section/Branch-wise Analysis', 'Request Details', 'Permission Type', 'Status'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={12} style={{ color: '#10b981' }} /> {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
              <button type="button" onClick={handleExportPDF} disabled={exporting} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '11px 8px', color: '#dc2626', fontSize: 10, fontWeight: 800, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: exporting ? 0.6 : 1 }}>
                {exporting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={15} />} Download PDF
              </button>
              <button type="button" onClick={handleExportExcel} disabled={exporting} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '11px 8px', color: '#16a34a', fontSize: 10, fontWeight: 800, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: exporting ? 0.6 : 1 }}>
                {exporting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={15} />} Download Excel
              </button>
              <button type="button" onClick={handleExportCSV} disabled={exporting} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '11px 8px', color: '#0284c7', fontSize: 10, fontWeight: 800, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: exporting ? 0.6 : 1 }}>
                {exporting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={15} />} Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
