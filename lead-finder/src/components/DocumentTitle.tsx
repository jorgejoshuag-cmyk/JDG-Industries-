"use client";

import { useEffect } from "react";

/**
 * Sets the browser tab title from the client.
 * Used instead of generateMetadata on pages that refresh in place: with streamed metadata, in-app
 * refreshes of such a page never finished in production builds.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · JDG Lead Finder`;
  }, [title]);
  return null;
}
