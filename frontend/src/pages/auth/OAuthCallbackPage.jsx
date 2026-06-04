import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleOAuthCallback } from '../../services/oauth.service';
import { FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <FaSpinner className="animate-spin text-5xl text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">Processing authentication...</h2>
          <p className="text-slate-500 mt-2">Please wait while we complete your login.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <FaCheckCircle className="text-5xl text-success mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">Login Successful!</h2>
          <p className="text-slate-500 mt-2">{message}</p>
          <p className="text-sm text-slate-400 mt-4">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-6">
          <FaExclamationTriangle className="text-5xl text-danger mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">Authentication Failed</h2>
          <p className="text-slate-500 mt-2">{message}</p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default OAuthCallbackPage;