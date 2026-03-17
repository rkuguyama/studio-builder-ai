import * as React from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApp, healthCheck, listApps, runApp, stopApp } from "./api";
import { useEventStreamConnection } from "./hooks/useEventStream";
import { AppBuilder } from "./components/AppBuilder";

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

// ---------------------------------------------------------------------------
// Home page — list apps, create new
// ---------------------------------------------------------------------------

function HomePage() {
  const [name, setName] = React.useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const health = useQuery({
    queryKey: ["bridge-health"],
    queryFn: healthCheck,
    refetchInterval: 5000,
  });

  const apps = useQuery({
    queryKey: ["apps"],
    queryFn: listApps,
  });

  const createAppMutation = useMutation({
    mutationFn: createApp,
    onSuccess: (result) => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      navigate({
        to: "/app/$appId",
        params: { appId: String(result.app.id) },
        search: { chatId: String(result.chatId) },
      });
    },
  });

  const runMutation = useMutation({ mutationFn: runApp });
  const stopMutation = useMutation({ mutationFn: stopApp });

  return (
    <main style={homeStyles.page}>
      <h1 style={homeStyles.heading}>Studio AI Builder</h1>
      <p style={homeStyles.status}>
        Bridge:{" "}
        {health.data ? (
          <span style={{ color: "#3fb950" }}>online</span>
        ) : (
          <span style={{ color: "#f85149" }}>offline</span>
        )}
      </p>

      <section style={homeStyles.section}>
        <h2 style={homeStyles.sectionHeading}>Create App</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createAppMutation.mutate(name.trim());
          }}
          style={homeStyles.form}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-app"
            style={homeStyles.input}
          />
          <button
            type="submit"
            disabled={createAppMutation.isPending}
            style={homeStyles.createButton}
          >
            {createAppMutation.isPending ? "Creating..." : "Create"}
          </button>
        </form>
      </section>

      <section>
        <h2 style={homeStyles.sectionHeading}>Apps</h2>
        {apps.isLoading && <p style={homeStyles.dimText}>Loading apps...</p>}
        {apps.error && <p style={{ color: "#f85149" }}>{apps.error.message}</p>}
        <ul style={homeStyles.appList}>
          {(apps.data ?? []).map((app) => (
            <li key={app.id} style={homeStyles.appCard}>
              <a
                href={`/app/${app.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate({
                    to: "/app/$appId",
                    params: { appId: String(app.id) },
                  });
                }}
                style={homeStyles.appLink}
              >
                <div style={homeStyles.appName}>{app.name}</div>
                <div style={homeStyles.appPath}>{app.path}</div>
              </a>
              <div style={homeStyles.appActions}>
                <button
                  onClick={() => runMutation.mutate(app.id)}
                  style={homeStyles.actionButton}
                >
                  Run
                </button>
                <button
                  onClick={() => stopMutation.mutate(app.id)}
                  style={homeStyles.actionButton}
                >
                  Stop
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
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
  const chatId = chatIdParam ? Number(chatIdParam) : null;

  return <AppBuilder appId={Number(appId)} chatId={chatId} />;
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/$appId",
  component: AppBuilderPage,
});

const routeTree = rootRoute.addChildren([indexRoute, appRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const homeStyles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    margin: 0,
    padding: "2rem",
    maxWidth: 960,
    marginLeft: "auto",
    marginRight: "auto",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    minHeight: "100vh",
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: "0.25rem",
  },
  status: {
    fontSize: 14,
    marginBottom: "1.5rem",
  },
  section: {
    marginBottom: "2rem",
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: "0.75rem",
  },
  form: {
    display: "flex",
    gap: "0.5rem",
  },
  input: {
    padding: "0.625rem 0.875rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    fontSize: 14,
    width: 300,
    outline: "none",
  },
  createButton: {
    padding: "0.625rem 1.25rem",
    borderRadius: 8,
    border: "none",
    backgroundColor: "#238636",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  dimText: {
    opacity: 0.5,
    fontSize: 14,
  },
  appList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  appCard: {
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#161b22",
  },
  appLink: {
    textDecoration: "none",
    color: "inherit",
    flex: 1,
  },
  appName: {
    fontWeight: 600,
    fontSize: 15,
    color: "#58a6ff",
  },
  appPath: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  appActions: {
    display: "flex",
    gap: "0.375rem",
  },
  actionButton: {
    padding: "0.25rem 0.75rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    fontSize: 12,
    cursor: "pointer",
  },
};
