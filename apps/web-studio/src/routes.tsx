import * as React from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useParams,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { healthCheck } from "./api";
import { useEventStreamConnection } from "./hooks/useEventStream";
import { AppBuilder } from "./components/AppBuilder";
import { SettingsPage } from "./components/SettingsPage";

// ---------------------------------------------------------------------------
// Root layout — keeps the SSE connection alive app-wide
// ---------------------------------------------------------------------------

function RootLayout() {
  useEventStreamConnection();
  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

function StudioPage() {
  const navigate = useNavigate();
  const health = useQuery({
    queryKey: ["bridge-health"],
    queryFn: healthCheck,
    refetchInterval: 5000,
  });

  return (
    <main style={styles.page}>
      <p style={styles.status}>
        Bridge:{" "}
        {health.data ? (
          <span style={{ color: "#3fb950" }}>online</span>
        ) : (
          <span style={{ color: "#f85149" }}>offline</span>
        )}
      </p>
      <AppBuilder
        appId={null}
        chatId={null}
        onSessionChange={(appId, chatId) => {
          navigate({
            to: "/app/$appId",
            params: { appId: String(appId) },
            search: { chatId: String(chatId) },
          });
        }}
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// App builder page
// ---------------------------------------------------------------------------

function AppBuilderPage() {
  const { appId } = useParams({ from: "/app/$appId" });
  const searchParams = new URLSearchParams(window.location.search);
  const chatIdParam = searchParams.get("chatId");
  const parsedChatId = chatIdParam ? Number(chatIdParam) : null;
  const chatId = parsedChatId !== null && Number.isFinite(parsedChatId) ? parsedChatId : null;
  const parsedAppId = Number(appId);

  return (
    <AppBuilder
      appId={Number.isFinite(parsedAppId) ? parsedAppId : null}
      chatId={chatId}
    />
  );
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: StudioPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/$appId",
  component: AppBuilderPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([indexRoute, appRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    margin: 0,
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    minHeight: "100vh",
  },
  status: {
    margin: 0,
    padding: "0.5rem 1rem",
    fontSize: 14,
    borderBottom: "1px solid #30363d",
    backgroundColor: "#161b22",
  },
};
