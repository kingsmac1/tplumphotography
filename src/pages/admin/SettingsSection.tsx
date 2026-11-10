import BusinessSettingsPanel from "./BusinessSettingsPanel";

/** Business details, booking hours and deposit rules. Invoice defaults live in Invoices; email settings in Emails. */
export default function SettingsSection() {
  return (
    <div className="space-y-8">
      <BusinessSettingsPanel />
      <div className="border border-border p-6 max-w-3xl space-y-2 text-sm">
        <h2 className="font-display text-2xl">Elsewhere</h2>
        <p><a className="underline" href="#invoices/new">Invoices</a> → open any invoice → “Save … as default” sets your invoice logo, Interac e-Transfer email, tax (GST/HST) and terms.</p>
        <p><a className="underline" href="#emails">Emails &amp; Messaging</a> → templates for every automatic email and the addresses that receive the studio's copies.</p>
        <p><a className="underline" href="#attendance">Staff Check-in</a> → the studio location staff check in from.</p>
        <p><a className="underline" href="#pricing">Prices &amp; Packages</a> → every package, add-on and studio rental price.</p>
      </div>
    </div>
  );
}
