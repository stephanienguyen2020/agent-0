import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { WalletDashboard } from "@/components/wallet/WalletDashboard";

export default function WalletPage() {
  return (
    <EditorialPageShell title="Wallet" showSearch={false}>
      <WalletDashboard />
    </EditorialPageShell>
  );
}
