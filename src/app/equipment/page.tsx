import { EquipmentModule } from "@/components/equipment/equipment-module";
import { getEquipmentBoard } from "@/lib/data/operations";

export default async function EquipmentPage() {
  const board = await getEquipmentBoard();
  return <EquipmentModule board={board} />;
}
