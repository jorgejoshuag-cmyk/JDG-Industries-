import { ImportWizard } from "@/components/ImportWizard";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Import leads" subtitle="Upload a contractor list, permit export or license file. Only import lists you are allowed to use." />
      <ImportWizard />
    </>
  );
}
