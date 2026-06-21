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
    <div className="rounded-xl border border-gray-200 bg-white p-6">
        <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <i className="fa-solid fa-key text-blue-600"></i>
                <span>Password</span>
            </div>
            
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700"> Current Password </label>
                
                <input type="password" placeholder="Enter your current password" className={`w-full rounded-lg border px-3 py-2.5 outline-none transition focus:ring-2 ${ errors.currentPassword
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`}
                
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}/>
                {errors.currentPassword && ( <p className="text-xs text-red-500"> {errors.currentPassword} </p>)}
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700"> New Password </label>
                
                <input type="password" placeholder="Create a new password" className={`w-full rounded-lg border px-3 py-2.5 outline-none transition focus:ring-2 ${ errors.newPassword
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`}
                
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}/>
                
                {errors.newPassword && ( <p className="text-xs text-red-500"> {errors.newPassword} </p>)}
                <p className="text-xs text-gray-500"> Must be at least 8 characters long and contain an uppercase letter, lowercase letter, and a number.</p>
            </div>
            
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700"> Confirm New Password </label>
                
                <input type="password" placeholder="Confirm your new password" className={`w-full rounded-lg border px-3 py-2.5 outline-none transition focus:ring-2 ${errors.confirmPassword
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`}
                
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}/>
                
                {errors.confirmPassword && ( <p className="text-xs text-red-500"> {errors.confirmPassword} </p>)}
            </div>
            
            {errors.api && ( <p className="text-sm text-red-500"> {errors.api}</p>)}
            {success && ( <p className="text-sm text-green-600"> {success} </p>)}
            
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? "Updating..." : "Update Password"}
            </button> 
        </form>
    </div>
);
};

export default PasswordCard;