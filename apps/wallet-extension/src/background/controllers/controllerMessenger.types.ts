/**
 * ControllerMessenger Types
 * Provides communication between controllers via actions and events
 */

/**
 * Action handler function type
 */
export type ActionHandler<Args extends unknown[] = unknown[], Result = unknown> = (
  ...args: Args
) => Result | Promise<Result>

/**
 * Event handler function type
 */
export type EventHandler<Payload = unknown> = (payload: Payload) => void

/**
 * Action definition
 */
export interface ActionDefinition<Name extends string = string> {
  name: Name
  handler: ActionHandler
}

/**
 * Event definition
 */
export interface EventDefinition<Name extends string = string, Payload = unknown> {
  name: Name
  payload: Payload
}

/**
 * Registered action
 */
export interface RegisteredAction {
  name: string
  handler: ActionHandler
}

/**
 * Event subscription
 */
export interface EventSubscription {
  event: string
  handler: EventHandler
}

/**
 * Controller messenger state
 */
export interface ControllerMessengerState {
  registeredActions: Map<string, ActionHandler>
  eventSubscriptions: Map<string, Set<EventHandler>>
}

/**
 * Restricted controller messenger options
 */
export interface RestrictedControllerMessengerOptions {
  name: string
  allowedActions?: string[]
  allowedEvents?: string[]
}
