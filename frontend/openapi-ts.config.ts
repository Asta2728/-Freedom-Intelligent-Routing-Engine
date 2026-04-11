import { defineConfig } from "@hey-api/openapi-ts";

// FastAPI exposes schema at /api/schema/ by default
// In production, replace with your deployed backend URL
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const input = `${baseUrl}/api/v1/openapi.json`;

export default defineConfig({
    // Fetches the OpenAPI schema live from the running FastAPI server
    input,

    output: "./src/lib/api/client",

    plugins: [
        {
            name: "@hey-api/client-next",
            runtimeConfigPath: "@/lib/api/hey-api.ts",
            throwOnError: true,
        },
        {
            name: "@hey-api/sdk",
            // Generates class-based services e.g. `UsersService.list()`
            asClass: true,
            operationId: true,
            classNameBuilder: "{{name}}Service",
            // methodNameBuilder: (operation) => {
            //     // @ts-expect-error - hey-api types
            //     let name: string = operation.name || operation.operationId || "unknown";
            //     // @ts-expect-error - hey-api types
            //     const service: string = operation.service;

            //     // Strip the service prefix from the method name to avoid e.g. `usersListUsers`
            //     if (service && name.toLowerCase().startsWith(service.toLowerCase())) {
            //         name = name.slice(service.length);
            //     }

            //     return name.charAt(0).toLowerCase() + name.slice(1);
            // },
        },
        {
            name: "@hey-api/schemas",
            type: "json",
        },
        {
            name: "@tanstack/react-query",
        },
    ],
});
