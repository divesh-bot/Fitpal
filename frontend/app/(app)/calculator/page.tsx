import { PageHeader } from "@/components/ui/Card";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Calculator" subtitle="Food & recipe calculator, BMR and TDEE." />
      <NotBuiltYet />
    </div>
  );
}
