import { PageHeader } from "@/components/layout/page-header";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { getActivityFeed } from "@/lib/data/activity";

export default async function ActivityPage() {
  const entries = await getActivityFeed(200);
  return (
    <>
      <PageHeader title="Activity Log" description="A running history of actions across the workspace" />
      <ActivityTimeline entries={entries} />
    </>
  );
}
