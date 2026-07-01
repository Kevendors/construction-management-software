import { getClientsWithStats } from "@/lib/data/crm";
import { ClientsBoard } from "@/components/crm/clients-board";

export default async function ClientsPage() {
  const rows = await getClientsWithStats();
  return <ClientsBoard items={rows} />;
}
