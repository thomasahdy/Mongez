const AuditHeader = () => {
return (
    <div className="audit-header">
        <div> 
            <h1 className="audit-title">Audit Log</h1>
            <p className="audit-subtitle">Track all actions performed across your workspace. Logs are immutable and tamper-proof.</p>

        </div>
        <div className="immutable-badge">
            <i className="fa-solid fa-lock"></i>
            <span>Immutable · Write-once</span>
            
        </div>
    </div>
);
};

export default AuditHeader;
