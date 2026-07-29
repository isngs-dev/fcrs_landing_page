import { withLambda } from "@netlify/aws-lambda-compat";
import { handler as expressHandler } from "../../backend/src/handler.js";

// Keep the Express/serverless-http application on its Lambda-style contract,
// while exposing the Web Request/Response signature used by modern Netlify
// Functions. The custom path keeps browser requests same-origin and preserves
// the /api prefix expected by the Express routes.
export default withLambda(expressHandler);

export const config = {
  path: "/api/*",
};
