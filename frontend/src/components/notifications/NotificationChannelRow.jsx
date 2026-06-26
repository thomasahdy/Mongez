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
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-4 text-sm font-medium text-gray-900">
        {label}
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={inApp}
          onChange={(e) =>
            onToggle(id, "inApp", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer"
        />
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={email}
          onChange={(e) =>
            onToggle(id, "email", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer"
        />
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={whatsapp}
          onChange={(e) =>
            onToggle(id, "whatsapp", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer"
        />
      </td>

      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={telegram}
          onChange={(e) =>
            onToggle(id, "telegram", e.target.checked)
          }
          className="h-4 w-4 cursor-pointer"
        />
      </td>
    </tr>
  );
};

export default NotificationChannelsRow;