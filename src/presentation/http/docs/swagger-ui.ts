export function swaggerUiHtml(): string {
	// Swagger UI loads from the CDN instead of bundling swagger-ui-express
	// assets because Vercel rewrites everything to /api/index and serving
	// node_modules assets from a serverless function is fragile. The spec is
	// fetched from /api-docs/openapi.json, served by this same app.
	return `<!doctype html>
<html lang="es">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Remisiones Backend — API Docs</title>
		<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
	</head>
	<body>
		<div id="swagger-ui"></div>
		<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin="anonymous"></script>
		<script>
			window.onload = () => {
				window.ui = SwaggerUIBundle({
					url: "/api-docs/openapi.json",
					dom_id: "#swagger-ui",
					deepLinking: true,
					presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
					layout: "StandaloneLayout",
				});
			};
		</script>
	</body>
</html>`;
}
