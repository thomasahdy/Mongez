const AuditHeader = () => {
return (
    <div className="flex items-start justify-between gap-4">
        <div> 
            <h1 className="text-3xl font-bold">Audit Log</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500"> Track all actions performed across your workspace. Logs are immutable and tamper-proof.</p>

        </div>
        <div className="flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium">
            <i className="fa-solid fa-lock"></i>
            <span>Immutable · Write-once</span>
            
        </div>
    </div>
);
};

export default AuditHeader;