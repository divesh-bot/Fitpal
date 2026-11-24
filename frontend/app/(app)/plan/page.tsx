import { PageHeader } from "@/components/ui/Card";
import { HabitsCard } from "@/features/plan/HabitsCard";
import { PreferencesCard } from "@/features/plan/PreferencesCard";
import { ProfileCard } from "@/features/plan/ProfileCard";
import { ReferenceCards } from "@/features/plan/ReferenceCards";
import { TargetsCard } from "@/features/plan/TargetsCard";
import { WeekManagementCard } from "@/features/plan/WeekManagementCard";
import { WeeklyPlanCard } from "@/features/plan/WeeklyPlanCard";

export default function PlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan & Rules"
        subtitle="Weekly plan, profile and targets, dietary rules, habits, and the review protocol."
      />
      <WeekManagementCard />
      <WeeklyPlanCard />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProfileCard />
        <TargetsCard />
        <PreferencesCard />
        <HabitsCard />
      </div>
      <ReferenceCards />
    </div>
  );
}
