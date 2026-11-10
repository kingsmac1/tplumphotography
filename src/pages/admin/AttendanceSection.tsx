import { useState } from "react";
import AttendanceTable from "./AttendanceTable";
import AttendanceReport from "./AttendanceReport";

const AttendanceSection = () => {
  const [tab, setTab] = useState<"checkins" | "report">("checkins");
  return (
    <div>
      <div className="flex gap-2 mb-6">
        {([["checkins", "Check-ins"], ["report", "Report"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-xs font-body font-bold tracking-widest border transition-colors ${
              tab === id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === "checkins" ? <AttendanceTable /> : <AttendanceReport />}
    </div>
  );
};

export default AttendanceSection;
