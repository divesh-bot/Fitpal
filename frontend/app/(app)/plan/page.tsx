import { PageHeader } from "@/components/ui/Card";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Plan & Rules" subtitle="Your 7-day meal plan, profile and targets." />
      <NotBuiltYet />
    </div>
  );
}
