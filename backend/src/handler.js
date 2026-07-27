import serverlessHttp from "serverless-http";
import { createApp } from "./app.js";

// Generic serverless entry point. Host-specific adapters (Vercel, Netlify,
// AWS Lambda, etc.) each expect a slightly different export shape, but
// serverless-http's wrapped handler is compatible with all of them as an
// `(event, context) => response` function — point the platform's function
// config at this file's default export. Local/long-running deployment
// keeps using src/server.js and app.listen(); this file is never imported
// by server.js and only exists for the serverless path.
export const handler = serverlessHttp(createApp());

export default handler;
