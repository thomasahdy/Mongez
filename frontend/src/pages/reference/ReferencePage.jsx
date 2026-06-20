import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './referenceStyles.css';

const sidebarMarkup = `
  <a href="/" class="brand-section">
    <div class="brand-logo">
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#00a8e8"/>
        <path d="M8 22V10l5 8 5-8v12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <circle cx="24" cy="10" r="2" fill="#6366f1"/>
      </svg>
    </div>
    <div class="brand-name">Mongez</div>
  </a>
  <div class="nav-section">
    <div class="nav-label">Overview</div>
    <a href="/app" class="nav-item"><span class="nav-icon"><i class="fa-solid fa-chart-pie"></i></span><span>Dashboard</span></a>
    <a href="/ai-assistant" class="nav-item"><span class="nav-icon"><i class="fa-solid fa-sparkles" style="color:var(--accent)"></i></span><span>AI Assistant</span><span class="nav-badge" style="background:linear-gradient(135deg,#6366f1,#00a8e8);color:white;font-size:9px;padding:2px 5px;border-radius:4px;font-weight:700">AI</span></a>
  </div>
  <div class="nav-section">
    <div class="nav-label">Views</div>
    <a href="/calendar" class="nav-item"><span class="nav-icon"><i class="fa-regular fa-calendar"></i></span><span>Calendar</span><span class="nav-badge badge-neutral" style="font-size:9px">2 mtgs</span></a>
    <a href="/board/default/timeline" class="nav-item"><span class="nav-icon"><i class="fa-solid fa-bars-staggered"></i></span><span>Timeline</span></a>
    <a href="/whiteboard/default" class="nav-item"><span class="nav-icon"><i class="fa-solid fa-chalkboard"></i></span><span>Whiteboard</span></a>
  </div>
  <div class="nav-section">
    <div class="nav-label"><span>Spaces</span></div>
    <div class="nav-item dept-parent" style="background:var(--bg-hover); color:var(--text-primary)"><span class="nav-icon"><i class="fa-solid fa-graduation-cap" style="color:#e74c3c"></i></span><span>Education Dept</span><span class="nav-badge badge-neutral">Head</span></div>
    <div class="nav-tree">
      <div class="tree-item"><a href="/board/default" class="tree-link" style="font-weight:600;color:var(--text-primary)"><i class="fa-solid fa-table-columns" style="font-size:11px;color:var(--text-tertiary);margin-right:6px"></i>Upper Egypt Edu<span class="nav-badge badge-neutral" style="margin-left:auto;display:flex;align-items:center;gap:4px"><span style="color:var(--text-tertiary)">3</span><i class="fa-solid fa-bolt" style="color:var(--primary);font-size:10px"></i></span></a></div>
    </div>
  </div>
  <div class="sidebar-footer"><a href="/settings" class="nav-item"><span class="nav-icon"><i class="fa-solid fa-gear"></i></span><span>Settings</span></a><a href="/login" class="nav-item" style="color:var(--danger)"><span class="nav-icon"><i class="fa-solid fa-arrow-right-from-bracket"></i></span><span>Log out</span></a></div>
`;

const settingsSidebarMarkup = `
  <div><div class="settings-group-title">Personal Settings</div><div class="settings-nav"><a href="/settings" class="settings-nav-item"><i class="fa-regular fa-user"></i> My Profile</a><a href="/settings/notifications" class="settings-nav-item"><i class="fa-regular fa-bell"></i> Notifications</a><a href="/settings/security" class="settings-nav-item"><i class="fa-solid fa-shield-halved"></i> Security</a></div></div>
  <div><div class="settings-group-title">Workspace <span class="pro-badge">PRO</span></div><div class="settings-nav"><a href="/settings/members" class="settings-nav-item"><i class="fa-solid fa-users"></i> Members & Roles</a><a href="/settings/billing" class="settings-nav-item active"><i class="fa-solid fa-credit-card"></i> Billing</a><a href="/settings/integrations" class="settings-nav-item"><i class="fa-solid fa-plug"></i> Integrations</a><a href="/reports" class="settings-nav-item"><i class="fa-solid fa-chart-line"></i> Reports</a><a href="/settings/audit-log" class="settings-nav-item"><i class="fa-solid fa-clock-rotate-left"></i> Audit Log</a></div></div>
`;

export function ReferencePage({ html, page, onReady }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    document.body.classList.add('mongez-reference-page');

    const shell = document.querySelector('.mongez-reference-shell');
    const sidebar = shell?.querySelector('.sidebar');
    const settingsSidebar = shell?.querySelector('.settings-sidebar');

    if (sidebar) sidebar.innerHTML = sidebarMarkup;
    if (settingsSidebar) settingsSidebar.innerHTML = settingsSidebarMarkup;

    const canvas = shell?.querySelector('#canvas');
    let isDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    const onMouseDown = (event) => {
      isDown = true;
      startX = event.pageX - canvas.offsetLeft;
      startY = event.pageY - canvas.offsetTop;
      scrollLeft = canvas.scrollLeft;
      scrollTop = canvas.scrollTop;
    };

    const onMouseLeave = () => {
      isDown = false;
    };

    const onMouseUp = () => {
      isDown = false;
    };

    const onMouseMove = (event) => {
      if (!isDown) return;
      event.preventDefault();
      const x = event.pageX - canvas.offsetLeft;
      const y = event.pageY - canvas.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      canvas.scrollLeft = scrollLeft - walkX;
      canvas.scrollTop = scrollTop - walkY;
    };

    if (canvas && page === 'whiteboard') {
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mouseleave', onMouseLeave);
      canvas.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('mousemove', onMouseMove);
    }

    onReady?.(shell);

    return () => {
      if (canvas && page === 'whiteboard') {
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mouseleave', onMouseLeave);
        canvas.removeEventListener('mouseup', onMouseUp);
        canvas.removeEventListener('mousemove', onMouseMove);
      }
      document.body.classList.remove('mongez-reference-page');
    };
  }, [mounted, page]);

  if (!mounted) return null;

  return createPortal(
    <div className="mongez-reference-shell" dangerouslySetInnerHTML={{ __html: html }} />,
    document.body,
  );
}
