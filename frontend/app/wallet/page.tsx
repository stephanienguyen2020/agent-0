import { Topbar } from "@/components/shell/Topbar";
import { WalletDashboard } from "@/components/wallet/WalletDashboard";

export default function WalletPage() {
  return (
    <div>
      <Topbar title="Wallet" showSearch={false} />
      <WalletDashboard />
    </div>
  );
}
