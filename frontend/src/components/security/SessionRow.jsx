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
        <tr>
            <td>
                <div className="device-info">
                    <div className="device-icon">
                        <i className={iconClass}/>
                    </div>
                    
                    <div>
                        <div>
                            <span>{device}</span>
                            
                            {isCurrent && (
                                <span className="current-session-badge">
                                    Current Session
                                </span>
                            )}
                            
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400 }}>{location}</div>
                    </div>
                </div>
            </td>
            
            <td style={{ fontFamily: "monospace" }}>{ipAddress}</td>
            
            <td>{lastActive}</td>
            
            <td style={{ textAlign: "right" }}>
                {!isCurrent && (
                    <button
                        type="button"
                        onClick={() => onTerminate(id)}
                        disabled={disabled}
                        className="btn btn-outline"
                        style={{ fontSize: 11, padding: "4px 10px" }}
                    >
                        Sign Out
                    </button>
                )}
            </td>
        </tr>
    );
};

export default SessionRow;
