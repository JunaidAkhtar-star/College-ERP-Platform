import { configs } from "../configs";
import cron from "node-cron";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import {
  getTenantConnection,
  tenantLocalStorage,
  waitForActiveConnection,
} from "../configs/connectionManager";
import { CommunicationCampaignModel } from "../models/communication-hub.model";
import { externalConnectorService } from "../services/external-connector.service";
import { registerJobHandler } from "../services/job-queue.service";
import { rabbitMqService } from "../services/rabbitmq.service";
import { outboxService } from "../services/outbox.service";
import { logger } from "../utils/logger.util";

async function reconcileCampaign(campaignId: string) {
  const campaign = await CommunicationCampaignModel.findById(campaignId).lean().exec();
  const sms = campaign?.channelStats.find((item) => item.channel === "sms");
  if (!campaign || !sms || sms.delivered + sms.failed < campaign.recipientCount) return;
  await CommunicationCampaignModel.updateOne(
    { _id: campaignId, "channelStats.channel": "sms" },
    {
      $set: {
        "channelStats.$.status": sms.failed === campaign.recipientCount ? "failed" : "sent",
        "channelStats.$.message": sms.failed ? `${sms.failed} SMS deliveries failed` : undefined,
      },
    },
  ).exec();
}

registerJobHandler("connector.sms.send", {
  async run(payload) {
    const campaignId = String(payload.campaignId);
    await externalConnectorService.execute(
      String(payload.connectorId),
      "sms.send",
      { to: payload.to, body: payload.body },
      String(payload.deliveryKey),
      String(payload.requestedBy),
    );
    await CommunicationCampaignModel.updateOne(
      { _id: campaignId, "channelStats.channel": "sms" },
      { $inc: { "channelStats.$.accepted": 1 } },
    ).exec();
  },
  async onDead(payload, error) {
    const campaignId = String(payload.campaignId);
    await CommunicationCampaignModel.updateOne(
      { _id: campaignId, "channelStats.channel": "sms" },
      {
        $inc: { "channelStats.$.failed": 1 },
        $set: { "channelStats.$.message": error },
      },
    ).exec();
    await reconcileCampaign(campaignId);
  },
});

/** Starts the RabbitMQ publisher/consumer transport after all handlers register. */
export function startOutboxJob(): void {
  if (!configs.RABBITMQ_URL) {
    logger.error("RabbitMQ job runtime disabled: RABBITMQ_URL is not configured");
    return;
  }
  void rabbitMqService.start();
  cron.schedule(
    "*/5 * * * * *",
    async () => {
      try {
        const tenants = await TenantModel.find({
          status: TenantStatus.ACTIVE,
          subscriptionExpiresAt: { $gt: new Date() },
        })
          .select("tenantId databaseName")
          .lean();
        await Promise.allSettled(
          tenants.map(async (tenant) => {
            await waitForActiveConnection(10_000);
            const tenantDb = getTenantConnection(tenant.tenantId, tenant.databaseName);
            await tenantLocalStorage.run({ tenantId: tenant.tenantId, tenantDb }, async () => {
              const result = await outboxService.publishDue();
              if (result.published || result.failed) {
                logger.cron(`RabbitMQ outbox tenant=${tenant.tenantId} ${JSON.stringify(result)}`);
              }
            });
          }),
        );
      } catch (error) {
        logger.error("RabbitMQ outbox dispatcher failed", error);
      }
    },
    { noOverlap: true, maxRandomDelay: 1_000 },
  );
  logger.cron("RabbitMQ transport and durable outbox dispatcher starting");
}
