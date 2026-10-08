import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

import { 
  FiBarChart2 as BarChart3,
  FiArrowRight as ArrowRight,
  FiDownload as Download,
  FiX as X,
  FiDownloadCloud as FileDown,
  FiRefreshCw as RefreshCw,
  FiFileText as FileText,
  FiCalendar as Calendar
} from "react-icons/fi";
import { 
  FaClipboardList as ClipboardList,
  FaClock as Clock,
  FaCircleCheck as CheckCircle2,
  FaCircleXmark as XCircle
} from "react-icons/fa6";
import { FaBuilding as Building, FaFileExcel as FileSpreadsheet } from "react-icons/fa";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ============================================================
// CTPO DASHBOARD
// ============================================================

const CTPODashboard = () => {
  const navigate = useNavigate();

  // ==========================================================
  // LIVE CTPO DASHBOARD DATA
  // ==========================================================

  const { user, logout } = useAuth();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Use the SAME endpoint used by the working All Requests page.
  // This keeps dashboard cards/charts synchronized with All Requests.
  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const response = await api.get("/outpass/all/for-me");
      const responseData = response?.data;

      const data = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.data)
          ? responseData.data
          : Array.isArray(responseData?.requests)
            ? responseData.requests
            : Array.isArray(responseData?.data?.requests)
              ? responseData.data.requests
              : [];

      setRequests(data);
    } catch (error) {
      console.error("Failed to load CTPO dashboard data:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Refresh so the dashboard follows new approvals/rejections.
    const interval = setInterval(loadDashboardData, 10000);

    return () => clearInterval(interval);
  }, []);

  // ==========================================================
  // STATUS HELPERS
  // ==========================================================

  const getStatus = (request) => {
    return String(
      request?.status ||
      request?.requestStatus ||
      request?.currentStatus ||
      request?.approvalStatus ||
      "",
    ).toUpperCase();
  };

  // ==========================================================
  // CTPO DECISION HELPERS
  // IMPORTANT:
  // The Approved / Rejected cards must represent ONLY the
  // CTPO's own decision, not the final request status.
  //
  // Example:
  // CTPO APPROVED -> HOD PENDING  => Approved = 1
  // CTPO APPROVED -> HOD APPROVED => Approved = 1
  // CTPO APPROVED -> HOD REJECTED => Approved = 1
  // CTPO REJECTED                  => Rejected = 1
  // ==========================================================

  const getApprovalStages = (request) => {
    const sources = [
      request?.approvalStages,
      request?.approvalHistory,
      request?.approvals,
      request?.workflowStages,
      request?.stages,
      request?.approvalSteps,
      request?.steps,
      request?.workflowHistory,
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

  const getStageRole = (stage) => {
    return String(
      stage?.approverRole ||
      stage?.role ||
      stage?.approver?.role ||
      stage?.authorityRole ||
      stage?.approver?.authorityRole ||
      stage?.approverType ||
      stage?.stepRole ||
      "",
    )
      .trim()
      .toUpperCase();
  };

  const getStageDecision = (stage) => {
    const directDecision = normalizeDecision(
      stage?.decision ||
      stage?.action ||
      stage?.status ||
      stage?.approvalStatus ||
      stage?.result,
    );

    if (directDecision) {
      return directDecision;
    }

    if (stage?.approved === true || stage?.isApproved === true) {
      return "APPROVED";
    }

    if (stage?.rejected === true || stage?.isRejected === true) {
      return "REJECTED";
    }

    return "";
  };

  const getDecisionAuthorityText = (request) => {
    const values = [
      request?.rejectedByRole,
      request?.rejectedBy?.role,
      request?.rejectedBy?.authorityRole,
      request?.lastActionByRole,
      request?.lastDecisionByRole,
      request?.lastApproverRole,
      request?.currentApproverRole,
      request?.currentAuthorityRole,
      request?.currentStage?.role,
      request?.currentStage?.approverRole,
      request?.currentStage?.authorityRole,
      request?.lastStage?.role,
      request?.lastStage?.approverRole,
      request?.lastStage?.authorityRole,
      request?.rejection?.role,
      request?.rejection?.rejectedByRole,
      request?.rejection?.authorityRole,
    ];

    return values
      .filter(Boolean)
      .map((value) => {
        if (typeof value === "object") {
          return [
            value?.role,
            value?.authorityRole,
            value?.name,
            value?.label,
            value?.title,
          ]
            .filter(Boolean)
            .join(" ");
        }

        return String(value);
      })
      .join(" ")
      .trim()
      .toUpperCase();
  };

  const getCTPODecision = (request) => {
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
    // CHECK APPROVAL STAGES
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
    // WORKFLOW STATUS FALLBACK
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

    // CTPO rejected
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

    // Later workflow means CTPO approved
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
      status === "FINALIZED" ||
      status === "COMPLETED" ||
      status === "ISSUED" ||
      status === "VERIFIED" ||
      status === "USED" ||
      status === "RETURNED"
    ) {
      return "APPROVED";
    }

    // Plain rejected
    if (
      status === "REJECTED" ||
      status === "DENIED" ||
      status === "REJECT"
    ) {
      const authorityText = getDecisionAuthorityText(request);

      if (authorityText.includes("CTPO")) {
        return "REJECTED";
      }

      if (
        authorityText.includes("HOD") ||
        authorityText.includes("WARDEN") ||
        authorityText.includes("HOSTEL") ||
        authorityText.includes("PLACEMENT") ||
        authorityText.includes("DEAN") ||
        authorityText.includes("PRINCIPAL") ||
        authorityText.includes("SECURITY") ||
        authorityText.includes("FACULTY")
      ) {
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

  // ONLY CTPO approval counts here.
  const isApproved = (request) => {
    return getCTPODecision(request) === "APPROVED";
  };

  // ONLY CTPO rejection counts here.
  const isRejected = (request) => {
    return getCTPODecision(request) === "REJECTED";
  };

  // Only requests waiting for THIS CTPO are in the CTPO pending queue.
  const isPendingForCTPO = (request) => {
    const status = getStatus(request);

    return status.includes("PENDING_CTPO") || status.includes("PENDING CTPO");
  };

  // ==========================================================
  // SUMMARY CARDS
  // ==========================================================
  //
  // SINGLE SOURCE OF TRUTH:
  // All three counts (approved, rejected, pending) are derived
  // from getCTPODecision() — exactly the same function used by
  // CTPOHistory and CTPOReports. This guarantees:
  //   Total = Approved + Pending + Rejected
  //
  // DO NOT use isPendingForCTPO() here — that only catches
  // PENDING_CTPO statuses and misses requests whose
  // getCTPODecision() returns "" for other reasons.

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => getCTPODecision(r) === "").length,
      approved: requests.filter(isApproved).length,
      rejected: requests.filter(isRejected).length,
    };
  }, [requests]);

  // ==========================================================
  // PERMISSION TYPE
  // ==========================================================

  const getPermissionType = (request) => {
    const rawType =
      request?.permissionType ||
      request?.requestType ||
      request?.type ||
      request?.permission?.type ||
      request?.permissionTypeId?.name ||
      request?.permissionTypeId?.type ||
      "";

    if (typeof rawType === "object" && rawType !== null) {
      return String(
        rawType?.name || rawType?.label || rawType?.type || "Other",
      );
    }

    const type = String(rawType).trim().toUpperCase();

    if (
      type.includes("OUTPASS") ||
      type.includes("OUT-PASS") ||
      type.includes("OUT_PASS") ||
      type.includes("OUT PASS")
    ) {
      return "Out-Pass";
    }

    if (type.includes("INTERNSHIP")) {
      return "Internship";
    }

    if (type.includes("LIBRARY")) {
      return "Library";
    }

    if (type.includes("MESS")) {
      return "Mess";
    }

    return rawType ? String(rawType) : "Other";
  };

  const permissionTypeData = useMemo(() => {
    const counts = {};

    requests.forEach((request) => {
      const type = getPermissionType(request);
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [requests]);

  const requestStatusData = useMemo(() => {
    return [
      { name: 'Approved', value: stats.approved, color: '#10b981' },
      { name: 'Pending', value: stats.pending, color: '#f59e0b' },
      { name: 'Rejected', value: stats.rejected, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [stats]);
  // ==========================================================
  // APPROVAL ACTIVITY - LAST 7 DAYS
  // ==========================================================
  // Uses the SAME request data already loaded by the dashboard.
  //
  // Bucketing strategy: use the request submission date
  // (createdAt / submittedAt) as the bucket key. This is the
  // most reliable date field — the backend always sets it when
  // a student submits a request, whereas CTPO-specific decision
  // timestamps are rarely exposed on the /all/for-me endpoint.
  //
  // The CTPO decision (APPROVED / REJECTED / pending) is still
  // derived from getCTPODecision() so downstream approvals /
  // rejections never affect the graph counts.
  //
  // All 7 days are always present with genuine 0 values on days
  // that have no activity.
  // ==========================================================

  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - 6);
    windowStart.setHours(0, 0, 0, 0);

    // --------------------------------------------------------
    // Build one bucket per calendar day (last 7 days)
    // --------------------------------------------------------
    const bucketKeys = [];
    const cursor = new Date(windowStart);

    while (cursor <= today) {
      bucketKeys.push(cursor.toLocaleDateString("en-CA")); // YYYY-MM-DD
      cursor.setDate(cursor.getDate() + 1);
    }

    const bucketMap = {};
    bucketKeys.forEach((key) => {
      bucketMap[key] = { approved: 0, rejected: 0 };
    });

    // --------------------------------------------------------
    // Bucket each request by its CTPO decision date
    // --------------------------------------------------------
    requests.forEach((request) => {
      const decision = getCTPODecision(request);
      if (!decision || decision === "") return; // Only count approved/rejected

      // Try to find when CTPO made the decision
      let decisionDateValue = null;

      const stages = getApprovalStages(request);
      const ctpoStage = stages.find(
        (item) => {
          const role = String(item?.role || item?.approverRole || item?.approverType || "").toUpperCase();
          return (
            (role === "CTPO" || role.includes("CTPO")) &&
            (
              normalizeDecision(item?.decision || item?.action || item?.status || item?.approvalStatus) === decision
            )
          );
        }
      );

      if (ctpoStage) {
        decisionDateValue = ctpoStage?.decidedAt || ctpoStage?.decisionAt || (decision === "APPROVED" ? ctpoStage?.approvedAt : ctpoStage?.rejectedAt);
      }

      if (!decisionDateValue) {
        if (decision === "APPROVED") {
          decisionDateValue = request?.ctpoApprovedAt || request?.ctpoApprovalAt || request?.approvedAt || request?.updatedAt;
        } else {
          decisionDateValue = request?.ctpoRejectedAt || request?.ctpoRejectionAt || request?.rejectedAt || request?.updatedAt;
        }
      }

      if (!decisionDateValue) return;

      const d = new Date(decisionDateValue);
      if (Number.isNaN(d.getTime())) return;

      // Only include days in the 7-day window
      if (d < windowStart || d > today) return;

      const key = d.toLocaleDateString("en-CA");
      if (!bucketMap[key]) return;

      if (decision === "APPROVED") {
        bucketMap[key].approved += 1;
      } else if (decision === "REJECTED") {
        bucketMap[key].rejected += 1;
      }
    });

    // --------------------------------------------------------
    // Convert to chart-ready array with display labels
    // --------------------------------------------------------
    const result = bucketKeys.map((key) => {
      const { approved, rejected } = bucketMap[key];
      const d = new Date(`${key}T00:00:00`);
      return {
        date: d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        }),
        approved,
        rejected,
      };
    });

    console.log("CTPO Approval Activity Chart Data:", result);
    return result;
  }, [requests]);

  // ==========================================================
  // CURRENT CTPO IDENTITY
  // ==========================================================

  const getBranchName = () => {
    const possibleBranches = [
      user?.branchName,
      user?.branchCode,
      user?.branch?.name,
      user?.branch?.code,
      user?.branch?.branchName,
      user?.branchId?.name,
      user?.branchId?.code,
      user?.branchId?.branchName,
      user?.organization?.branch?.name,
      user?.organization?.branch?.code,
      user?.organization?.branchName,
      user?.department?.name,
      user?.department?.code,
    ];

    const branch = possibleBranches.find(
      (value) =>
        typeof value === "string" &&
        value.trim() &&
        !/^[a-f\d]{20,}$/i.test(value.trim()),
    );

    if (branch) {
      return String(branch).trim().toUpperCase();
    }

    // Try parsing from username, facultyId, or name (e.g. "4ktcsm", "2ktcai", "ctpo_csm", "4th Year CSM CTPO")
    const identifiers = [user?.username, user?.facultyId, user?.code, user?.name];
    for (const id of identifiers) {
      if (typeof id === 'string') {
        const m = id.match(/(?:[1-4]kt|ctpo_|\b(?:1st|2nd|3rd|4th)\s+Year\s+)([a-z0-9]+)/i);
        if (m && m[1]) {
          return m[1].toUpperCase();
        }
      }
    }

    // If branch is not directly available in user,
    // get it from the CTPO request data.
    const firstRequest = requests[0];

    const requestBranches = [
      firstRequest?.branchName,
      firstRequest?.branchCode,
      firstRequest?.branch?.name,
      firstRequest?.branch?.code,
      firstRequest?.student?.branchName,
      firstRequest?.student?.branchCode,
      firstRequest?.student?.branch?.name,
      firstRequest?.student?.branch?.code,
      firstRequest?.studentId?.branchName,
      firstRequest?.studentId?.branchCode,
      firstRequest?.studentId?.branch?.name,
      firstRequest?.studentId?.branch?.code,
    ];

    const requestBranch = requestBranches.find(
      (value) =>
        typeof value === "string" &&
        value.trim() &&
        !/^[a-f\d]{20,}$/i.test(value.trim()),
    );

    return requestBranch ? String(requestBranch).trim().toUpperCase() : "";
  };

  const getYearLabel = () => {
    const possibleYears = [
      user?.assignedYear,
      user?.yearTier,
      user?.academicYear,
      user?.yearLabel,
      user?.year?.name,
      user?.year?.label,
      user?.year?.value,
      user?.year,
    ];

    for (const val of possibleYears) {
      if (!val) continue;
      if (val === 1 || val === "1" || /1st|TIER_1ST/i.test(String(val))) return "1st Year";
      if (val === 2 || val === "2" || /2nd|TIER_2ND/i.test(String(val))) return "2nd Year";
      if (val === 3 || val === "3" || /3rd|TIER_3RD/i.test(String(val))) return "3rd Year";
      if (val === 4 || val === "4" || /4th|TIER_4TH/i.test(String(val))) return "4th Year";
    }

    const identifiers = [user?.username, user?.facultyId, user?.code, user?.name];
    for (const id of identifiers) {
      if (typeof id === 'string') {
        const m = id.match(/^([1-4])kt/i);
        if (m && m[1]) {
          const y = parseInt(m[1], 10);
          if (y === 1) return "1st Year";
          if (y === 2) return "2nd Year";
          if (y === 3) return "3rd Year";
          if (y === 4) return "4th Year";
        }
        if (/2nd\s*year/i.test(id)) return "2nd Year";
        if (/3rd\s*year/i.test(id)) return "3rd Year";
        if (/4th\s*year/i.test(id)) return "4th Year";
      }
    }

    const firstReq = requests[0];
    if (firstReq?.yearTier) {
      if (/2/i.test(firstReq.yearTier)) return "2nd Year";
      if (/3/i.test(firstReq.yearTier)) return "3rd Year";
      if (/4/i.test(firstReq.yearTier)) return "4th Year";
    }
    if (firstReq?.year) {
      const y = parseInt(firstReq.year, 10);
      if (y === 1) return "1st Year";
      if (y === 2) return "2nd Year";
      if (y === 3) return "3rd Year";
      if (y === 4) return "4th Year";
    }

    return "";
  };

  const getCTPOCode = () => {
    const possibleCodes = [
      user?.ctpoCode,
      user?.ctpo?.code,
      user?.username,
      user?.code,
    ];

    const code = possibleCodes.find(
      (value) =>
        typeof value === "string" &&
        value.trim() &&
        !/^[a-f\d]{20,}$/i.test(value.trim()),
    );

    return code ? String(code).trim().toUpperCase() : "";
  };

  const branchName = getBranchName();
  const yearLabel = getYearLabel();
  const ctpoCode = getCTPOCode();

  const ctpoIdentity = [
    yearLabel,
    branchName,
    "CTPO",
    ctpoCode ? `(${ctpoCode})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ==========================================================
  // PIE CHART COLORS
  // ==========================================================

  const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];

  const PERMISSION_TYPE_COLORS = {
    "Out-Pass": "#10b981",
    "Internship": "#f59e0b",
    "Mess": "#3b82f6",
    "Library": "#8b5cf6",
  };

  const getPermissionTypeColor = (name, index = 0) => {
    return PERMISSION_TYPE_COLORS[name] || PIE_COLORS[index % PIE_COLORS.length] || "#10b981";
  };

  // ==========================================================
  // CARD STYLE
  // ==========================================================

  const statCardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    minHeight: "100px",
    padding: "20px 24px",
    boxSizing: "border-box",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
    display: "flex",
    alignItems: "center",
    gap: "16px"
  };

  // ==========================================================
  // CLICKABLE CARD STYLE
  // ==========================================================

  const clickableCardStyle = {
    ...statCardStyle,
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
  };

  // ==========================================================
  // EXPORT HANDLERS
  // ==========================================================

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <DashboardLayout>
      {/* ======================================================
          MAIN CONTAINER
      ====================================================== */}

      <div
        className="ctpo-dashboard"
        style={{
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ color: '#475569', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  Welcome back,
                </div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  CTPO <span style={{ color: '#64748b', fontWeight: 400 }}>|</span> <span style={{ color: '#10b981' }}>{branchName || 'All Branches'}</span>
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "16px", fontWeight: 600, color: "#64748b" }}>
                  {yearLabel ? yearLabel : 'All Years'}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Calendar size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            TOP SUMMARY CARDS
        ==================================================== */}

        <div
          className="ctpo-kpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "14px",
            width: "100%",
            marginBottom: "16px",
          }}
        >
          {/* ==================================================
              TOTAL REQUESTS
          ================================================== */}

          <div
            onClick={() => navigate('/ctpo/history')}
            style={clickableCardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.06)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ecfdf5",
                color: "#10b981",
                flexShrink: 0,
              }}
            >
              <ClipboardList size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#64748b",
                }}
              >
                Total Requests
              </div>
              <div
                style={{
                  fontSize: "28px",
                  lineHeight: 1,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {loading ? "…" : stats.total}
              </div>
            </div>
          </div>

          {/* ==================================================
              PENDING QUEUE
          ================================================== */}

          <div
            onClick={() => navigate('/ctpo/pending')}
            style={clickableCardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.06)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff7ed",
                color: "#f59e0b",
                flexShrink: 0,
              }}
            >
              <Clock size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#64748b",
                }}
              >
                Pending
              </div>
              <div
                style={{
                  fontSize: "28px",
                  lineHeight: 1,
                  fontWeight: 800,
                  color: "#d97706",
                }}
              >
                {loading ? "…" : stats.pending}
              </div>
            </div>
          </div>

          {/* ==================================================
              APPROVED
              IMPORTANT:
              Goes directly to Approved tab in CTPO History
          ================================================== */}

          <div
            onClick={() => navigate('/ctpo/history?status=APPROVED')}
            style={clickableCardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.06)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ecfdf5",
                color: "#059669",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#64748b",
                }}
              >
                Approved
              </div>
              <div
                style={{
                  fontSize: "28px",
                  lineHeight: 1,
                  fontWeight: 800,
                  color: "#059669",
                }}
              >
                {loading ? "…" : stats.approved}
              </div>
            </div>
          </div>

          {/* ==================================================
              REJECTED
              IMPORTANT:
              Goes directly to Rejected tab in CTPO History
          ================================================== */}

          <div
            onClick={() => navigate('/ctpo/history?status=REJECTED')}
            style={clickableCardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.06)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fef2f2",
                color: "#ef4444",
                flexShrink: 0,
              }}
            >
              <XCircle size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#64748b",
                }}
              >
                Rejected
              </div>
              <div
                style={{
                  fontSize: "28px",
                  lineHeight: 1,
                  fontWeight: 800,
                  color: "#dc2626",
                }}
              >
                {loading ? "…" : stats.rejected}
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            CHARTS SECTION
        ==================================================== */}

        <div
          className="ctpo-charts-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)",
            gap: "18px",
            width: "100%",
            marginBottom: "16px",
          }}
        >
          {/* ==================================================
              APPROVAL ACTIVITY
          ================================================== */}

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "20px 24px",
              boxSizing: "border-box",
              minHeight: "300px",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "8px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Approval Activity (Last 7 Days)
                </h2>

                <p
                  style={{
                    margin: "5px 0 0 0",
                    fontSize: "14px",
                    color: "#64748b",
                  }}
                >
                  Daily count of approved and rejected decisions
                </p>
              </div>

              <span
                style={{
                  fontSize: "13px",
                  color: "#94a3b8",
                  paddingTop: "2px",
                }}
              >
                Daily Volume
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: "220px",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 12,
                      fill: "#64748b",
                    }}
                    axisLine={{
                      stroke: "#94a3b8",
                    }}
                    tickLine={false}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 12,
                      fill: "#64748b",
                    }}
                    axisLine={{
                      stroke: "#94a3b8",
                    }}
                    tickLine={false}
                  />

                  <Tooltip />

                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    iconType="square"
                  />

                  <Bar
                    dataKey="approved"
                    name="Approved"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    barSize={38}
                  />

                  <Bar
                    dataKey="rejected"
                    name="Rejected"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    barSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ==================================================
              REQUESTS BY PERMISSION TYPE
          ================================================== */}

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "20px 24px",
              boxSizing: "border-box",
              minHeight: "300px",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "4px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  maxWidth: "220px",
                  fontSize: "18px",
                  lineHeight: 1.35,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Request Status Distribution
              </h2>

              <span
                style={{
                  fontSize: "13px",
                  lineHeight: 1.4,
                  color: "#64748b",
                  textAlign: "left",
                  maxWidth: "110px",
                }}
              >
                Visual representation of your requests
              </span>
            </div>

            <div
              className="ctpo-pie-wrapper"
              style={{
                width: "100%",
                height: "220px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={requestStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="48%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="rgba(255,255,255,.90)" 
                    strokeWidth={3}
                  >
                    {requestStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:"12px", border:"1px solid #e2e8f0", background:"rgba(255,255,255,.97)" }} />
                </PieChart>
              </ResponsiveContainer>

              {/* LEGEND */}

              <div
                className="ctpo-pie-legend"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                  marginLeft: "-5px",
                  minWidth: "105px",
                }}
              >
                {requestStatusData.map((item, index) => {
                  const color = item.color;
                  return (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "7px",
                        fontSize: "13px",
                        color: color,
                      }}
                    >
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          display: "inline-block",
                          background: color,
                        }}
                      />

                      {item.name}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            GET DETAILED INSIGHTS
            Reference: HOD Dashboard
        ==================================================== */}

        <div
          className="ctpo-insights-card"
          style={{
            borderRadius: 10,
            border: "1px solid #e4e7ff",
            background:
              "linear-gradient(100deg, #ecfdf5 0%, #f8fafc 55%, #ecfdf5 100%)",
            padding: "15px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 15,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "#d1fae5",
                color: "#1d4ed8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BarChart3 size={21} />
            </div>

            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#172554",
                }}
              >
                Get Detailed Insights
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                View detailed analytics and download CTPO reports.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/ctpo/reports")}
            style={{
              border: "none",
              borderRadius: 7,
              background: "#10b981",
              color: "#ffffff",
              padding: "9px 14px",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(37,99,235,0.18)",
            }}
          >
            Go to Reports
            <ArrowRight size={14} />
          </button>
        </div>

      </div>

      {/* ====================================================
          GENERATE REPORT MODAL
      ==================================================== */}
    </DashboardLayout>
  );
};

export default CTPODashboard;
