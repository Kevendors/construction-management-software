import { SubconModule } from "@/components/subcon/subcon-module";
import { getSubconBoard } from "@/lib/data/subcon";

export default async function SubconPage() {
  const board = await getSubconBoard();
  return <SubconModule board={board} />;
}
