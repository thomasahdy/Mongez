import { useState } from "react";
import { useTranslation } from "react-i18next";
import { changePassword } from "../../services/api/securityService";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const PasswordCard = () => {
const { t } = useTranslation();
const { dir } = useLocaleDirection();
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
        newErrors.currentPassword = t("securityPage.password.currentRequired");
    }
    
    if (!newPassword.trim()) {
        newErrors.newPassword = t("securityPage.password.nextRequired");
    } else if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        newErrors.newPassword = t("securityPage.password.rules");
    }
    
    if (!confirmPassword.trim()) {
        newErrors.confirmPassword = t("securityPage.password.confirmRequired");
    } else if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = t("securityPage.password.mismatch");
    }
    
    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }
    
    setLoading(true);

    try{
        await changePassword(currentPassword, newPassword);
        setSuccess(t("securityPage.password.success"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setErrors({});
    } catch (error) {
        console.error(error);

        const msg = error.response?.data?.error?.message || t("securityPage.password.genericError");

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
    <div className="security-section" dir={dir}>
        <form onSubmit={handleSubmit}>
            <div className="security-section-title">
                <i className="fa-solid fa-key channel-email"></i>
                {t("securityPage.password.title")}
            </div>
            
            <div className="form-group">
                <label className="form-label">{t("securityPage.password.current")}</label>
                
                <input type="password" placeholder={t("securityPage.password.currentPlaceholder")} className="form-input"
                
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}/>
                {errors.currentPassword && ( <p className="form-error">{errors.currentPassword}</p>)}
            </div>

            <div className="form-group">
                <label className="form-label">{t("securityPage.password.next")}</label>
                
                <input type="password" placeholder={t("securityPage.password.nextPlaceholder")} className="form-input"
                
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}/>
                
                {errors.newPassword && ( <p className="form-error">{errors.newPassword}</p>)}
                <p className="form-hint">{t("securityPage.password.hint")}</p>
            </div>
            
            <div className="form-group">
                <label className="form-label">{t("securityPage.password.confirm")}</label>
                
                <input type="password" placeholder={t("securityPage.password.confirmPlaceholder")} className="form-input"
                
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}/>
                
                {errors.confirmPassword && ( <p className="form-error">{errors.confirmPassword}</p>)}
            </div>
            
            {errors.api && ( <p className="form-error">{errors.api}</p>)}
            {success && ( <p className="form-success">{success}</p>)}
            
            <div style={{ marginTop: 16 }}>
            <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? t("securityPage.password.updating") : t("securityPage.password.update")}
            </button>
            </div>
        </form>
    </div>
);
};

export default PasswordCard;
