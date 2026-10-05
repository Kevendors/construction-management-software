import { getChallansBoard } from "@/lib/data/challans";
import { ChallanBuilder } from "@/components/challans/challan-builder";

export default async function NewChallanPage() {
  const board = await getChallansBoard();
  return <ChallanBuilder projects={board.projects} materialItems={board.materialItems} />;
}
