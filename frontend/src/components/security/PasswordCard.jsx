import React, { useState } from "react";
import { changePassword } from "../../services/api/securityService";

const PasswordCard = () => {
const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

const [errors, setErrors] = useState({});
const [success, setSuccess] = useState("");
const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccess("");
    
    const newErrors = {};
    
    if (!currentPassword.trim()) {
        newErrors.currentPassword = "Current password is required.";
    }
    
    if (!newPassword.trim()) {
        newErrors.newPassword = "New password is required.";
    } else if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        newErrors.newPassword = "Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a number.";
    }
    
    if (!confirmPassword.trim()) {
        newErrors.confirmPassword = "Confirm password is required.";
    } else if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match.";
    }
    
    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }
    
    setLoading(true);

    try{
        await changePassword(currentPassword, newPassword);
        setSuccess("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setErrors({});
    } catch (error) {
        console.error(error);

        const msg = error.response?.data?.error?.message || "Something went wrong. Please try again.";

        if (msg.toLowerCase().includes("current password") || msg.toLowerCase().includes("incorrect")) {
            setErrors({ currentPassword: msg });
        } else if (msg.toLowerCase().includes("password")) {
            setErrors({ newPassword: msg });
        } else {
            setErrors({ api: msg });
        }
    } finally {
        setLoading(false);
    }
};
return (
    <div className="security-section">
        <form onSubmit={handleSubmit}>
            <div className="security-section-title">
                <i className="fa-solid fa-key channel-email"></i>
                Password
            </div>
            
            <div className="form-group">
                <label className="form-label">Current Password</label>
                
                <input type="password" placeholder="Enter your current password" className="form-input"
                
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}/>
                {errors.currentPassword && ( <p className="form-error">{errors.currentPassword}</p>)}
            </div>

            <div className="form-group">
                <label className="form-label">New Password</label>
                
                <input type="password" placeholder="Create a new password" className="form-input"
                
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}/>
                
                {errors.newPassword && ( <p className="form-error">{errors.newPassword}</p>)}
                <p className="form-hint">Must be at least 8 characters long and contain an uppercase letter, lowercase letter, and a number.</p>
            </div>
            
            <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                
                <input type="password" placeholder="Confirm your new password" className="form-input"
                
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}/>
                
                {errors.confirmPassword && ( <p className="form-error">{errors.confirmPassword}</p>)}
            </div>
            
            {errors.api && ( <p className="form-error">{errors.api}</p>)}
            {success && ( <p className="form-success">{success}</p>)}
            
            <div style={{ marginTop: 16 }}>
            <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "Updating..." : "Update Password"}
            </button>
            </div>
        </form>
    </div>
);
};

export default PasswordCard;
