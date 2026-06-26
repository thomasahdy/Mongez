import NotificationChannelsTable from "./NotificationChannelTable";

const NotificationChannelsCard = ({ settings, onToggle, loading, }) => {
    if(loading){
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
                Loading...
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <i className="fa-solid fa-sliders text-blue-600"></i> 
                Delivery Channels
            </div>

            <p className="mt-2 text-sm text-gray-500">
                Toggle which channels receive each notification type. External channels require integration setup.
            </p>

                <div className="overflow-x-auto">
                    <NotificationChannelsTable settings={settings} onToggle={onToggle}/>
                </div>
        </div>
    );
};

export default NotificationChannelsCard;