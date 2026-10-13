import { ProjectHeader } from '@/components/project/project-header';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <>
      <ProjectHeader projectId={projectId} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-4 md:p-6">{children}</div>
    </>
  );
}
