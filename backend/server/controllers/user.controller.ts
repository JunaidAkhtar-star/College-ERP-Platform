// user.controller.ts — all user management operations are handled by adminController.
// user.routes.ts imports adminController directly; this file exists for router-plugin
// auto-discovery compatibility (routes/user.routes.ts is paired with this controller).
export * from "./admin.controller";
