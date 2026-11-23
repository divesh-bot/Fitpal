import { PageHeader } from "@/components/ui/Card";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Today" subtitle="Daily nutrition, meals, snacks, steps and habits." />
      <NotBuiltYet />
    </div>
  );
}
