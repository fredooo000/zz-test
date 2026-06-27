import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for /tv. The grid index lives in tv.index.tsx; detail pages in
// tv.$id.tsx. This route only renders the matched child via <Outlet />, so
// navigating from the grid to /tv/$id swaps the page instead of doing nothing.
export const Route = createFileRoute("/tv")({
  component: () => <Outlet />,
});
