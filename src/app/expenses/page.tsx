import { ExpensesModule } from "@/components/expenses/expenses-module";
import { getExpensesBoard } from "@/lib/data/expenses";

export default async function ExpensesPage() {
  const board = await getExpensesBoard();
  return <ExpensesModule board={board} />;
}
