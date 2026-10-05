import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getChallansBoard } from "@/lib/data/challans";
import { ChallansList } from "@/components/challans/challans-list";
import { getAuthContext } from "@/lib/auth/context";
import type { Role } from "@/lib/types";

const CAN_WRITE: Role[] = ["super_admin", "pm"];

export default async function ChallansPage() {
  const [board, ctx] = await Promise.all([getChallansBoard(), getAuthContext()]);
  // No auth context = mock/demo mode, where the current user is a super_admin.
  const canWrite = ctx ? !!ctx.role && CAN_WRITE.includes(ctx.role) : true;

  return (
    <>
      <PageHeader
        title="Challans"
        description="Material dispatched to a site — a goods-movement record, not a sale"
        action={
          canWrite ? (
            <Link href="/challans/new">
              <Button>
                <Plus /> New Challan
              </Button>
            </Link>
          ) : undefined
        }
      />

      <ChallansList challans={board.challans} projects={board.projects} canWrite={canWrite} />
    </>
  );
}
