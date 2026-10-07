import { useMemo, useState } from "react";
import {
  MessageSquare,
  BookOpen,
  LayoutList,
  FileJson,
  MapPin,
  Activity,
  Clock,
  ChevronDown,
} from "lucide-react";
import type { DisputeCase, Evidence } from "../types";
import { cn } from "../lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import ProfileBar from "./ProfileBar";

interface EvidencePanelProps {
  dispute: DisputeCase;
}

function amountInfo(ev: Evidence): { label: string; value: string } | null {
  const td = ev.trip_data;
  if (td?.cleaning_fee) return { label: "Cleaning fee", value: `$${td.cleaning_fee.toFixed(2)}` };
  if (td?.cancellation_fee) return { label: "Cancellation fee", value: `$${td.cancellation_fee.toFixed(2)}` };
  if (ev.fare_breakdown?.total_charged) return { label: "Total charged", value: `$${(ev.fare_breakdown.total_charged as number).toFixed(2)}` };
  return null;
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
                      &bull; {String(item)}
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

type TimelineItem =
  | { source: "chat"; timestamp: string; data: { sender: string; type: string; content: string } }
  | { source: "app_event"; timestamp: string; data: { event_type: string; details: string } }
  | { source: "gps"; timestamp: string; data: { lat: number; lng: number; speed_kmh: number; status: string } };

function buildTimeline(ev: Evidence): TimelineItem[] {
  const items: TimelineItem[] = [];
  ev.chat_logs?.forEach((m) => items.push({ source: "chat", timestamp: m.timestamp, data: m }));
  ev.app_events?.forEach((e) => items.push({ source: "app_event", timestamp: e.timestamp, data: e }));
  ev.gps_telemetry?.forEach((g) => items.push({ source: "gps", timestamp: g.timestamp, data: g }));
  items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return items;
}

function TimelineIcon({ source }: { source: TimelineItem["source"] }) {
  if (source === "chat") return <MessageSquare className="w-3.5 h-3.5" />;
  if (source === "app_event") return <Activity className="w-3.5 h-3.5" />;
  return <MapPin className="w-3.5 h-3.5" />;
}

function TimelineLabel({ source }: { source: TimelineItem["source"] }) {
  if (source === "chat") return "Message";
  if (source === "app_event") return "App event";
  return "GPS";
}

function TimelineBadge({ source }: { source: "chat" | "app_event" | "gps" }) {
  const colors = {
    chat: "bg-teal-light text-teal-dark",
    app_event: "bg-amber-light text-amber-dark",
    gps: "bg-slate-100 text-text-muted",
  } as const;
  return (
    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", colors[source])}>
      {TimelineLabel({ source })}
    </span>
  );
}

function TimelineSummary({ item }: { item: TimelineItem }) {
  if (item.source === "chat") {
    const preview = item.data.content.length > 60 ? item.data.content.slice(0, 60).trim() + "…" : item.data.content;
    return (
      <div className="text-[13px] text-text-secondary">
        <span className="font-medium text-text-primary">{item.data.sender}</span>{" "}
        {item.data.type !== "message" && <span className="text-[11px] text-text-muted">({item.data.type}) </span>}
        {preview}
      </div>
    );
  }
  if (item.source === "app_event") {
    const preview = item.data.details.length > 60 ? item.data.details.slice(0, 60).trim() + "…" : item.data.details;
    return (
      <div className="text-[13px] text-text-secondary">
        <span className="font-medium text-text-primary">{item.data.event_type}</span>{" "}
        {preview}
      </div>
    );
  }
  return (
    <div className="text-[13px] text-text-secondary">
      <span className="font-medium text-text-primary">{item.data.status}</span>{" "}
      &middot; {item.data.speed_kmh} km/h &middot; {item.data.lat.toFixed(4)}, {item.data.lng.toFixed(4)}
    </div>
  );
}

function TimelineDetail({ item }: { item: TimelineItem }) {
  if (item.source === "chat") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2 text-[13px]">
          <span className="text-text-muted shrink-0">Sender:</span>
          <span className="text-text-primary font-medium">{item.data.sender}</span>
        </div>
        <div className="flex gap-2 text-[13px]">
          <span className="text-text-muted shrink-0">Type:</span>
          <span className="text-text-primary">{item.data.type}</span>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed bg-slate-50 rounded-md border border-border p-3">
          {item.data.content}
        </p>
      </div>
    );
  }
  if (item.source === "app_event") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2 text-[13px]">
          <span className="text-text-muted shrink-0">Event:</span>
          <span className="text-text-primary font-medium">{item.data.event_type}</span>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed bg-slate-50 rounded-md border border-border p-3">
          {item.data.details}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <div>
          <span className="text-text-muted">Lat:</span>{" "}
          <span className="text-text-primary font-medium">{item.data.lat.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-text-muted">Lng:</span>{" "}
          <span className="text-text-primary font-medium">{item.data.lng.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-text-muted">Speed:</span>{" "}
          <span className="text-text-primary font-medium">{item.data.speed_kmh} km/h</span>
        </div>
        <div>
          <span className="text-text-muted">Status:</span>{" "}
          <span className="text-text-primary font-medium capitalize">{item.data.status}</span>
        </div>
      </div>
    </div>
  );
}

