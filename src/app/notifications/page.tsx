import { PageHeader } from "@/components/layout/page-header";
import { NotificationsCenter } from "@/components/notifications/notifications-center";
import { getNotifications } from "@/lib/data/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { notifications } = await getNotifications(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Review all alerts, pending approvals, and manage out-of-app device push notifications."
      />
      <NotificationsCenter initialNotifications={notifications} />
    </div>
  );
}
