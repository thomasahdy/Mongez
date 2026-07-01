import React from 'react';
import { useTranslation } from "react-i18next";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { createTaskValidationSchema } from '../../schemas/taskValidationSchema';
import { useMembers } from '../../hooks/api/useMembers';
import { useIntegrationStatusesQuery } from '../../hooks/useSettingsQueries';
import tasksService from '../../services/api/tasksService';
import useLocaleDirection from '../../hooks/useLocaleDirection';
import { resolveAvatarUrl } from '../../utils/avatarUrl';

const CreateTaskModal = ({ boardId, columnId, spaceId, spacePrefix, onSubmit, onClose, defaultValues = {} }) => {
  const { t } = useTranslation();
  const { dir } = useLocaleDirection();
  const { data: members = [] } = useMembers(spaceId);
  const [selectedAssignees, setSelectedAssignees] = React.useState(defaultValues.assigneeIds || []);
  const [tagsText, setTagsText] = React.useState((defaultValues.tags || []).join(", "));
  
  // Advanced Panel Toggle
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Assignee Dropdown State
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = React.useState(false);
  const [assigneeSearch, setAssigneeSearch] = React.useState("");

  // Parent Task Search State
  const [parentSearch, setParentSearch] = React.useState("");
  const [isParentDropdownOpen, setIsParentDropdownOpen] = React.useState(false);
  const [foundTasks, setFoundTasks] = React.useState([]);
  const [selectedParent, setSelectedParent] = React.useState(null);

  // Attachments Menu Popover State
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = React.useState(false);
  const [localAttachments, setLocalAttachments] = React.useState([]);
  const [selectedDriveFiles, setSelectedDriveFiles] = React.useState([]);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = React.useState(false);
  const [driveSearch, setDriveSearch] = React.useState("");
  const fileInputRef = React.useRef(null);

  const statusesQuery = useIntegrationStatusesQuery(spaceId);
  const googleDriveConnected = statusesQuery.data?.googleDriveConnected;

  const driveFilesQuery = useQuery({
    queryKey: ["google-drive", "files-modal", driveSearch],
    queryFn: () => tasksService.listGoogleDriveFiles(driveSearch),
    enabled: Boolean(isDrivePickerOpen && googleDriveConnected),
  });

  const toggleAssignee = (id) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(createTaskValidationSchema),
    defaultValues: {
      title: defaultValues.title || "",
      boardId: boardId || "",
      columnId: columnId || "",
      spaceId: spaceId || "",
      spacePrefix: spacePrefix || "",
      description: defaultValues.description || "",
      status: defaultValues.status || "TODO",
      priority: defaultValues.priority || "MEDIUM",
      type: defaultValues.type || "Task",
      dueDate: defaultValues.dueDate || "",
      startDate: defaultValues.startDate || "",
      estimatedHours: defaultValues.estimatedHours || 0,
      parentId: defaultValues.parentId || "",
      tags: defaultValues.tags || [],
      assigneeIds: defaultValues.assigneeIds || []
    },
  });

  const currentPriority = watch('priority');
  const currentDueDate = watch('dueDate');

  // Debounced parent task searching
  React.useEffect(() => {
    if (!parentSearch || parentSearch === selectedParent?.title) {
      setFoundTasks([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const results = await tasksService.searchTasks(parentSearch, spaceId);
        setFoundTasks(results || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [parentSearch, spaceId, selectedParent]);

  const handleFormSubmit = async (data) => {
    if (data.estimatedHours) {
      data.estimatedHours = Number.parseInt(data.estimatedHours, 10);
    }
    data.assigneeIds = selectedAssignees;
    data.tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Pass attachments payload
    data.attachments = localAttachments;
    data.driveFileIds = selectedDriveFiles.map(f => f.id);

    try {
      await onSubmit(data);
      reset();
      setSelectedAssignees([]);
      setTagsText("");
      setLocalAttachments([]);
      setSelectedDriveFiles([]);
      setSelectedParent(null);
      setParentSearch("");
    } catch (err) {
      console.error("Task submission failed:", err);
    }
  };

  const formatDateTimeLocal = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const handleQuickDate = (type) => {
    let date = new Date();
    if (type === 'today') {
      date.setHours(17, 0, 0, 0);
    } else if (type === 'tomorrow') {
      date.setDate(date.getDate() + 1);
      date.setHours(17, 0, 0, 0);
    } else if (type === 'next-week') {
      date.setDate(date.getDate() + 7);
      date.setHours(17, 0, 0, 0);
    }
    setValue('dueDate', formatDateTimeLocal(date));
  };

  const getFileIcon = (fileName, isDrive) => {
    if (isDrive) return "fa-brands fa-google-drive text-emerald-500";
    const ext = String(fileName || '').split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return "fa-regular fa-file-image text-emerald-500";
    } else if (ext === 'pdf') {
      return "fa-regular fa-file-pdf text-rose-500";
    } else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return "fa-regular fa-file-zipper text-amber-500";
    } else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      return "fa-regular fa-file-lines text-sky-500";
    }
    return "fa-regular fa-file text-slate-400";
  };

  const handleLocalFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLocalAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsAttachmentMenuOpen(false);
  };

  const removeLocalAttachment = (index) => {
    setLocalAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDriveAttachment = (id) => {
    setSelectedDriveFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const toggleDriveFileSelection = (file) => {
    setSelectedDriveFiles((prev) => {
      const exists = prev.some(f => f.id === file.id);
      if (exists) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  const filteredMembers = members.filter(member => {
    const name = member.user?.name || member.name || "";
    return name.toLowerCase().includes(assigneeSearch.toLowerCase());
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 dark:bg-slate-955/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      dir={dir}
    >
      {/* Click outside to close modals */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden animate-in zoom-in-98 duration-200 flex flex-col max-h-[90vh]">
        {/* Upper border premium gradient design */}
        <div className="h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">What needs to be done?</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Create a new task and assign it to your team</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Form Body Container */}
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="p-6 overflow-y-auto flex-1 min-h-0 space-y-5 global-scrollbar"
        >
          <input type="hidden" {...register('boardId')} />
          <input type="hidden" {...register('columnId')} />
          <input type="hidden" {...register('spaceId')} />
          <input type="hidden" {...register('spacePrefix')} />
          <input type="hidden" {...register('status')} />

          {/* Title Input with better placeholder */}
          <div>
            <input
              type="text"
              placeholder="Fix navbar rendering bug..."
              className={`w-full bg-slate-50 dark:bg-slate-900 border-0 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-0 outline-none text-base font-extrabold text-slate-800 dark:text-slate-100 transition-all placeholder-slate-400 dark:placeholder-slate-500 py-3 px-4 rounded-xl`}
              {...register('title')}
              autoFocus
            />
            {errors.title && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-semibold flex items-center gap-1">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.title.message}
              </p>
            )}
          </div>

          {/* Compact Description (Notion-like) */}
          <div>
            <textarea
              rows={2}
              placeholder="Add more details..."
              className="w-full bg-slate-50 dark:bg-slate-900 border-0 focus:ring-0 outline-none text-xs text-slate-700 dark:text-slate-300 resize-none font-medium placeholder-slate-400 dark:placeholder-slate-500 p-4 rounded-xl"
              {...register('description')}
            />
          </div>

          {/* Quick Config Row: Assignee, Due Date, Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Searchable Assignee Selector */}
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Assignee
              </label>
              <div 
                onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors select-none text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedAssignees.length === 0 ? (
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <i className="fa-solid fa-user-plus text-[10px]" /> Assign task...
                    </span>
                  ) : (
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {selectedAssignees.map(id => {
                        const member = members.find(m => (m.user?.id || m.id) === id);
                        if (!member) return null;
                        const name = member.user?.name || member.name || "Member";
                        const avatarUrl = resolveAvatarUrl(member.user?.avatarUrl || member.avatarUrl);
                        return (
                          <img
                            key={id}
                            className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                            src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`}
                            alt={name}
                            title={name}
                          />
                        );
                      })}
                    </div>
                  )}
                  {selectedAssignees.length > 0 && (
                    <span className="font-bold text-slate-700 dark:text-slate-305 text-[11px]">
                      {selectedAssignees.length} selected
                    </span>
                  )}
                </div>
                <i className="fa-solid fa-chevron-down text-[9px] text-slate-400" />
              </div>

              {isAssigneeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAssigneeDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search people..."
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 pl-7 text-[11px] dark:text-slate-200 focus:outline-none focus:border-indigo-400"
                      />
                      <i className="fa-solid fa-magnifying-glass text-slate-400 absolute left-2.5 top-2.5 text-[9px]"></i>
                    </div>

                    <div className="max-h-[160px] overflow-y-auto global-scrollbar pr-1 space-y-0.5">
                      {filteredMembers.map(member => {
                        const id = member.user?.id || member.id;
                        const name = member.user?.name || member.name || "Member";
                        const avatarUrl = resolveAvatarUrl(member.user?.avatarUrl || member.avatarUrl);
                        const isSelected = selectedAssignees.includes(id);
                        return (
                          <div
                            key={id}
                            onClick={() => toggleAssignee(id)}
                            className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors select-none ${
                              isSelected ? "bg-indigo-50/20 dark:bg-indigo-950/20" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                              <img
                                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`}
                                alt={name}
                                className="h-5 w-5 rounded-full object-cover shrink-0"
                              />
                              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{name}</span>
                            </div>
                            {isSelected ? (
                              <i className="fa-solid fa-circle-check text-indigo-500 text-sm" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-350 dark:border-slate-700" />
                            )}
                          </div>
                        );
                      })}
                      {filteredMembers.length === 0 && (
                        <div className="text-[10px] text-slate-400 italic text-center py-4">No members found</div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsAssigneeDropdownOpen(false)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Priority Selector Pills with animations */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Priority
              </label>
              <div className="flex gap-2">
                {[
                  { value: "LOW", label: t("kanbanPage.priorities.low"), activeBg: "bg-emerald-100 dark:bg-emerald-950/30 border-emerald-400 text-emerald-700 dark:text-emerald-400" },
                  { value: "MEDIUM", label: t("kanbanPage.priorities.medium"), activeBg: "bg-indigo-100 dark:bg-indigo-950/30 border-indigo-400 text-indigo-700 dark:text-indigo-400" },
                  { value: "HIGH", label: t("kanbanPage.priorities.high"), activeBg: "bg-rose-100 dark:bg-rose-950/30 border-rose-400 text-rose-700 dark:text-rose-400" }
                ].map((p) => {
                  const isActive = currentPriority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setValue('priority', p.value)}
                      className={`flex-1 py-2 text-xs font-semibold border-2 rounded-xl transition-all cursor-pointer duration-200 ${
                        isActive
                          ? `${p.activeBg} scale-105 shadow-sm`
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:scale-102"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Due Date Config - Pill Style */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Due Date
            </label>

            {/* Pill-style date buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickDate('today')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentDueDate && isToday(new Date(currentDueDate))
                    ? 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-400 dark:border-indigo-500'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'
                }`}
              >
                📅 Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate('tomorrow')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentDueDate && isTomorrow(new Date(currentDueDate))
                    ? 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-400 dark:border-indigo-500'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'
                }`}
              >
                📅 Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate('next-week')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentDueDate && isNextWeek(new Date(currentDueDate))
                    ? 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-400 dark:border-indigo-500'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'
                }`}
              >
                📅 Next Week
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('due-date-picker')?.showModal?.()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer"
              >
                <i className="fa-regular fa-calendar"></i>
                Pick Date
              </button>
            </div>

            {/* Hidden datetime-local for the picker */}
            <input
              id="due-date-picker"
              type="datetime-local"
              className="sr-only"
              {...register('dueDate')}
            />
          </div>

          {/* Helper functions for date comparison */}
          {(() => {
            window.isToday = (date) => {
              if (!date) return false;
              const d = new Date(date);
              const today = new Date();
              return d.toDateString() === today.toDateString();
            };
            window.isTomorrow = (date) => {
              if (!date) return false;
              const d = new Date(date);
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              return d.toDateString() === tomorrow.toDateString();
            };
            window.isNextWeek = (date) => {
              if (!date) return false;
              const d = new Date(date);
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              return d.toDateString() === nextWeek.toDateString();
            };
            return null;
          })()}

          {/* Attachments Section */}
          <div className="relative">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Attachments
              </label>
              
              {/* Dropdown Menu Trigger */}
              <button
                type="button"
                onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 rounded-xl text-[10px] font-extrabold text-slate-700 dark:text-slate-305 transition-all cursor-pointer"
              >
                <i className="fa-solid fa-paperclip text-[10px] text-indigo-500" />
                📎 Attach Files
              </button>
            </div>

            {isAttachmentMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsAttachmentMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-155">
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-655 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 rounded-xl cursor-pointer"
                  >
                    <i className="fa-solid fa-cloud-arrow-up text-indigo-500 w-4" />
                    Upload Files
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachmentMenuOpen(false);
                      setIsDrivePickerOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-655 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 rounded-xl cursor-pointer"
                  >
                    <i className="fa-brands fa-google-drive text-emerald-500 w-4" />
                    Google Drive
                  </button>
                </div>
              </>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLocalFileSelect}
              multiple
              className="hidden"
            />

            {/* List of queue files */}
            {(localAttachments.length > 0 || selectedDriveFiles.length > 0) && (
              <div className="space-y-1 mt-2.5 max-h-[120px] overflow-y-auto global-scrollbar pr-1">
                {localAttachments.map((file, idx) => (
                  <div
                    key={`local-${idx}`}
                    className="flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-105 dark:border-slate-805/45 rounded-xl text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <i className={`fa-solid ${getFileIcon(file.name, false)} shrink-0`} />
                      <span className="text-slate-700 dark:text-slate-300 font-bold truncate">{file.name}</span>
                      <span className="text-[9px] text-slate-400 shrink-0">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLocalAttachment(idx)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-[10px]" />
                    </button>
                  </div>
                ))}

                {selectedDriveFiles.map((file) => (
                  <div
                    key={`drive-${file.id}`}
                    className="flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-105 dark:border-slate-805/45 rounded-xl text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <i className={`fa-solid ${getFileIcon(file.name, true)} shrink-0`} />
                      <span className="text-slate-700 dark:text-slate-300 font-bold truncate">{file.name}</span>
                      <span className="text-[9px] text-emerald-500 font-extrabold uppercase shrink-0">Drive</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDriveAttachment(file.id)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-[10px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-105 dark:bg-slate-800 my-2" />

          {/* Advanced Collapsible Accordion Drawer */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 hover:text-slate-800 dark:hover:text-slate-205 transition-colors cursor-pointer outline-none select-none py-1"
            >
              <i className={`fa-solid ${showAdvanced ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px]`} />
              <span>{showAdvanced ? "Hide Advanced Options" : "+ Show Advanced Options"}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-4 border-t border-dashed border-slate-100 dark:border-slate-850 mt-2 animate-in slide-in-from-top-2 duration-200">
                
                {/* Type & Estimated Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Task Type
                    </label>
                    <select
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-transparent dark:bg-slate-950 outline-none text-xs font-semibold text-slate-700 dark:text-slate-350"
                      {...register('type')}
                    >
                      <option value="Task">{t("kanbanPage.types.task")}</option>
                      <option value="Bug">{t("kanbanPage.types.bug")}</option>
                      <option value="Feature">{t("kanbanPage.types.feature")}</option>
                      <option value="Milestone">{t("kanbanPage.types.milestone")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Estimated Hours
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 4"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-transparent outline-none text-xs font-semibold text-slate-700 dark:text-slate-200"
                      {...register('estimatedHours', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                {/* Searchable Parent Task Selector */}
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Parent Task
                  </label>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search parent task by title or id..."
                      value={parentSearch}
                      onChange={(e) => {
                        setParentSearch(e.target.value);
                        setIsParentDropdownOpen(true);
                      }}
                      onFocus={() => setIsParentDropdownOpen(true)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-transparent outline-none text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400"
                    />
                    <i className="fa-solid fa-magnifying-glass text-slate-400 absolute right-3.5 top-2.5 text-[10px]"></i>
                  </div>

                  {isParentDropdownOpen && foundTasks.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsParentDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xl max-h-[160px] overflow-y-auto z-50 p-1.5 space-y-0.5 global-scrollbar">
                        {foundTasks.map(t => (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedParent(t);
                              setParentSearch(t.title);
                              setValue('parentId', t.id);
                              setIsParentDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-250 truncate font-semibold rounded-lg cursor-pointer"
                          >
                            <span className="text-indigo-500 font-extrabold mr-1.5">{t.identifier}</span>
                            {t.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {selectedParent && (
                    <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 border border-slate-105 dark:border-slate-800/80 rounded-xl text-[11px] mt-2 animate-in fade-in duration-100">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-indigo-500 font-extrabold">{selectedParent.identifier}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">{selectedParent.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedParent(null);
                          setParentSearch("");
                          setValue('parentId', "");
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                      >
                        <i className="fa-solid fa-xmark text-sm" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tags input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="OOD, Lab102, Exam"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-transparent outline-none text-xs font-semibold text-slate-750 dark:text-slate-200"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-transparent outline-none text-xs font-semibold text-slate-700 dark:text-slate-200"
                    {...register('startDate')}
                  />
                </div>
                
              </div>
            )}
          </div>

          {/* Modal Actions Footer */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-400 transition-colors cursor-pointer"
            >
              {t("kanbanPage.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-white"></i>
                  {t("kanbanPage.creating")}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-[10px]"></i>
                  {t("kanbanPage.createTaskButton")}
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* Nested Google Drive Picker Modal */}
      {isDrivePickerOpen && (
        <div className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-in fade-in zoom-in-98 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <i className="fa-brands fa-google-drive text-emerald-500 text-sm"></i>
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Select Google Drive Files</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDrivePickerOpen(false);
                  setDriveSearch("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4 global-scrollbar">
              {!googleDriveConnected ? (
                <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-955/20 border border-dashed border-slate-200 dark:border-slate-805 rounded-2xl space-y-4">
                  <i className="fa-brands fa-google-drive text-slate-350 dark:text-slate-700 text-4xl block animate-bounce" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Google Drive not connected</p>
                    <p className="text-[11px] text-slate-400">Connect your Google account in Settings to attach files.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `${import.meta.env.VITE_API_URL || '/api/v1'}/integrations/google/auth`;
                    }}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <i className="fa-brands fa-google"></i>
                    Connect Google Drive
                  </button>
                </div>
              ) : (
                <>
                  {/* Search bar */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search your Google Drive..."
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 pl-9 text-xs dark:text-slate-200 focus:outline-none transition-colors font-semibold"
                    />
                    <i className="fa-solid fa-magnifying-glass text-slate-400 absolute left-3 top-3 text-[10px]"></i>
                  </div>

                  {/* List of files */}
                  <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1 global-scrollbar">
                    {driveFilesQuery.isLoading ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <i className="fa-solid fa-spinner fa-spin text-slate-400 text-xl"></i>
                        <span className="text-xs text-slate-400">Loading Google Drive files...</span>
                      </div>
                    ) : driveFilesQuery.error ? (
                      <div className="text-xs text-rose-500 text-center py-6">
                        Failed to fetch files from Google Drive. Please reconnect your account.
                      </div>
                    ) : driveFilesQuery.data && driveFilesQuery.data.length > 0 ? (
                      driveFilesQuery.data.map((file) => {
                        const isSelected = selectedDriveFiles.some(f => f.id === file.id);
                        return (
                          <div
                            key={file.id}
                            onClick={() => toggleDriveFileSelection(file)}
                            className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-all ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10"
                                : "border-slate-105 dark:border-slate-800/30 hover:border-slate-200 dark:hover:border-slate-700/50 bg-slate-50/40 dark:bg-slate-955/10"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                              {file.iconLink ? (
                                <img src={file.iconLink} alt="file-type" className="w-4 h-4 shrink-0 object-contain" />
                              ) : (
                                <i className="fa-solid fa-file text-slate-400 shrink-0 text-sm"></i>
                              )}
                              <span className="text-xs font-bold text-slate-750 dark:text-slate-250 truncate">{file.name}</span>
                            </div>
                            <div className="flex items-center shrink-0">
                              {isSelected ? (
                                <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shadow-sm">
                                  <i className="fa-solid fa-check"></i>
                                </div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 transition-colors" />
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-slate-400 italic text-center py-8">No files found in Google Drive.</div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400">
                      Selected: {selectedDriveFiles.length} files
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDrivePickerOpen(false)}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-650 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTaskModal;
