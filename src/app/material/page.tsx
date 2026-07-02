import { MaterialModule } from "@/components/material/material-module";
import { getMaterialBoard } from "@/lib/data/material";

export default async function MaterialPage() {
  const board = await getMaterialBoard();
  return <MaterialModule board={board} />;
}
