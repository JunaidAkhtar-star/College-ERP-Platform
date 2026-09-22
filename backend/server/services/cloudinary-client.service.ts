import cloudinary from "cloudinary";
import createError from "http-errors";
import { platformIntegrationService } from "./platform-integration.service";

export async function configureCloudinary() {
  const dynamic = await platformIntegrationService.credentials<{
    cloudName: string;
    apiKey: string;
  }>("cloudinary");
  if (!dynamic)
    throw createError(503, "Platform file storage is not configured and connection-tested.");
  const cloudName = dynamic.config.cloudName;
  const apiKey = dynamic.config.apiKey;
  const apiSecret = dynamic.secret;
  cloudinary.v2.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return { client: cloudinary.v2, cloudName, apiKey, apiSecret };
}
