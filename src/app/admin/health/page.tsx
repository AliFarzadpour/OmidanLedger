export const dynamic = 'force-dynamic';

export default function AdminHealthPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">System Health</h1>
      <p className="mt-2 text-gray-500">
        System health check is temporarily disabled for the build process.
        This page will be restored after deployment.
      </p>
    </div>
  );
}
