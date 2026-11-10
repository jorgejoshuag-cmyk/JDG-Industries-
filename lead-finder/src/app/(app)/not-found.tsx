import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-lg text-center">
      <h1>Not found</h1>
      <p className="muted mt-2">That page or lead does not exist. It may have been merged or deleted.</p>
      <Link href="/leads" className="btn mt-4">Back to leads</Link>
    </div>
  );
}
