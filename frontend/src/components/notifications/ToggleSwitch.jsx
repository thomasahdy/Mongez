const ToggleSwitch = ({ checked, onChange, disabled }) => {
    return (
        <label className={`toggle-switch ${disabled ? "is-disabled" : ""}`}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="toggle-slider"></span>
        </label>
    );
};

export default ToggleSwitch;
