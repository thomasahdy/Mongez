const SessionRow = ({ session, onTerminate, disabled }) => {
    const {id, device = "Unknown Device", ipAddress = "Unknown", lastActive = "Unknown", location = "Unknown Location", isCurrent} = session;

    const deviceLower = device.toLowerCase();

    const isApple = deviceLower.includes("mac") || deviceLower.includes("iphone") || deviceLower.includes("ipad") || deviceLower.includes("safari");
    const isWindows = deviceLower.includes("windows") || deviceLower.includes("win");
    const isAndroid = deviceLower.includes("android");
    const isLinux = deviceLower.includes("linux");

    let iconClass = "fa-solid fa-display"; 
    if (isApple) iconClass = "fa-brands fa-apple";
    else if (isWindows) iconClass = "fa-brands fa-windows";
    else if (isAndroid) iconClass = "fa-brands fa-android";
    else if (isLinux) iconClass = "fa-brands fa-linux";

    return (
        <tr className="hover:bg-gray-50">
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                        <i className={iconClass}/>
                    </div>
                    
                    <div>
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                            <span>{device}</span>
                            
                            {isCurrent && (
                                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                    Current Session
                                </span>
                            )}
                            
                        </div>
                        <div className="text-xs text-gray-500"> {location} </div>
                    </div>
                </div>
            </td>
            
            <td className="px-4 py-4 font-mono text-sm text-gray-600"> {ipAddress} </td>
            
            <td className="px-4 py-4 text-sm text-gray-600"> {lastActive} </td>
            
            <td className="px-4 py-4 text-right">
                {!isCurrent && (
                    <button
                        type="button"
                        onClick={() => onTerminate(id)}
                        disabled={disabled}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Sign Out
                    </button>
                )}
            </td>
        </tr>
    );
};

export default SessionRow;