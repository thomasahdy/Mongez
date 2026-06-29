import BillingPage from "../dashboard/BillingPage";
import SettingsSidebar from "./sections/SettingsSidebar";

export default function SettingsBillingPage({ setPath }) {
  return (
    <div className="settings-layout">
      <SettingsSidebar activeId="billing" />
      <main className="settings-content-area" style={{ padding: 0 }} aria-label="Billing settings">
        <BillingPage setPath={setPath} />
      </main>
    </div>
  );
}
