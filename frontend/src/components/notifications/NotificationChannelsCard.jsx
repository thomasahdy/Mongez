import NotificationChannelsTable from "./NotificationChannelTable";

const NotificationChannelsCard = ({ settings, onToggle, loading, }) => {
    if(loading){
        return (
            <div className="notif-section">
                Loading...
            </div>
        );
    }

    return (
        <div className="notif-section">
            <div className="notif-section-title">
                <i className="fa-solid fa-sliders channel-email"></i>
                Delivery Channels
            </div>

            <div className="notif-section-desc">
                Toggle which channels receive each notification type. External channels require integration setup.
            </div>

            <div className="overflow-x-auto">
                <NotificationChannelsTable settings={settings} onToggle={onToggle}/>
            </div>
        </div>
    );
};

export default NotificationChannelsCard;
