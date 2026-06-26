import NotificationChannelsRow from "./NotificationChannelRow";

const NotificationChannelsTable = ({
    settings = [],
    onToggle,
}) => {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                            Event
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-solid fa-bell text-purple-500"></i>
                                <span>In-App</span>
                            </div>
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-solid fa-envelope text-blue-500"></i>
                                <span>Email</span>
                            </div>
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-brands fa-whatsapp text-green-500"></i>
                                <span>WhatsApp</span>
                            </div>
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-brands fa-telegram text-sky-500"></i>
                                <span>Telegram</span>
                            </div>
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                    {settings.map((setting) => (
                        <NotificationChannelsRow
                            key={setting.id}
                            setting={setting}
                            onToggle={onToggle}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default NotificationChannelsTable;