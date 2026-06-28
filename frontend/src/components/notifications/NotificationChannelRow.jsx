import ToggleSwitch from "./ToggleSwitch";
import { useTranslation } from "react-i18next";

const labelOverrides = {
  TASK_ASSIGNED: "notificationsPage.events.TASK_ASSIGNED",
  COMMENT_MENTION: "notificationsPage.events.COMMENT_MENTION",
  TASK_UPDATED: "notificationsPage.events.TASK_UPDATED",
  TASK_DUE: "notificationsPage.events.TASK_DUE",
  FILE_UPLOADED: "notificationsPage.events.FILE_UPLOADED",
};

const NotificationChannelsRow = ({setting, onToggle }) => {
  const { t } = useTranslation();
  const {
    id,
    label,
    inApp,
    email,
    whatsapp,
    telegram,
  } = setting;

  return (
    <tr>
      <td>
        {labelOverrides[id] ? t(labelOverrides[id]) : label}
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
