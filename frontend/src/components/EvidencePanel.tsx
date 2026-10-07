import { useState } from "react";
import { MessageSquare, FileClock, BookOpen, LayoutList, FileJson, ChevronDown, ChevronUp } from "lucide-react";
import type { DisputeCase } from "../types";
import ProfileBar from "./ProfileBar";

interface EvidencePanelProps {
  dispute: DisputeCase;
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-md transition-colors",
        active
          ? "bg-teal-light text-teal-dark"
          : "text-text-secondary hover:bg-slate-100 hover:text-text-primary",
      ].join(" ")}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function KeyValueList({ data, moneyKeys = new Set<string>() }: { data: Record<string, unknown>; moneyKeys?: Set<string> }) {
  return (
    <dl className="space-y-2">
      {Object.entries(data).map(([key, value]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        if (value === null || value === undefined) return null;
        if (typeof value === "object" && !Array.isArray(value)) {
          const obj = value as Record<string, unknown>;
          if ("name" in obj) {
            return (
              <div key={key} className="flex gap-2 text-[13px]">
                <dt className="text-text-muted shrink-0">{label}:</dt>
                <dd className="text-text-primary">{String(obj.name)}</dd>
              </div>
            );
          }
          return (
            <div key={key}>
              <dt className="text-[13px] text-text-muted mb-1">{label}</dt>
              <dd className="bg-slate-50 rounded-md border border-border p-3">
                <KeyValueList data={obj} moneyKeys={moneyKeys} />
              </dd>
            </div>
          );
        }
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <dt className="text-[13px] text-text-muted mb-1">{label}</dt>
              <dd className="space-y-1">
                {value.map((item, i) => {
                  if (item !== null && typeof item === "object") {
                    return (
                      <div key={i} className="bg-slate-50 rounded-md border border-border p-2">
                        <KeyValueList data={item as Record<string, unknown>} moneyKeys={moneyKeys} />
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="text-[13px] text-text-primary">
                      • {String(item)}
                    </div>
                  );
                })}
              </dd>
            </div>
          );
        }
        const display = moneyKeys.has(key) && typeof value === "number" ? `$${value.toFixed(2)}` : String(value);
        return (
          <div key={key} className="flex gap-2 text-[13px]">
            <dt className="text-text-muted shrink-0">{label}:</dt>
            <dd className="text-text-primary">{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function ChatLog({ messages }: { messages: Array<{ timestamp: string; sender: string; type: string; content: string }> }) {
  return (
    <div className="space-y-3">
      {messages.map((m, i) => (
        <div key={i} className="flex gap-3 text-[13px]">
          <div className="text-text-muted shrink-0 w-36">{m.timestamp}</div>
          <div className="flex-1 min-w-0">
            <span
              className={[
                "inline-block font-medium mr-1.5",
                m.sender === "rider" ? "text-teal-dark" : m.sender === "driver" ? "text-amber" : "text-text-muted",
              ].join(" ")}
            >
              {m.sender}
            </span>
            {m.type !== "message" && (
              <span className="text-[11px] text-text-muted mr-1.5">({m.type})</span>
            )}
            <span className="text-text-primary">{m.content}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventLog({ events }: { events: Array<{ timestamp: string; event_type: string; details: string }> }) {
  return (
    <div className="space-y-3">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3 text-[13px]">
          <div className="text-text-muted shrink-0 w-36">{e.timestamp}</div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-text-primary mr-1.5">{e.event_type}</span>
            <span className="text-text-secondary">{e.details}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function GPSTable({ rows }: { rows: Array<{ timestamp: string; lat: number; lng: number; speed_kmh: number; status: string }> }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 font-semibold text-text-muted">Timestamp</th>
            <th className="text-left px-3 py-2 font-semibold text-text-muted">Lat</th>
            <th className="text-left px-3 py-2 font-semibold text-text-muted">Lng</th>
            <th className="text-left px-3 py-2 font-semibold text-text-muted">Speed (km/h)</th>
            <th className="text-left px-3 py-2 font-semibold text-text-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 text-text-primary">{r.timestamp}</td>
              <td className="px-3 py-2 text-text-primary">{r.lat.toFixed(4)}</td>
              <td className="px-3 py-2 text-text-primary">{r.lng.toFixed(4)}</td>
              <td className="px-3 py-2 text-text-primary">{r.speed_kmh}</td>
              <td className="px-3 py-2 text-text-primary capitalize">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpandableProfiles({ driver, rider }: { driver: DisputeCase["driver_profile"]; rider: DisputeCase["rider_profile"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border mt-4 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Profiles
      </button>
      {open && (
        <div className="mt-3">
          <ProfileBar driver={driver} rider={rider} />
        </div>
      )}
    </div>
  );
}

export default function EvidencePanel({ dispute }: EvidencePanelProps) {
  const ev = dispute.evidence;
  const tabs: { key: string; label: string; icon: React.ElementType; show: boolean }[] = [
    { key: "overview", label: "Overview", icon: LayoutList, show: true },
    { key: "timeline", label: "Timeline", icon: FileClock, show: !!(ev.app_events && ev.app_events.length > 0) || !!(ev.gps_telemetry && ev.gps_telemetry.length > 0) },
    { key: "messages", label: "Messages", icon: MessageSquare, show: !!(ev.chat_logs && ev.chat_logs.length > 0) },
    { key: "policy", label: "Policy", icon: BookOpen, show: !!(ev.cancellation_policy || ev.lost_item_policy) },
    { key: "raw", label: "Raw", icon: FileJson, show: true },
  ];

  const visibleTabs = tabs.filter((t) => t.show);
  const [active, setActive] = useState(visibleTabs[0]?.key ?? "overview");

  return (
    <div className="bg-surface rounded-lg shadow-card border border-border">
      <div className="px-4 pt-3 pb-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {visibleTabs.map((t) => (
            <TabButton key={t.key} active={active === t.key} onClick={() => setActive(t.key)} icon={t.icon} label={t.label} />
          ))}
        </div>
      </div>
      <div className="p-4">
        {active === "overview" && (
          <div className="space-y-4">
            {ev.actual_route_summary && typeof ev.actual_duration_minutes === "number" && typeof ev.estimated_duration_minutes === "number" && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Route metrics</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-md border border-border p-3">
                    <div className="text-[16px] font-bold text-text-primary">{ev.actual_duration_minutes} min</div>
                    <div className="text-[11px] text-text-muted mt-0.5">Actual duration</div>
                  </div>
                  <div className="bg-slate-50 rounded-md border border-border p-3">
                    <div className="text-[16px] font-bold text-text-primary">{ev.estimated_duration_minutes} min</div>
                    <div className="text-[11px] text-text-muted mt-0.5">Estimated duration</div>
                  </div>
                  <div className="bg-slate-50 rounded-md border border-border p-3">
                    <div className="text-[16px] font-bold text-text-primary">
                      ${typeof ev.fare_breakdown?.total_charged === "number" ? ev.fare_breakdown.total_charged.toFixed(2) : "—"}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">Total charged</div>
                  </div>
                </div>
              </section>
            )}
            {ev.dispute_ticket && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Dispute ticket</h4>
                <KeyValueList data={ev.dispute_ticket as unknown as Record<string, unknown>} />
              </section>
            )}
            {ev.trip_data && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Trip data</h4>
                <KeyValueList
                  data={ev.trip_data as unknown as Record<string, unknown>}
                  moneyKeys={new Set(["fare_charged", "cleaning_fee", "cancellation_fee", "amount"])}
                />
              </section>
            )}
            {ev.actual_route_summary && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Route comparison</h4>
                <div className="text-[13px] text-text-secondary mb-1">Actual route</div>
                <div className="text-[13px] text-text-primary mb-3">{ev.actual_route_summary.join(" → ")}</div>
                <div className="text-[13px] text-text-secondary mb-1">Optimal route</div>
                <div className="text-[13px] text-text-primary">{ev.optimal_route_summary?.join(" → ")}</div>
              </section>
            )}
            {ev.fare_breakdown && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Fare breakdown</h4>
                <dl className="space-y-2">
                  {Object.entries(ev.fare_breakdown).map(([key, value]) => {
                    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    if (key === "surge_multiplier") {
                      return (
                        <div key={key} className="flex gap-2 text-[13px]">
                          <dt className="text-text-muted shrink-0">{label}:</dt>
                          <dd className="text-text-primary">{typeof value === "number" ? `${value}×` : String(value)}</dd>
                        </div>
                      );
                    }
                    const display = typeof value === "number" ? `$${value.toFixed(2)}` : String(value);
                    return (
                      <div key={key} className="flex gap-2 text-[13px]">
                        <dt className="text-text-muted shrink-0">{label}:</dt>
                        <dd className="text-text-primary">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            )}
            {ev.driver_submitted_photo && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Driver photo report</h4>
                <KeyValueList data={ev.driver_submitted_photo} />
              </section>
            )}
            {ev.cleaning_fee_charge_event && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Cleaning fee charge</h4>
                <KeyValueList data={ev.cleaning_fee_charge_event} moneyKeys={new Set(["amount"])} />
              </section>
            )}
            {ev.lost_item_report && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Lost item report</h4>
                <KeyValueList data={ev.lost_item_report} />
              </section>
            )}
            {ev.ambiguity_notes && ev.ambiguity_notes.length > 0 && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Ambiguity notes</h4>
                <ul className="space-y-1">
                  {ev.ambiguity_notes.map((n, i) => (
                    <li key={i} className="text-[13px] text-text-secondary">• {n}</li>
                  ))}
                </ul>
              </section>
            )}
            {ev.evidence_weight_notes && ev.evidence_weight_notes.length > 0 && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Evidence weight notes</h4>
                <ul className="space-y-1">
                  {ev.evidence_weight_notes.map((n, i) => (
                    <li key={i} className="text-[13px] text-text-secondary">• {n}</li>
                  ))}
                </ul>
              </section>
            )}
            <ExpandableProfiles driver={dispute.driver_profile} rider={dispute.rider_profile} />
          </div>
        )}
        {active === "timeline" && (
          <div className="space-y-5">
            {ev.gps_telemetry && ev.gps_telemetry.length > 0 && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-3">GPS telemetry</h4>
                <GPSTable rows={ev.gps_telemetry} />
              </section>
            )}
            {ev.app_events && ev.app_events.length > 0 && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-3">App events</h4>
                <EventLog events={ev.app_events} />
              </section>
            )}
          </div>
        )}
        {active === "messages" && ev.chat_logs && (
          <div>
            <h4 className="text-[13px] font-semibold text-text-primary mb-3">Chat logs</h4>
            <ChatLog messages={ev.chat_logs} />
          </div>
        )}
        {active === "policy" && (
          <div className="space-y-4">
            {ev.cancellation_policy && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Cancellation policy</h4>
                <KeyValueList data={ev.cancellation_policy} moneyKeys={new Set(["cancellation_fee_after_wait"])} />
              </section>
            )}
            {ev.lost_item_policy && (
              <section>
                <h4 className="text-[13px] font-semibold text-text-primary mb-2">Lost item policy</h4>
                <KeyValueList data={ev.lost_item_policy} />
              </section>
            )}
          </div>
        )}
        {active === "raw" && (
          <div>
            <h4 className="text-[13px] font-semibold text-text-primary mb-3">Raw evidence</h4>
            <pre className="bg-slate-50 rounded-md border border-border p-4 text-[12px] text-text-secondary overflow-x-auto">
              {JSON.stringify(ev, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
