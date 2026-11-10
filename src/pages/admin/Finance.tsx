import { useState } from "react";
import FinanceOverview from "./FinanceOverview";
import OtherIncomeManager from "./OtherIncomeManager";
import ExpensesManager from "./ExpensesManager";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "other-income", label: "Other Income" },
  { id: "expenses", label: "Expenses" },
] as const;

const Finance = () => {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("overview");
  return (
    <div>
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-body font-bold tracking-widest border transition-colors ${
              tab === t.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === "overview" && <FinanceOverview />}
      {tab === "other-income" && <OtherIncomeManager />}
      {tab === "expenses" && <ExpensesManager />}
    </div>
  );
};

export default Finance;
