import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import StudentLayout from "../components/StudentLayout";
import api from "../lib/api";
import { getOrdinalYear } from "../lib/utils";
import { useNavigate } from "react-router-dom";

import { FiCalendar as Calendar } from "react-icons/fi";
import {
  FaClipboardList,
  FaCircleCheck,
  FaClock,
  FaCircleXmark,
  FaChartColumn,
  FaChartPie,
} from "react-icons/fa6";

import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, CartesianGrid, XAxis, YAxis
} from "recharts";

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({
    total: 0, approved: 0, rejected: 0, pending: 0, allRequests: []
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get("/outpass/mine");
      const requests = res.data.data || [];
      const total    = requests.length;
      const approved = requests.filter(r => ["APPROVED","CLEARED","ISSUED","USED"].includes(r.status)).length;
      const rejected = requests.filter(r => r.status?.startsWith("REJECTED")).length;
      const pending  = requests.filter(r => r.status?.startsWith("PENDING")).length;

      setStats({ total, approved, rejected, pending, allRequests: requests });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 15000);
    return () => clearInterval(iv);
  }, []);

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const pieData = [
    { name: "Approved", value: stats.approved, color: "#10b981" },
    { name: "Pending",  value: stats.pending,  color: "#f59e0b" },
    { name: "Rejected", value: stats.rejected, color: "#ef4444" },
  ];
  const monthlyOverview = monthNames.map((month, i) => {
    const mr = (stats.allRequests || []).filter(req => {
      const d = new Date(req.createdAt || Date.now());
      return d.getMonth() === i && d.getFullYear() === Number(selectedYear);
    });
    return {
      month,
      total: mr.length,
      approved: mr.filter(r => ["APPROVED","CLEARED","ISSUED","USED"].includes(r.status)).length,
      rejected: mr.filter(r => r.status?.startsWith("REJECTED")).length,
      pending:  mr.filter(r => r.status?.startsWith("PENDING")).length,
    };
  });

  return (
    <StudentLayout
      pageTitle={
        <div className="s-student-dashboard-heading" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: '#475569', fontSize: 16, fontWeight: 600 }}>
            Welcome back,
          </div>
          <div className="s-student-dashboard-name" style={{ fontSize: 32, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', letterSpacing: '-0.5px' }}>
            {(() => {
              const nameParts = (user?.name || "Student").trim().split(" ");
              if (nameParts.length > 1) {
                const firstPart = nameParts.slice(0, -1).join(" ");
                const lastPart = nameParts[nameParts.length - 1];
                return (
                  <>
                    <span style={{ color: '#0f172a' }}>{firstPart}</span>
                    <span style={{ color: '#10b981' }}>{lastPart}</span>
                  </>
                );
              }
              return <span style={{ color: '#0f172a' }}>{nameParts[0]}</span>;
            })()}
          </div>
          <div className="s-student-dashboard-meta" style={{ fontSize: "15px", fontWeight: 600, color: "#64748b", display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {(() => {
              const tier = String(user?.yearTier || '');
              const yr = String(user?.year || '');
              let yearStr = '';
              yearStr = getOrdinalYear(tier || yr) || (yr ? `${yr} Year` : 'Year N/A');
              const branch = user?.branchName || user?.branchId?.name || user?.branch || 'Branch N/A';
              const roll = user?.rollNo || user?.username || 'Roll N/A';

              return (
                <>
                  <span>{yearStr}</span>
                  <span className="s-student-meta-divider" style={{ color: '#cbd5e1', margin: '0 10px', fontWeight: 400 }}>|</span>
                  <span>{branch}</span>
                  <span className="s-student-meta-divider" style={{ color: '#cbd5e1', margin: '0 10px', fontWeight: 400 }}>|</span>
                  <span>{roll}</span>
                </>
              );
            })()}
          </div>
        </div>
      }
      pageSubtitle={null}
      headerRight={
        <div className="s-student-dashboard-date" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="s-loading"><div className="s-spinner" /></div>
      ) : (
        <>
          {/* ── KPI CARDS ── */}
          <div className="s-stat-grid">
            <StatCard
              label="Total Requests" value={stats.total}
              icon={<FaClipboardList size={20} />}
              iconBg="rgba(13,148,136,0.12)" iconColor="#0d9488" valueColor="#115e59"
              onClick={() => navigate("/student/my-request")}
            />
            <StatCard
              label="Pending" value={stats.pending}
              icon={<FaClock size={20} />}
              iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" valueColor="#d97706"
              onClick={() => navigate("/student/my-request", { state: { status: "Pending" } })}
            />
            <StatCard
              label="Approved" value={stats.approved}
              icon={<FaCircleCheck size={20} />}
              iconBg="rgba(22,163,74,0.12)" iconColor="#16a34a" valueColor="#16a34a"
              onClick={() => navigate("/student/my-request", { state: { status: "Approved" } })}
            />
            <StatCard
              label="Rejected" value={stats.rejected}
              icon={<FaCircleXmark size={20} />}
              iconBg="rgba(220,38,38,0.12)" iconColor="#dc2626" valueColor="#dc2626"
              onClick={() => navigate("/student/my-request", { state: { status: "Rejected" } })}
            />
          </div>

          {/* ── CHARTS ── */}
          <div className="s-chart-grid">

            {/* Area chart */}
            <div className="s-chart-card">
              <div className="s-chart-head">
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div className="s-chart-icon-tile"><FaChartColumn size={15} /></div>
                  <div>
                    <div className="s-chart-title">Monthly Permission Requests</div>
                    <div className="s-chart-sub">Total, Approved, Pending and Rejected requests per month</div>
                  </div>
                </div>
                <select className="s-year-selector" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div style={{ width:"100%", height:"260px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyOverview} margin={{ top:8, right:8, left:-22, bottom:0 }}>
                    <defs>
                      {[
                        { id:"gTotal",    c:"#0d9488" },
                        { id:"gApproved", c:"#10b981" },
                        { id:"gPending",  c:"#f59e0b" },
                        { id:"gRejected", c:"#ef4444" },
                      ].map(g => (
                        <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={g.c} stopOpacity={0.22} />
                          <stop offset="95%" stopColor={g.c} stopOpacity={0}    />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226,232,240,.50)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize:11, fill:"#94a3b8", fontWeight:500 }} dy={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize:11, fill:"#94a3b8", fontWeight:500 }} dx={-6} />
                    <Tooltip
                      contentStyle={{ borderRadius:"14px", border:"1px solid #e2e8f0", boxShadow:"0 12px 28px rgba(0,0,0,.10)", background:"rgba(255,255,255,.98)" }}
                      itemStyle={{ fontWeight:600, padding:"2px 0" }}
                      labelStyle={{ color:"#64748b", fontWeight:700, marginBottom:"4px" }}
                    />
                    <Area type="monotone" dataKey="total"    name="Total"    stroke="#0d9488" strokeWidth={2.2} fill="url(#gTotal)"    activeDot={{ r:5, fill:"#0d9488", strokeWidth:0 }} />
                    <Area type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2.2} fill="url(#gApproved)" activeDot={{ r:5, fill:"#10b981", strokeWidth:0 }} />
                    <Area type="monotone" dataKey="pending"  name="Pending"  stroke="#f59e0b" strokeWidth={2.2} fill="url(#gPending)"  activeDot={{ r:5, fill:"#f59e0b", strokeWidth:0 }} />
                    <Area type="monotone" dataKey="rejected" name="Rejected" stroke="#ef4444" strokeWidth={2.2} fill="url(#gRejected)" activeDot={{ r:5, fill:"#ef4444", strokeWidth:0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="s-chart-legend">
                {[
                  { label:"Total",    color:"#0d9488" },
                  { label:"Approved", color:"#10b981" },
                  { label:"Pending",  color:"#f59e0b" },
                  { label:"Rejected", color:"#ef4444" },
                ].map(l => (
                  <div className="s-legend-item" key={l.label}>
                    <span className="s-legend-dot" style={{ background:l.color }} />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Donut chart */}
            <div className="s-chart-card">
              <div className="s-chart-head">
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div className="s-chart-icon-tile"><FaChartPie size={15} /></div>
                  <div>
                    <div className="s-chart-title">Request Status Distribution</div>
                    <div className="s-chart-sub">Visual representation of your requests</div>
                  </div>
                </div>
              </div>

              <div style={{ position:"relative", width:"100%", height:"200px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name"
                      innerRadius={60} outerRadius={84}
                      paddingAngle={3} stroke="rgba(255,255,255,.90)" strokeWidth={3}>
                      {pieData.map(e => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius:"12px", border:"1px solid #e2e8f0", background:"rgba(255,255,255,.97)" }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:"11px", color:"#64748b", fontWeight:700 }}>Total Requests</div>
                    <div style={{ fontSize:"28px", fontWeight:800, color:"#1f2937", lineHeight:1.1 }}>{stats.total}</div>
                  </div>
                </div>
              </div>

              <div className="s-chart-legend" style={{ gap:"14px" }}>
                {pieData.map(e => (
                  <div className="s-legend-item" key={e.name}>
                    <span className="s-legend-dot" style={{ background:e.color, borderRadius:"50%" }} />
                    <span>{e.name}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}
    </StudentLayout>
  );
}

function StatCard({ label, value, icon, iconBg, iconColor, valueColor, onClick }) {
  return (
    <div
      className="s-stat-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
    >
      <div className="s-stat-icon" style={{ background:iconBg, color:iconColor }}>{icon}</div>
      <div>
        <div className="s-stat-label">{label}</div>
        <div className="s-stat-value" style={{ color:valueColor }}>{value}</div>
      </div>
    </div>
  );
}
