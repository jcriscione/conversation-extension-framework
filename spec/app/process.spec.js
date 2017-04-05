/**
* @Date:   2017-03-19T23:23:08-05:00
* @Last modified time: 2017-04-04T19:24:01-05:00
* @License: Licensed under the Apache License, Version 2.0 (the "License");  you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and
  limitations under the License.

* @Copyright: Copyright 2016 IBM Corp. All Rights Reserved.
*/

let processUtils = require('../../src/utils/process')
let conversationUtils = require('../../src/utils/conversation')
let ConversationExtension = require('../../src/core')
let conversationExtensionInstance = new ConversationExtension(process.env.CONVERSATION_API_URL, process.env.CONVERSATION_API_USER, process.env.CONVERSATION_API_PASSWORD)

// mute console warnings
console.warn = () => {}
// console.log = () => {}

describe('Verify support functions', () => {
  it('stores and retrieves user data from memory', () => {
    processUtils.storeUserData('A0A0A0', 'generic', {'public': 'public'}, {'private': 'private'}, {'response': 'response'})
    let userData = processUtils.retrieveUserData('A0A0A0', 'generic')
    expect(userData).toBeDefined()
    expect(userData).toEqual({
      context: {'public': 'public'},
      privateContext: {'private': 'private'},
      responseOptions: {'response': 'response'}
    })
  })
})