function TimelineView({ ev }: { ev: Evidence }) {
  const items = useMemo(() => buildTimeline(ev), [ev]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-text-muted">No timestamped evidence available for this case.</p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-text-muted" />
        <span className="text-[13px] font-semibold text-text-primary">
          Chronological evidence ({items.length} events)
        </span>
      </div>
      <div className="relative">
        {items.map((item, i) => {
          const isSelected = selectedIndex === i;
          return (
            <div key={i} className="timeline-item relative pl-9 pr-2 py-2">
              {/* Connector line */}
              {i < items.length - 1 && (
                <div className="absolute left-[15px] top-8 bottom-[-8px] w-px bg-border" />
              )}
              {/* Dot */}
              <div
                className={cn(
                  "absolute left-2 top-2.5 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors duration-200",
                  isSelected
                    ? "bg-teal text-white border-teal"
                    : "bg-surface text-text-muted border-border"
                )}
              >
                <TimelineIcon source={item.source} />
              </div>
              {/* Card */}
              <button
                onClick={() => setSelectedIndex(isSelected ? null : i)}
                className={cn(
                  "w-full text-left rounded-lg border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50",
                  isSelected
                    ? "bg-teal-light/40 border-teal/30 shadow-sm"
                    : "bg-surface border-border hover:border-border-strong hover:shadow-card"
                )}
                aria-expanded={isSelected}
                aria-controls={`timeline-detail-${i}`}
              >
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <TimelineBadge source={item.source} />
                    <span className="text-[11px] text-text-muted font-mono">{item.timestamp}</span>
                  </div>
                  <TimelineSummary item={item} />
                </div>
                {isSelected && (
                  <div
                    id={`timeline-detail-${i}`}
                    className="px-3 pb-3 border-t border-border/50 pt-3"
                  >
                    <TimelineDetail item={item} />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverviewView({ dispute }: { dispute: DisputeCase }) {
  const ev = dispute.evidence;
  const info = amountInfo(ev);
  const [profilesOpen, setProfilesOpen] = useState(false);

  return (
    <div className="space-y-5">
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
      {info && (
        <section className="bg-slate-50 rounded-md border border-border p-3">
          <div className="text-[13px] text-text-secondary">
            {info.label}: <span className="font-semibold text-text-primary">{info.value}</span>
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
          <div className="text-[13px] text-text-primary mb-3 font-medium">{ev.actual_route_summary.join(" → ")}</div>
          <div className="text-[13px] text-text-secondary mb-1">Optimal route</div>
          <div className="text-[13px] text-text-primary font-medium">{ev.optimal_route_summary?.join(" → ")}</div>
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
              <li key={i} className="text-[13px] text-text-secondary">&bull; {n}</li>
            ))}
          </ul>
        </section>
      )}
      {ev.evidence_weight_notes && ev.evidence_weight_notes.length > 0 && (
        <section>
          <h4 className="text-[13px] font-semibold text-text-primary mb-2">Evidence weight notes</h4>
          <ul className="space-y-1">
            {ev.evidence_weight_notes.map((n, i) => (
              <li key={i} className="text-[13px] text-text-secondary">&bull; {n}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="border-t border-border pt-3">
        <Collapsible open={profilesOpen} onOpenChange={setProfilesOpen}>
          <CollapsibleTrigger className="w-full justify-between">
            <span className="flex items-center gap-1.5">
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", profilesOpen && "rotate-180")} />
              Profiles
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3">
              <ProfileBar driver={dispute.driver_profile} rider={dispute.rider_profile} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
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
              className={cn(
                "inline-block font-medium mr-1.5",
                m.sender === "rider" ? "text-teal-dark" : m.sender === "driver" ? "text-amber" : "text-text-muted"
              )}
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

function PolicyView({ ev }: { ev: Evidence }) {
  return (
    <div className="space-y-5">
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
  );
}

export default function EvidencePanel({ dispute }: EvidencePanelProps) {
  const ev = dispute.evidence;

  const tabDefs = [
    { value: "overview", label: "Overview", icon: LayoutList, show: true },
    { value: "timeline", label: "Timeline", icon: Clock, show: !!(ev.app_events?.length || ev.gps_telemetry?.length || ev.chat_logs?.length) },
    { value: "messages", label: "Messages", icon: MessageSquare, show: !!(ev.chat_logs && ev.chat_logs.length > 0) },
    { value: "policy", label: "Policy", icon: BookOpen, show: !!(ev.cancellation_policy || ev.lost_item_policy) },
    { value: "raw", label: "Raw", icon: FileJson, show: true },
  ];

  const visibleTabs = tabDefs.filter((t) => t.show);
  const defaultTab = visibleTabs[0]?.value ?? "overview";

  return (
    <div className="bg-surface rounded-xl shadow-card border border-border">
      <div className="px-4 pt-3 pb-0">
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                <t.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.slice(0, 3)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <OverviewView dispute={dispute} />
          </TabsContent>

          <TabsContent value="timeline">
            <TimelineView ev={ev} />
          </TabsContent>

          <TabsContent value="messages">
            {ev.chat_logs && (
              <div>
                <h4 className="text-[13px] font-semibold text-text-primary mb-3">Chat logs</h4>
                <ChatLog messages={ev.chat_logs} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="policy">
            <PolicyView ev={ev} />
          </TabsContent>

          <TabsContent value="raw">
            <div>
              <h4 className="text-[13px] font-semibold text-text-primary mb-3">Raw evidence</h4>
              <pre className="bg-slate-50 rounded-md border border-border p-4 text-[12px] text-text-secondary overflow-x-auto">
                {JSON.stringify(ev, null, 2)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
