import Workspace from "@/components/layout/Workspace";
import { CollabProvider } from "@/components/collab/CollabProvider";

export const metadata = {
  title: "Atlas — Workspace",
};

export default function AppPage() {
  return (
    <CollabProvider>
      <Workspace />
    </CollabProvider>
  );
}
