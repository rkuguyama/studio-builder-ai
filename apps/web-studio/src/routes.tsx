import * as React from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useParams,
  useNavigate,
} from "@tanstack/react-router";
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

  return (
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
      onNewProject={() => navigate({ to: "/" })}
    />
  );
}

// ---------------------------------------------------------------------------
// App builder page
// ---------------------------------------------------------------------------

function AppBuilderPage() {
  const navigate = useNavigate();
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
      onSessionChange={(newAppId, newChatId) => {
        navigate({
          to: "/app/$appId",
          params: { appId: String(newAppId) },
          search: { chatId: String(newChatId) },
        });
      }}
      onNewProject={() => navigate({ to: "/" })}
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

