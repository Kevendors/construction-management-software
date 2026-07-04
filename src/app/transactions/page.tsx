import { PageHeader } from "@/components/layout/page-header";
import { TransactionsLedgerView } from "@/components/transactions/transactions-ledger";
import { getTransactionsLedger } from "@/lib/data/transactions";

export default async function TransactionsPage() {
  const data = await getTransactionsLedger();
  return (
    <>
      <PageHeader title="Transactions" description="Company-wide money in / out ledger across all projects" />
      <TransactionsLedgerView data={data} />
    </>
  );
}
