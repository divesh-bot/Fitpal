import { PageHeader } from "@/components/ui/Card";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Log & Progress" subtitle="Weigh-ins, check-ins and PPL workouts." />
      <NotBuiltYet />
    </div>
  );
}
