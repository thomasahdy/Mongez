import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getCurrentUser, updateProfile } from '../../lib/usersApi';

const breadcrumbPath = [
  { name: 'Workspace', color: 'text-slate-400', ref: '/spaces' },
  { name: 'Settings', color: 'text-slate-800', ref: '' },
];

function SettingsPage() {
  const { setPath } = useOutletContext();
  const [profile, setProfile] = useState({ name: '', email: '', language: 'en' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setPath?.(breadcrumbPath);
  }, [setPath]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        setProfile({
          name: user?.name || '',
          email: user?.email || '',
          language: user?.language || 'en',
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (field) => (event) => {
    setProfile((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess('');

    try {
      await updateProfile({
        name: profile.name,
        language: profile.language,
      });
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-8 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-500">Profile Settings</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">Your account</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Manage your profile details loaded from the backend.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_16px_35px_rgba(15,23,42,0.05)] space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={profile.name}
              onChange={handleChange('name')}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
              value={profile.email}
              readOnly
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Language
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={profile.language}
              onChange={handleChange('language')}
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SettingsPage;
