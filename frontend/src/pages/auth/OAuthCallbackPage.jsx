import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { handleOAuthCallback } from '../../services/oauth.service';
import { FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useLocaleDirection } from '../../hooks/useLocaleDirection';

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const result = handleOAuthCallback();

    if (result.success) {
      setStatus('success');
      setMessage(result.message);

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } else {
      setStatus('error');
      setMessage(result.error || result.message);
    }
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center">
          <FaSpinner className="animate-spin text-5xl text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">{t("oauthPage.processingTitle")}</h2>
          <p className="text-slate-500 mt-2">{t("oauthPage.processingDescription")}</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center">
          <FaCheckCircle className="text-5xl text-success mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">{t("oauthPage.successTitle")}</h2>
          <p className="text-slate-500 mt-2">{message}</p>
          <p className="text-sm text-slate-400 mt-4">{t("oauthPage.redirecting")}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center max-w-md px-6">
          <FaExclamationTriangle className="text-5xl text-danger mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">{t("oauthPage.failedTitle")}</h2>
          <p className="text-slate-500 mt-2">{message}</p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              {t("oauthPage.tryAgain")}
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
            >
              {t("oauthPage.backHome")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default OAuthCallbackPage;
