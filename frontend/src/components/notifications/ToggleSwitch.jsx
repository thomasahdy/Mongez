const ToggleSwitch = ({ checked, onChange, disabled }) => {
    return (
        <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
            <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}/>
            
            <div className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"}`}>
                
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}/>
            </div>
        </label>
    );
};

export default ToggleSwitch;