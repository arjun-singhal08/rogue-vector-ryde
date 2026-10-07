import { Star, Car, ShieldAlert, CreditCard } from "lucide-react";
import type { Profile } from "../types";

function ProfileCard({ title, profile }: { title: string; profile: Profile }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-text-muted mb-3">{title}</div>
      <div className="space-y-2">
        {profile.name && (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-text-muted">Name:</span>
            <span className="text-text-primary font-medium">{profile.name}</span>
          </div>
        )}
        {typeof profile.rating === "number" && (
          <div className="flex items-center gap-2 text-[13px]">
            <Star className="w-3.5 h-3.5 text-amber" />
            <span className="text-text-primary font-medium">{profile.rating.toFixed(1)}</span>
          </div>
        )}
        {(typeof profile.total_completed_trips === "number" || typeof profile.total_trips === "number") && (
          <div className="flex items-center gap-2 text-[13px]">
            <Car className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-primary">{profile.total_completed_trips ?? profile.total_trips} trips</span>
          </div>
        )}
        {typeof profile.prior_disputes === "number" && (
          <div className="flex items-center gap-2 text-[13px]">
            <ShieldAlert className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-primary">{profile.prior_disputes} prior disputes</span>
          </div>
        )}
        {profile.payment_method && (
          <div className="flex items-center gap-2 text-[13px]">
            <CreditCard className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-primary capitalize">{profile.payment_method}</span>
          </div>
        )}
        {profile.vehicle && (
          <div className="text-[12px] text-text-muted mt-1">{profile.vehicle}</div>
        )}
      </div>
    </div>
  );
}

interface ProfileBarProps {
  driver: Profile;
  rider: Profile;
}

export default function ProfileBar({ driver, rider }: ProfileBarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ProfileCard title="Driver profile" profile={driver} />
      <ProfileCard title="Rider profile" profile={rider} />
    </div>
  );
}
