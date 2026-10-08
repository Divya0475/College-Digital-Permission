import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../lib/api';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart2,
  TrendingUp,
  PieChart as PieChartIcon,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Calendar,
  Download,
  ChevronDown,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

const TYPE_COLORS = {
  'Outpass': '#10b981',
  'Internship': '#10B981',
  'Mess Fee': '#F59E0B',
  'Library': '#10b981'
};

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30days');
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = async (selectedRange = range) => {
    try {
      const res = await api.get(`/admin/reports/analytics?range=${selectedRange}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (e) {
      console.error('Error fetching reports analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range);
    const interval = setInterval(() => fetchAnalytics(range), 10000);
    return () => clearInterval(interval);
  }, [range]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await api.get(`/admin/reports/export?range=${range}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Permission_Analytics_Report_${range}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export report error:', e);
      alert('Failed to download Excel report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="loading-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div className="spinner spinner-lg" />
        </div>
      </DashboardLayout>
    );
  }

  const summary = data?.summary || {
    totalRequests: { count: 0, trend: '0%' },
    approved: { count: 0, percentage: 0, trend: '0%' },
    pending: { count: 0, percentage: 0, trend: '0%' },
    rejected: { count: 0, percentage: 0, trend: '0%' }
  };

  const requestsTrend = data?.requestsTrend || [];
  const typeDistribution = data?.typeDistribution || [];
  const statusAnalysis = data?.statusAnalysis || [];
  const requestsByTypeChart = data?.requestsByTypeChart || [];

  const totalRequestsCount = summary.totalRequests.count || 0;

  // Render trend badge
  const renderTrendBadge = (trendStr, isPositiveGood = true) => {
    const isUp = trendStr.startsWith('+') || trendStr.includes('â†‘');
    const isPositive = (isUp && isPositiveGood) || (!isUp && !isPositiveGood);
    const color = isPositive ? '#166534' : '#991B1B';
    const bg = isPositive ? '#DCFCE7' : '#FEE2E2';

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '12px',
        fontWeight: 600,
        color: color,
        backgroundColor: bg,
        padding: '2px 8px',
        borderRadius: '12px'
      }}>
        {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {trendStr.replace('+', '')} vs last month
      </span>
    );
  };

  return (
    <DashboardLayout>
      {/* Top Header Bar */}
      <div className="admin-header-row">
        <div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#0F172A',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0,
            letterSpacing: '-0.3px'
          }}>
            <BarChart2 size={24} color="#10b981" />
            <span>Reports & Analytics</span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Monitor permission activity, approval status and request trends.
          </p>
        </div>

        {/* Top Right Header Controls (Desktop View Only) */}
        <div className="admin-header-controls reports-desktop-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Date Filter Dropdown */}
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                display: 'flex',
                alignItems: 'center',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 32px 8px 34px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                outline: 'none'
              }}
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="6months">Last 6 Months</option>
              <option value="thisyear">This Year</option>
            </select>
            <Calendar size={15} color="#64748B" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
            <ChevronDown size={14} color="#64748B" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
          </div>

          {/* Export Report Button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#10b981',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#ffffff',
              cursor: exporting ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            <Download size={15} color="#ffffff" />
            <span>{exporting ? 'Exporting...' : 'Export Report'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards Row */}
      <div className="admin-summary-grid">
        {/* Card 1: Total Requests */}
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #d1fae5',
          borderRadius: '14px',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '118px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#d1fae5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText size={18} color="#10b981" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1E40AF' }}>Total Requests</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                {summary.totalRequests.count.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', marginTop: '4px' }}>
                All permission requests
              </div>
            </div>
            <div>
              {renderTrendBadge(summary.totalRequests.trend, true)}
            </div>
          </div>
        </div>

        {/* Card 2: Approved */}
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #DCFCE7',
          borderRadius: '14px',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '118px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={18} color="#166534" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>Approved</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                {summary.approved.count.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', marginTop: '4px' }}>
                {summary.approved.percentage}% of total
              </div>
            </div>
            <div>
              {renderTrendBadge(summary.approved.trend, true)}
            </div>
          </div>
        </div>

        {/* Card 3: Pending */}
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FEF3C7',
          borderRadius: '14px',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '118px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Clock size={18} color="#B45309" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#B45309' }}>Pending</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                {summary.pending.count.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', marginTop: '4px' }}>
                {summary.pending.percentage}% of total
              </div>
            </div>
            <div>
              {renderTrendBadge(summary.pending.trend, false)}
            </div>
          </div>
        </div>

        {/* Card 4: Rejected */}
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FEE2E2',
          borderRadius: '14px',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '118px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <XCircle size={18} color="#991B1B" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#991B1B' }}>Rejected</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                {summary.rejected.count.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', marginTop: '4px' }}>
                {summary.rejected.percentage}% of total
              </div>
            </div>
            <div>
              {renderTrendBadge(summary.rejected.trend, false)}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Only Controls Box (Positioned after 4 Summary Cards and before Permission Requests Trend) */}
      <div className="reports-mobile-controls-box">
        {/* Date Filter Dropdown */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              width: '100%',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 32px 0 36px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="6months">Last 6 Months</option>
            <option value="thisyear">This Year</option>
          </select>
          <Calendar size={16} color="#64748B" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
          <ChevronDown size={14} color="#64748B" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
        </div>

        {/* Export Report Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            width: '100%',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#10b981',
            border: 'none',
            borderRadius: '8px',
            padding: '0 18px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#ffffff',
            cursor: exporting ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
            boxSizing: 'border-box'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
        >
          <Download size={16} color="#ffffff" />
          <span>{exporting ? 'Exporting...' : 'Export Report'}</span>
        </button>
      </div>

      {/* Main Charts Row 1 */}
      <div className="admin-reports-grid-1">
        {/* Left Card: Permission Requests Trend */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.03)'
        }}>
          <div className="admin-report-trend-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <TrendingUp size={18} color="#10b981" />
                <span>Permission Requests Trend</span>
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Daily request count and status over time
              </p>
            </div>

            {/* Time Filter Tabs */}
            <div className="admin-report-trend-tabs" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#F1F5F9',
              padding: '4px',
              borderRadius: '8px',
              flexWrap: 'wrap'
            }}>
              {[
                { label: 'Last 7 days', val: '7days' },
                { label: 'Last 30 days', val: '30days' },
                { label: 'Last 6 months', val: '6months' },
                { label: 'This year', val: 'thisyear' }
              ].map(t => (
                <button
                  key={t.val}
                  onClick={() => setRange(t.val)}
                  className="admin-report-trend-tab"
                  style={{
                    border: 'none',
                    backgroundColor: range === t.val ? '#10b981' : 'transparent',
                    color: range === t.val ? '#FFFFFF' : '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Area / Line Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={requestsTrend} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                  padding: '12px 16px'
                }}
              />
              <Area type="monotone" dataKey="Total" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" />
              <Area type="monotone" dataKey="Approved" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorApproved)" />
              <Line type="monotone" dataKey="Pending" stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Rejected" stroke="#EF4444" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Custom Bottom Legend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            marginTop: '12px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#475569',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
              <span>Total</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              <span>Approved</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              <span>Pending</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              <span>Rejected</span>
            </div>
          </div>
        </div>

        {/* Right Card: Permission Type Distribution */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <PieChartIcon size={18} color="#10b981" />
              <span>Permission Type Distribution</span>
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Total requests by permission type
            </p>
          </div>

          <div className="admin-donut-wrap" style={{ marginTop: '10px' }}>
            {/* Donut Chart with Overlay Label */}
            <div style={{ position: 'relative', width: '180px', height: '220px', flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={3}
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }}
                    formatter={(val, name) => [`${val} requests`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
                  {totalRequestsCount.toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#64748B', marginTop: '2px' }}>
                  Total Requests
                </div>
              </div>
            </div>

            {/* Side Legend Table */}
            <div style={{ flex: 1, overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {typeDistribution.map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < typeDistribution.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '10px 0', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            backgroundColor: t.color,
                            flexShrink: 0
                          }} />
                          <span>{t.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        {t.count}
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                        {t.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row 2 */}
      <div className="admin-reports-grid-2">
        {/* Left Card: Permission Status Analysis Table */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.03)'
        }}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Layers size={18} color="#10b981" />
              <span>Permission Status Analysis</span>
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Approval status breakdown by permission type
            </p>
          </div>

          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Permission Type</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Total Requests</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Approved</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Pending</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Rejected</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Approval Rate</th>
                </tr>
              </thead>
              <tbody>
                {statusAnalysis.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                      {row.permissionType}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                      {row.totalRequests}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#166534' }}>
                      {row.approved}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#B45309' }}>
                      {row.pending}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#991B1B' }}>
                      {row.rejected}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', minWidth: '42px' }}>
                          {row.approvalRate}%
                        </span>
                        <div style={{ flex: 1, backgroundColor: '#E2E8F0', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${row.approvalRate}%`,
                            backgroundColor: '#10B981',
                            height: '100%',
                            borderRadius: '4px'
                          }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>


        {/* Right Card: Requests by Permission Type (Stacked Bar) */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.03)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px'
          }}>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <BarChart2 size={18} color="#10b981" />
                <span>Requests by Permission Type</span>
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Comparison of request status by type
              </p>
            </div>

            {/* Custom Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#166534' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <span>Approved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#B45309' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                <span>Pending</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#991B1B' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span>Rejected</span>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={requestsByTypeChart} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              />
              <Bar dataKey="Approved" stackId="a" fill="#10B981" maxBarSize={36} />
              <Bar dataKey="Pending" stackId="a" fill="#F59E0B" maxBarSize={36} />
              <Bar dataKey="Rejected" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}