describe('Process handler', () => {
  describe('basic requirement testing', () => {
    beforeAll((done) => {
      spyOn(processUtils, 'retrieveUserData').and.callThrough()
      spyOn(conversationUtils, 'sendMessageToConversation').and.callThrough()
      processUtils.storeUserData('A0A0A1', 'generic', {'public': 'public'}, {'private': 'private'}, {'response': 'response'})
      conversationExtensionInstance.handleIncoming('test', 'A0A0A1', 'generic')
      done()
    })
    it('should call function to retrieve user data from memory', () => {
      expect(processUtils.retrieveUserData).toHaveBeenCalled()
    })
    it('should call retrieve correct user data per initial call', () => {
      expect(processUtils.retrieveUserData.calls.mostRecent().args).toEqual(['A0A0A1', 'generic'])
    })
    it('should call Watson Conversation', () => {
      expect(conversationUtils.sendMessageToConversation).toHaveBeenCalled()
    })
    it('should call Watson Conversation with proper data', () => {
      expect(conversationUtils.sendMessageToConversation.calls.mostRecent().args).toEqual(['test', {'public': 'public'}, process.env.CONVERSATION_API_URL, process.env.CONVERSATION_API_USER, process.env.CONVERSATION_API_PASSWORD])
    })
  })
  describe('updates fields as expected', () => {
    it('and doesn\'t change context if there is no requirement', () => {
      processUtils.storeUserData('A0A0A2', 'generic', {'public': 'public'}, {'private': 'private'}, {'updatesContext': false, 'updatesContextField': 'shouldNotExist'})
      conversationExtensionInstance.handleIncoming('test', 'A0A0A2', 'generic')
      let userData = processUtils.retrieveUserData('A0A0A2', 'generic')
      expect(userData.context.shouldNotExist).not.toBeDefined()
    })
    it('and updates public context if specified', () => {
      processUtils.storeUserData('A0A0A2', 'generic', {'public': 'public'}, {'private': 'private'}, {'updatesContext': true, 'updatesContextField': 'shouldExist'})
      conversationExtensionInstance.handleIncoming('test', 'A0A0A2', 'generic')
      let userData = processUtils.retrieveUserData('A0A0A2', 'generic')
      expect(userData.context.shouldExist).toEqual('test')
    })
    it('and updates private context if specified', () => {
      processUtils.storeUserData('A0A0A2', 'generic', {'public': 'public'}, {'private': 'private'}, {'updatesContext': true, 'updatesContextField': 'shouldExistPrivately', 'updatesContextType': 'private'})
      conversationExtensionInstance.handleIncoming('test', 'A0A0A2', 'generic')
      let userData = processUtils.retrieveUserData('A0A0A2', 'generic')
      expect(userData.privateContext.shouldExistPrivately).toEqual('test')
      expect(userData.context.shouldExistPrivately).toEqual('private')
    })
  })
  describe('stores context from Watson Conversation', () => {
    describe('basic functionality', () => {
      beforeAll(async (done) => {
        spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve ({
                output: {
                  text: ['test-response']
                },
                context: {
                  test: 'test-value'
                }
              })
            }, 200)
          })
        }

        )
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A3', 'generic')
        done()
      })
      it('and updates public context with data from Watson Conversation', () => {
        let userData = processUtils.retrieveUserData('A0A0A3', 'generic')
        expect(userData.context).toEqual({test: 'test-value'})
      })
    })

    describe('for expected update to private context field', () => {
      beforeAll(async (done) => {
        spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(
                {
                  output: {
                    text: ['test-response'],
                    updatesContext: 'testField:private'
                  },
                  context: {
                    test: 'test-value'
                  }
                }
              )}, 200)
            })
        })
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A4', 'generic')
        done()
      })
      it('updates responseOptions with data from Watson Conversation', () => {
        let userData = processUtils.retrieveUserData('A0A0A4', 'generic')
        expect(userData.responseOptions.updatesContext).toEqual(true)
        expect(userData.responseOptions.updatesContextField).toEqual('testField')
        expect(userData.responseOptions.updatesContextType).toEqual('private')
      })
    })

    describe('for expected update to public context field', () => {
      beforeAll(async (done) => {
        spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(
                {
                  output: {
                    text: ['test-response'],
                    updatesContext: 'testField'
                  },
                  context: {
                    test: 'test-value'
                  }
                }
              )}, 200)
            })
        })
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A5', 'generic')
        done()
      })
      it('updates responseOptions with data from Watson Conversation', () => {
        let userData = processUtils.retrieveUserData('A0A0A5', 'generic')
        expect(userData.responseOptions.updatesContext).toEqual(true)
        expect(userData.responseOptions.updatesContextField).toEqual('testField')
        expect(userData.responseOptions.updatesContextType).toEqual('public')
      })
    })

    describe('for malformed request to update context field', () => {
      beforeAll(async (done) => {
        spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(
                {
                  output: {
                    text: ['test-response'],
                    updatesContext: 'test@#$Field:private'
                  },
                  context: {
                    test: 'test-value'
                  }
                }
              )
            }, 200)
          })
        })
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A6', 'generic')
        done()
      })
      it('should not request an update to a context field', () => {
        let userData = processUtils.retrieveUserData('A0A0A6', 'generic')
        expect(userData.responseOptions.updatesContext).toEqual(false)
        expect(userData.responseOptions.updatesContextField).not.toBeDefined()
        expect(userData.responseOptions.updatesContextType).not.toBeDefined()
      })
    })

    describe('for no request to update context field', () => {
      beforeAll(async (done) => {
        spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(
                {
                  output: {
                    text: ['test-response']
                  },
                  context: {
                    test: 'test-value'
                  }
                }
              )
            }, 200)
          })
        })
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A7', 'generic')
        done()
      })
      it('should not request an update to a context field', () => {
        let userData = processUtils.retrieveUserData('A0A0A7', 'generic')
        expect(userData.responseOptions.updatesContext).toEqual(false)
        expect(userData.responseOptions.updatesContextField).not.toBeDefined()
        expect(userData.responseOptions.updatesContextType).not.toBeDefined()
      })
    })

  })
  describe('API Director directs as expected', () => {
    describe ('when no API call is requested', () => {
      beforeAll(async (done) => {
        spyOn(conversationExtensionInstance.handler.apiCallDirector, 'direct').and.callThrough()
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A8', 'generic')
        done()
      })
      it('does not call the API Call Director', () => {
        expect(conversationExtensionInstance.handler.apiCallDirector.direct).not.toHaveBeenCalled()
      })
    })
    describe('when an API call is requested with public data', () => {
      beforeAll(async (done) => {
        global.convCallCount = 0
        spyOn(conversationExtensionInstance.handler.apiCallDirector, 'direct').and.callThrough()
        spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
          if (global.convCallCount > 0) {
            global.convCallCount++
            return {
              output: {
                text: ['test-response']
              },
              context: {
                test: 'test-value'
              }
            }
          } else {
            global.convCallCount++
            return {
              output: {
                text: ['test-response'],
                apiCall: 'diceRoll'
              },
              context: {
                test: 'test-value'
              }
            }
          }
        })
        processUtils.storeUserData('A0A0A8', 'generic', {'public': 'public'}, {'private': 'private'}, {'response': 'response'})
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A8', 'generic')
        done()
      })
      it('calls API director', () => {
        expect(conversationExtensionInstance.handler.apiCallDirector.direct).toHaveBeenCalled()
      })
      it('calls API director with correct arguments', () => {
        expect(conversationExtensionInstance.handler.apiCallDirector.direct).toHaveBeenCalledWith('diceRoll', false, jasmine.objectContaining({test: 'test-value'}), {'private': 'private'})
      })
      it('calls Watson Conversation after leaving API director', () => {
        expect(conversationUtils.sendMessageToConversation.calls.count()).toEqual(2)
      })
    })

    describe('when an API call is requested with private data', () => {
      beforeAll(async (done) => {
        global.convCallCount = 0
        spyOn(conversationExtensionInstance.handler.apiCallDirector, 'direct').and.callThrough()
        spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
          if (global.convCallCount > 0) {
            global.convCallCount++
            return {
              output: {
                text: ['test-response']
              },
              context: {
                test: 'test-value'
              }
            }
          } else {
            global.convCallCount++
            return {
              output: {
                text: ['test-response'],
                apiCall: 'diceRoll:private'
              },
              context: {
                test: 'test-value'
              }
            }
          }
        })
        processUtils.storeUserData('A0A0A9', 'generic', {'public': 'public'}, {'private': 'private'}, {'response': 'response'})
        await conversationExtensionInstance.handleIncoming('test', 'A0A0A9', 'generic')
        done()
      })
      it('calls API director', () => {
        expect(conversationExtensionInstance.handler.apiCallDirector.direct).toHaveBeenCalled()
      })
      it('calls API director with correct arguments', () => {
        expect(conversationExtensionInstance.handler.apiCallDirector.direct).toHaveBeenCalledWith('diceRoll', true, {test: 'test-value'}, jasmine.objectContaining({'private': 'private'}))
      })
      it('calls Watson Conversation after leaving API director', () => {
        expect(conversationUtils.sendMessageToConversation.calls.count()).toEqual(2)
      })
    })
  })

  describe('augment message unit test', () => {
    it('augments message with data from public context', () => {
      let text = processUtils.augmentResponse('User: {{greeting}}, {{location}}!', {greeting: 'hello', location: 'world'}, {})
      expect(text).toEqual('User: hello, world!')
    })
    it('augments message with data from private context', () => {
      let text = processUtils.augmentResponse('User: {{greeting}}, {{location}}!', {}, {greeting: 'hello', location: 'world'})
      expect(text).toEqual('User: hello, world!')
    })
  })
})
describe('augments a message as requested by conversation', () => {
  describe('with private context data', () => {
    let responseText = ''
    beforeAll(async (done) => {
      processUtils.storeUserData('A0A1A0', 'generic', {}, {'location': 'World'}, {})
      spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve(
              {
                output: {
                  text: ['Hello, {{location}}']
                },
                context: {
                  test: 'test-value'
                }
              }
            )
          }, 1000)
        })
      })
      responseText = (await conversationExtensionInstance.handleIncoming('test', 'A0A1A0', 'generic')).responseText
      done()
    })
    it ('expects an augmented response', () => {
      expect(responseText).toEqual('Hello, World')
    })
  })
  describe('with public context data', () => {
    let responseText = ''
    beforeAll(async (done) => {
      processUtils.storeUserData('A0A1A1', 'generic', {}, {}, {})
      spyOn(conversationUtils, 'sendMessageToConversation').and.callFake(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve(
              {
                output: {
                  text: ['Hello, {{location}}']
                },
                context: {
                  location: 'Mars'
                }
              }
            )
          }, 200)
        })
      })
      responseText = (await conversationExtensionInstance.handleIncoming('test', 'A0A1A1', 'generic')).responseText
      done()
    })
    it ('expects an augmented response', () => {
      expect(responseText).toEqual('Hello, Mars')
    })
  })
})