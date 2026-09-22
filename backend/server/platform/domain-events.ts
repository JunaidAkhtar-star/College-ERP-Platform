import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { BackendDomainId } from "./domain.types";
import type {
  ProductEntitlementContract,
  SubscriptionContract,
  TenantIdentityContract,
} from "./contracts";

export interface PlatformDomainEventMap {
  "tenant.lifecycle.changed": TenantIdentityContract;
  "subscription.changed": SubscriptionContract;
  "product.entitlements.changed": ProductEntitlementContract;
}

export interface DomainEventEnvelope<TType extends keyof PlatformDomainEventMap> {
  id: string;
  type: TType;
  source: BackendDomainId;
  occurredAt: string;
  correlationId?: string;
  payload: PlatformDomainEventMap[TType];
}

type DomainEventHandler<TType extends keyof PlatformDomainEventMap> = (
  event: DomainEventEnvelope<TType>,
) => void | Promise<void>;

const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);

export const domainEvents = {
  publish<TType extends keyof PlatformDomainEventMap>(
    type: TType,
    source: BackendDomainId,
    payload: PlatformDomainEventMap[TType],
    correlationId?: string,
  ): DomainEventEnvelope<TType> {
    const event: DomainEventEnvelope<TType> = {
      id: randomUUID(),
      type,
      source,
      occurredAt: new Date().toISOString(),
      correlationId,
      payload,
    };
    eventBus.emit(type, event);
    return event;
  },

  subscribe<TType extends keyof PlatformDomainEventMap>(
    type: TType,
    handler: DomainEventHandler<TType>,
  ): () => void {
    eventBus.on(type, handler);
    return () => eventBus.off(type, handler);
  },
};
