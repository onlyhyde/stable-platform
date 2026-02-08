/**
 * ControllerMessenger Tests
 * TDD tests for controller communication system
 */

import {
  ControllerMessenger,
  type RestrictedControllerMessenger,
} from '../../../src/background/controllers/controllerMessenger'

describe('ControllerMessenger', () => {
  let messenger: ControllerMessenger

  beforeEach(() => {
    messenger = new ControllerMessenger()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('registerAction', () => {
    it('should register action handler', () => {
      const handler = jest.fn(() => 'result')

      messenger.registerAction('TestController:getState', handler)

      expect(messenger.hasAction('TestController:getState')).toBe(true)
    })

    it('should throw if action already registered', () => {
      const handler = jest.fn()
      messenger.registerAction('TestController:getState', handler)

      expect(() => {
        messenger.registerAction('TestController:getState', handler)
      }).toThrow('Action already registered')
    })
  })

  describe('unregisterAction', () => {
    it('should unregister action handler', () => {
      const handler = jest.fn()
      messenger.registerAction('TestController:getState', handler)

      messenger.unregisterAction('TestController:getState')

      expect(messenger.hasAction('TestController:getState')).toBe(false)
    })
  })

  describe('call', () => {
    it('should call registered action', () => {
      const handler = jest.fn(() => 'result')
      messenger.registerAction('TestController:getState', handler)

      const result = messenger.call('TestController:getState')

      expect(result).toBe('result')
      expect(handler).toHaveBeenCalled()
    })

    it('should pass arguments to action handler', () => {
      const handler = jest.fn((a: number, b: number) => a + b)
      messenger.registerAction('TestController:add', handler)

      const result = messenger.call('TestController:add', 2, 3)

      expect(result).toBe(5)
      expect(handler).toHaveBeenCalledWith(2, 3)
    })

    it('should throw for unregistered action', () => {
      expect(() => {
        messenger.call('UnknownController:getState')
      }).toThrow('Action not registered')
    })

    it('should handle async action handlers', async () => {
      const handler = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async result'
      })
      messenger.registerAction('TestController:asyncAction', handler)

      const result = await messenger.call('TestController:asyncAction')

      expect(result).toBe('async result')
    })
  })

  describe('publish', () => {
    it('should notify all subscribers', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      messenger.subscribe('TestController:stateChange', handler1)
      messenger.subscribe('TestController:stateChange', handler2)

      messenger.publish('TestController:stateChange', { value: 'test' })

      expect(handler1).toHaveBeenCalledWith({ value: 'test' })
      expect(handler2).toHaveBeenCalledWith({ value: 'test' })
    })

    it('should not throw if no subscribers', () => {
      expect(() => {
        messenger.publish('TestController:stateChange', { value: 'test' })
      }).not.toThrow()
    })
  })

  describe('subscribe', () => {
    it('should receive published events', () => {
      const handler = jest.fn()
      messenger.subscribe('TestController:stateChange', handler)

      messenger.publish('TestController:stateChange', 'payload')

      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('should return unsubscribe function', () => {
      const handler = jest.fn()
      const unsubscribe = messenger.subscribe('TestController:stateChange', handler)

      unsubscribe()
      messenger.publish('TestController:stateChange', 'payload')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('should stop receiving events', () => {
      const handler = jest.fn()
      messenger.subscribe('TestController:stateChange', handler)

      messenger.unsubscribe('TestController:stateChange', handler)
      messenger.publish('TestController:stateChange', 'payload')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('clearEventSubscriptions', () => {
    it('should clear all subscriptions for an event', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      messenger.subscribe('TestController:stateChange', handler1)
      messenger.subscribe('TestController:stateChange', handler2)

      messenger.clearEventSubscriptions('TestController:stateChange')
      messenger.publish('TestController:stateChange', 'payload')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('hasAction', () => {
    it('should return true for registered action', () => {
      messenger.registerAction('TestController:getState', () => {})

      expect(messenger.hasAction('TestController:getState')).toBe(true)
    })

    it('should return false for unregistered action', () => {
      expect(messenger.hasAction('TestController:getState')).toBe(false)
    })
  })
})

describe('RestrictedControllerMessenger', () => {
  let messenger: ControllerMessenger
  let restrictedMessenger: RestrictedControllerMessenger

  beforeEach(() => {
    messenger = new ControllerMessenger()

    // Register some actions and events on the main messenger
    messenger.registerAction('NetworkController:getChainId', () => 1)
    messenger.registerAction('AccountController:getAccounts', () => ['0x123'])
    messenger.registerAction('TransactionController:addTransaction', () => 'txId')
  })

  describe('creation', () => {
    it('should create restricted messenger with allowed actions', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: ['NetworkController:getChainId'],
        allowedEvents: [],
      })

      expect(restrictedMessenger).toBeDefined()
    })
  })

  describe('call', () => {
    it('should call allowed actions', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: ['NetworkController:getChainId'],
        allowedEvents: [],
      })

      const result = restrictedMessenger.call('NetworkController:getChainId')

      expect(result).toBe(1)
    })

    it('should throw for disallowed actions', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: ['NetworkController:getChainId'],
        allowedEvents: [],
      })

      expect(() => {
        restrictedMessenger.call('AccountController:getAccounts')
      }).toThrow('Action not allowed')
    })

    it('should allow calling own actions', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      restrictedMessenger.registerAction('TestController:getValue', () => 42)
      const result = restrictedMessenger.call('TestController:getValue')

      expect(result).toBe(42)
    })
  })

  describe('registerAction', () => {
    it('should register actions under controller namespace', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      restrictedMessenger.registerAction('TestController:getValue', () => 'value')

      expect(messenger.hasAction('TestController:getValue')).toBe(true)
    })

    it('should throw if registering action outside namespace', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      expect(() => {
        restrictedMessenger.registerAction('OtherController:getValue', () => {})
      }).toThrow('Cannot register action outside namespace')
    })
  })

  describe('subscribe', () => {
    it('should subscribe to allowed events', () => {
      const handler = jest.fn()
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: ['NetworkController:chainChanged'],
      })

      restrictedMessenger.subscribe('NetworkController:chainChanged', handler)
      messenger.publish('NetworkController:chainChanged', '0x1')

      expect(handler).toHaveBeenCalledWith('0x1')
    })

    it('should throw for disallowed events', () => {
      const handler = jest.fn()
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      expect(() => {
        restrictedMessenger.subscribe('NetworkController:chainChanged', handler)
      }).toThrow('Event not allowed')
    })

    it('should allow subscribing to own events', () => {
      const handler = jest.fn()
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      restrictedMessenger.subscribe('TestController:stateChange', handler)
      messenger.publish('TestController:stateChange', 'payload')

      expect(handler).toHaveBeenCalledWith('payload')
    })
  })

  describe('publish', () => {
    it('should publish events under controller namespace', () => {
      const handler = jest.fn()
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      messenger.subscribe('TestController:stateChange', handler)
      restrictedMessenger.publish('TestController:stateChange', 'payload')

      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('should throw if publishing event outside namespace', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      expect(() => {
        restrictedMessenger.publish('OtherController:stateChange', 'payload')
      }).toThrow('Cannot publish event outside namespace')
    })
  })

  describe('clearEventSubscriptions', () => {
    it('should clear own event subscriptions', () => {
      const handler = jest.fn()
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: [],
      })

      restrictedMessenger.subscribe('TestController:stateChange', handler)
      restrictedMessenger.clearEventSubscriptions('TestController:stateChange')
      messenger.publish('TestController:stateChange', 'payload')

      expect(handler).not.toHaveBeenCalled()
    })

    it('should throw if clearing events outside namespace', () => {
      restrictedMessenger = messenger.getRestricted({
        name: 'TestController',
        allowedActions: [],
        allowedEvents: ['NetworkController:chainChanged'],
      })

      expect(() => {
        restrictedMessenger.clearEventSubscriptions('NetworkController:chainChanged')
      }).toThrow('Cannot clear subscriptions outside namespace')
    })
  })
})
