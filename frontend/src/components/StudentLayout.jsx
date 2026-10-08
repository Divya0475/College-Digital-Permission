import React, { useState } from 'react';
import StudentSidebar from './StudentSidebar';
import { Menu } from 'lucide-react';
import '../student.css';

export default function StudentLayout({
  children,
  pageTitle = '',
  pageSubtitle = '',
  headerRight = null   // slot for extra controls in the header (e.g. search box)
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="s-layout">
      {/* Fixed pastel background blobs */}
      <div className="s-bg" aria-hidden="true">
        <div className="s-bg-blob s-bg-blob-1" />
        <div className="s-bg-blob s-bg-blob-2" />
        <div className="s-bg-blob s-bg-blob-3" />
      </div>

      {/* Floating sidebar panel */}
      <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Floating main panel */}
      <div className="s-main-wrapper">

        {/* Page header — always at the top of the main panel */}
        <header className="s-page-header">
          <div className="s-page-header-left">
            <button
              type="button"
              className="s-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu size={20} />
            </button>
            <div className="s-page-header-title">
              {pageTitle && <h1 className="s-page-title">{pageTitle}</h1>}
              {pageSubtitle && <p className="s-page-subtitle">{pageSubtitle}</p>}
            </div>
          </div>

          <div className="s-page-header-right">
            {/* Any extra controls passed in (e.g. search on My Requests) */}
            {headerRight}


          </div>
        </header>

        {/* Scrollable page content */}
        <main className="s-main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
