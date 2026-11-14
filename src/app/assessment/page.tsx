import type { Metadata } from "next";
import { AssessmentFlow } from "@/components/assessment/assessment-flow";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getActivePlan } from "@/lib/plan";

export const metadata: Metadata = { title: "Free assessment" };

type Props = { searchParams: Promise<{ mode?: string }> };

export default async function AssessmentPage({ searchParams }: Props) {
  const { mode } = await searchParams;
  const session = await getSession();
  const plan = session ? await getActivePlan(await getDb(), session.id) : null;
  return (
    <div className="px-4 pb-10 pt-4 sm:px-8 sm:pt-10">
      <AssessmentFlow hasPlan={!!plan} isPaid={!!session?.isPaid} defaultMode={mode === "default"} />
    </div>
  );
}
