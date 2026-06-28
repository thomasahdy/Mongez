import NotificationChannelsRow from "./NotificationChannelRow";

const NotificationChannelsTable = ({
    settings = [],
    onToggle,
}) => {
    return (
        <div className="overflow-x-auto">
            <table className="channel-matrix">
                <thead>
                    <tr>
                        <th>Event</th>

                        <th>
                            <i className="channel-icon channel-inapp fa-solid fa-bell"></i>
                            <br />
                            In-App
                        </th>

                        <th>
                            <i className="channel-icon channel-email fa-solid fa-envelope"></i>
                            <br />
                            Email
                        </th>

                        <th>
                            <i className="channel-icon channel-whatsapp fa-brands fa-whatsapp"></i>
                            <br />
                            WhatsApp
                        </th>

                        <th>
                            <i className="channel-icon channel-telegram fa-brands fa-telegram"></i>
                            <br />
                            Telegram
                        </th>
                    </tr>
                </thead>

                <tbody>
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
