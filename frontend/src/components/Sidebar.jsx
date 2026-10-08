import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Users,
  UserCheck,
  Calendar,
  Clock,
  ClipboardList,
  QrCode,
  ShieldCheck,
  FileText,
  LogOut,
  Sparkles,
  BarChart2,
  X
} from 'lucide-react';

const NAV_CONFIG = {
  ADMIN: [
    { label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Students Data', icon: UserCheck, path: '/admin/students' },
    { label: 'Permission requests', icon: ShieldCheck, path: '/admin/requests' },
    { label: 'Reports & Analytics', icon: BarChart2, path: '/admin/reports' },
  ],
  CTPO: [
    { label: 'Overview', icon: LayoutDashboard, path: '/ctpo/dashboard' },
    { label: 'Pending Approvals', icon: Clock, path: '/ctpo/pending' },
    { label: 'All Requests', icon: ClipboardList, path: '/ctpo/history' },
    { label: 'Reports', icon: FileText, path: '/ctpo/reports' },
  ],
  HOD: [
    { label: 'Overview', icon: LayoutDashboard, path: '/hod/dashboard' },
    { label: 'Branches', icon: Building2, path: '/hod/branches' },
    { label: 'Student Requests', icon: ClipboardList, path: '/hod/student-requests' },
    { label: 'Pending Approvals', icon: UserCheck, path: '/hod/approvals' },
    { label: 'Reports', icon: BarChart2, path: '/hod/reports' },
  ],
  HOSTEL_INCHARGE: [
    { label: 'Overview', icon: LayoutDashboard, path: '/hostel/dashboard' },
    { label: 'Pending Requests', icon: Clock, path: '/hostel/dashboard?view=pending' },
    { label: 'Review History', icon: ClipboardList, path: '/hostel/dashboard?view=history' },
  ],
  PLACEMENT_OFFICER: [
    { label: 'Overview', icon: LayoutDashboard, path: '/placement/dashboard' },
    { label: 'Pending Requests', icon: Clock, path: '/placement/pending' },
    { label: 'Review History', icon: ClipboardList, path: '/placement/history' },
  ],
  SECURITY: [
    { label: 'QR Scanner', icon: QrCode, path: '/security/scanner' },
    { label: 'Permission History', icon: ClipboardList, path: '/security/history' },
  ],
  STUDENT: [
    { label: 'Overview', icon: LayoutDashboard, path: '/student/dashboard' },
    { label: 'New Permission', icon: FileText, path: '/student/new-permission' },
    { label: 'My Requests', icon: ClipboardList, path: '/student/my-request' },
    { label: 'My Profile', icon: Users, path: '/student/profile' },
  ],
};

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  CTPO: 'CTPO Approver',
  HOD: 'HOD Approver',
  HOSTEL_INCHARGE: 'Hostel In-charge',
  PLACEMENT_OFFICER: 'Placement Officer',
  SECURITY: 'Campus Security',
  STUDENT: 'Student',
};

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = NAV_CONFIG[user?.role] || [];

  const getCTPODisplayName = (userObj) => {
    if (userObj?.role !== 'CTPO') return userObj?.name || 'User';
    
    // Extract branch
    const possibleBranches = [
      userObj?.branchName, userObj?.branchCode, userObj?.branch?.name, userObj?.branch?.code,
      userObj?.branch?.branchName, userObj?.branchId?.name, userObj?.branchId?.code,
      userObj?.branchId?.branchName, userObj?.organization?.branch?.name,
      userObj?.organization?.branch?.code, userObj?.organization?.branchName,
      userObj?.department?.name, userObj?.department?.code,
    ];
    let branch = possibleBranches.find(v => typeof v === "string" && v.trim() && !/^[a-f\d]{20,}$/i.test(v.trim()));
    if (branch) {
      branch = String(branch).trim().toUpperCase();
    } else {
      const identifiers = [userObj?.username, userObj?.facultyId, userObj?.code, userObj?.name];
      for (const id of identifiers) {
        if (typeof id === 'string') {
          const m = id.match(/(?:[1-4]kt|ctpo_|\b(?:1st|2nd|3rd|4th)\s+Year\s+)([a-z0-9]+)/i);
          if (m && m[1]) { branch = m[1].toUpperCase(); break; }
        }
      }
    }

    // Extract year
    let yearLabel = "";
    const possibleYears = [
      userObj?.assignedYear, userObj?.yearTier, userObj?.academicYear, userObj?.yearLabel,
      userObj?.year?.name, userObj?.year?.label, userObj?.year?.value, userObj?.year,
    ];
    for (const val of possibleYears) {
      if (!val) continue;
      if (val === 1 || val === "1" || /1st|TIER_1ST/i.test(String(val))) { yearLabel = "1st Year"; break; }
      if (val === 2 || val === "2" || /2nd|TIER_2ND/i.test(String(val))) { yearLabel = "2nd Year"; break; }
      if (val === 3 || val === "3" || /3rd|TIER_3RD/i.test(String(val))) { yearLabel = "3rd Year"; break; }
      if (val === 4 || val === "4" || /4th|TIER_4TH/i.test(String(val))) { yearLabel = "4th Year"; break; }
    }
    if (!yearLabel) {
      const identifiers = [userObj?.username, userObj?.facultyId, userObj?.code, userObj?.name];
      for (const id of identifiers) {
        if (typeof id === 'string') {
          const m = id.match(/^([1-4])kt/i);
          if (m && m[1]) {
            const y = parseInt(m[1], 10);
            if (y === 1) { yearLabel = "1st Year"; break; }
            if (y === 2) { yearLabel = "2nd Year"; break; }
            if (y === 3) { yearLabel = "3rd Year"; break; }
            if (y === 4) { yearLabel = "4th Year"; break; }
          }
          if (/1st\s*year/i.test(id)) { yearLabel = "1st Year"; break; }
          if (/2nd\s*year/i.test(id)) { yearLabel = "2nd Year"; break; }
          if (/3rd\s*year/i.test(id)) { yearLabel = "3rd Year"; break; }
          if (/4th\s*year/i.test(id)) { yearLabel = "4th Year"; break; }
        }
      }
    }

    if (yearLabel || branch) {
       return `${yearLabel ? yearLabel + ' ' : ''}${branch ? branch + ' ' : ''}CTPO`;
    }
    return userObj?.name || 'CTPO Approver';
  };

  const displayName = getCTPODisplayName(user);

  const initials = displayName
    ? displayName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleNavClick = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Backdrop for mobile drawer */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <img
              src="/kiet_logo.jpg"
              alt="KIET"
              style={{
                width: '140px',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '6px'
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          {/* Close button inside sidebar on mobile */}
          <button
            className="mobile-sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: '#64748B',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const [itemPath, itemQuery = ''] = item.path.split('?');
              const samePathItems = navItems.filter((nav) => nav.path.split('?')[0] === itemPath);
              const isActive = samePathItems.length > 1
                ? location.pathname === itemPath &&
                  new URLSearchParams(location.search).get('view') ===
                    new URLSearchParams(itemQuery).get('view')
                : itemQuery
                  ? location.pathname + location.search === item.path
                  : location.pathname === itemPath && (
                    !location.search ||
                    !navItems.some(nav => nav.path.includes('?'))
                  );
              return (
                <button
                key={item.path}
                className={`nav-item${isActive ? ' active' : ''}`}
                onClick={() => handleNavClick(item.path)}
              >
                <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
                  <Icon size={18} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ overflow: 'hidden' }}>
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={displayName}>{displayName}</div>
            <div className="sidebar-user-role">{ROLE_LABELS[user?.role] || user?.role}</div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Logout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
