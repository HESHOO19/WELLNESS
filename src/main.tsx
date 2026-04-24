import { createRoot } from "react-dom/client";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element #root was not found in index.html");
}

const renderStartupError = (error: unknown) => {
	const message = error instanceof Error ? error.message : "Unknown startup error";
	rootElement.innerHTML = `
		<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
			<div style="max-width:760px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(2,6,23,.08);">
				<h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Application failed to start</h1>
				<p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.5;">
					Most likely the Supabase environment variables are missing. Create a <strong>.env.local</strong>
					file in the project root with <strong>VITE_SUPABASE_URL</strong> and
					<strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong>.
				</p>
				<pre style="margin:0;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto;font-size:12px;">${message}</pre>
			</div>
		</div>
	`;
};

import("./App.tsx")
	.then(({ default: App }) => {
		createRoot(rootElement).render(<App />);
	})
	.catch((error) => {
		console.error("Startup error:", error);
		renderStartupError(error);
	});
