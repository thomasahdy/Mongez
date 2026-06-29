const NotificationChannelsRow = ({setting, onToggle }) => {
  const {
    id,
    label,
    inApp,
    email,
    whatsapp,
    telegram,
  } = setting;

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
      <td className="px-4 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">
        {label}
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={inApp}
          onChange={(e) =>
            onToggle(id, "inApp", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer accent-indigo-500 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
        />
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={email}
          onChange={(e) =>
            onToggle(id, "email", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer accent-indigo-500 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
        />
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={whatsapp}
          onChange={(e) =>
            onToggle(id, "whatsapp", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer accent-indigo-500 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
        />
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={telegram}
          onChange={(e) =>
            onToggle(id, "telegram", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer accent-indigo-500 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
        />
      </td>
    </tr>
  );
};

export default NotificationChannelsRow;