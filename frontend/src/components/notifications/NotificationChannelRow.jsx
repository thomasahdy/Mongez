import ToggleSwitch from "./ToggleSwitch";

const labelOverrides = {
  TASK_ASSIGNED: "Task assigned to me",
  COMMENT_MENTION: "@mentioned in a comment",
  TASK_UPDATED: "Task status changed",
  TASK_DUE: "Deadline approaching (24h)",
  FILE_UPLOADED: "File uploaded/updated",
};

const NotificationChannelsRow = ({ setting, onToggle }) => {
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

      <td>
        <ToggleSwitch
          checked={inApp}
          onChange={(checked) => onToggle(id, "inApp", checked)}
        />
      </td>

      <td>
        <ToggleSwitch
          checked={email}
          onChange={(checked) => onToggle(id, "email", checked)}
        />
      </td>

      <td>
        <ToggleSwitch
          checked={whatsapp}
          onChange={(checked) => onToggle(id, "whatsapp", checked)}
        />
      </td>

      <td>
        <ToggleSwitch
          checked={telegram}
          onChange={(checked) => onToggle(id, "telegram", checked)}
        />
      </td>
    </tr>
  );
};

export default NotificationChannelsRow;
