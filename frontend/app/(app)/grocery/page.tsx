import { PageHeader } from "@/components/ui/Card";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Grocery List" subtitle="Weekly groceries generated from your plan." />
      <NotBuiltYet />
    </div>
  );
}
