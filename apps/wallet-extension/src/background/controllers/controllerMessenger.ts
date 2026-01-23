/**
 * ControllerMessenger
 * Provides communication between controllers via actions and events
 * Based on MetaMask's controller-messenger pattern
 */

import type {
  ActionHandler,
  EventHandler,
  RestrictedControllerMessengerOptions,
} from './controllerMessenger.types'

/**
 * Main controller messenger for inter-controller communication
 */
export class ControllerMessenger {
  private actions: Map<string, ActionHandler>
  private eventSubscriptions: Map<string, Set<EventHandler>>

  constructor() {
    this.actions = new Map()
    this.eventSubscriptions = new Map()
  }

  /**
   * Register an action handler
   */
  registerAction(name: string, handler: ActionHandler): void {
    if (this.actions.has(name)) {
      throw new Error('Action already registered')
    }
    this.actions.set(name, handler)
  }

  /**
   * Unregister an action handler
   */
  unregisterAction(name: string): void {
    this.actions.delete(name)
  }

  /**
   * Call a registered action
   */
  call<Result = unknown>(name: string, ...args: unknown[]): Result {
    const handler = this.actions.get(name)
    if (!handler) {
      throw new Error('Action not registered')
    }
    return handler(...args) as Result
  }

  /**
   * Publish an event to all subscribers
   */
  publish(event: string, payload?: unknown): void {
    const handlers = this.eventSubscriptions.get(event)
    if (!handlers) {
      return
    }

    for (const handler of handlers) {
      handler(payload)
    }
  }

  /**
   * Subscribe to an event
   */
  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.eventSubscriptions.has(event)) {
      this.eventSubscriptions.set(event, new Set())
    }
    this.eventSubscriptions.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.unsubscribe(event, handler)
    }
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(event: string, handler: EventHandler): void {
    const handlers = this.eventSubscriptions.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Clear all subscriptions for an event
   */
  clearEventSubscriptions(event: string): void {
    this.eventSubscriptions.delete(event)
  }

  /**
   * Check if an action is registered
   */
  hasAction(name: string): boolean {
    return this.actions.has(name)
  }

  /**
   * Create a restricted messenger for a specific controller
   */
  getRestricted(options: RestrictedControllerMessengerOptions): RestrictedControllerMessenger {
    return new RestrictedControllerMessenger(this, options)
  }
}

/**
 * Restricted controller messenger with limited access
 */
export class RestrictedControllerMessenger {
  private messenger: ControllerMessenger
  private name: string
  private allowedActions: Set<string>
  private allowedEvents: Set<string>

  constructor(messenger: ControllerMessenger, options: RestrictedControllerMessengerOptions) {
    this.messenger = messenger
    this.name = options.name
    this.allowedActions = new Set(options.allowedActions || [])
    this.allowedEvents = new Set(options.allowedEvents || [])
  }

  /**
   * Register an action (only in own namespace)
   */
  registerAction(name: string, handler: ActionHandler): void {
    if (!name.startsWith(`${this.name}:`)) {
      throw new Error('Cannot register action outside namespace')
    }
    this.messenger.registerAction(name, handler)
  }

  /**
   * Unregister an action (only in own namespace)
   */
  unregisterAction(name: string): void {
    if (!name.startsWith(`${this.name}:`)) {
      throw new Error('Cannot unregister action outside namespace')
    }
    this.messenger.unregisterAction(name)
  }

  /**
   * Call an action (only allowed or own namespace)
   */
  call<Result = unknown>(name: string, ...args: unknown[]): Result {
    if (!this.isActionAllowed(name)) {
      throw new Error('Action not allowed')
    }
    return this.messenger.call<Result>(name, ...args)
  }

  /**
   * Publish an event (only in own namespace)
   */
  publish(event: string, payload?: unknown): void {
    if (!event.startsWith(`${this.name}:`)) {
      throw new Error('Cannot publish event outside namespace')
    }
    this.messenger.publish(event, payload)
  }

  /**
   * Subscribe to an event (only allowed or own namespace)
   */
  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.isEventAllowed(event)) {
      throw new Error('Event not allowed')
    }
    return this.messenger.subscribe(event, handler)
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(event: string, handler: EventHandler): void {
    this.messenger.unsubscribe(event, handler)
  }

  /**
   * Clear event subscriptions (only in own namespace)
   */
  clearEventSubscriptions(event: string): void {
    if (!event.startsWith(`${this.name}:`)) {
      throw new Error('Cannot clear subscriptions outside namespace')
    }
    this.messenger.clearEventSubscriptions(event)
  }

  // Private methods

  private isActionAllowed(name: string): boolean {
    // Always allow own namespace
    if (name.startsWith(`${this.name}:`)) {
      return true
    }
    // Check allowed list
    return this.allowedActions.has(name)
  }

  private isEventAllowed(event: string): boolean {
    // Always allow own namespace
    if (event.startsWith(`${this.name}:`)) {
      return true
    }
    // Check allowed list
    return this.allowedEvents.has(event)
  }
}
