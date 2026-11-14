import Link from "next/link";
import { ErrorState } from "@/components/states";

export default function NotFound() {
  return (
    <div className="px-4">
      <ErrorState
        title="This page isn't in the sketchbook"
        message="The link may be old, or the page belongs to a different browser session."
        action={
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
        }
      />
    </div>
  );
}
