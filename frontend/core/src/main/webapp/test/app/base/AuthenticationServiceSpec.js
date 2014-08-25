/* Copyright 2013-2014 Extended Mind Technologies Oy
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 'use strict';

describe('AuthenticationService', function() {

  // INJECTS

  var $httpBackend, $location, $q;
  var AuthenticationService, BackendClientService, HttpClientService;

  // MOCKS

  var authenticateResponse = getJSONFixture('authenticateResponse.json');
  var inviteResponse = getJSONFixture('inviteResponse.json');
  var acceptInviteResponse = getJSONFixture('acceptInviteResponse.json');
  var changePasswordResponse = getJSONFixture('passwordResponse.json');
  var inviteRequestResponse;
  var testOwnerUUID = '6be16f46-7b35-4b2d-b875-e13d19681e77';

  var MockUserSessionService = {
    authenticated: undefined,
    authenticateValid: undefined,
    authenticateReplaceable: undefined,
    isAuthenticated: function() {
      return this.authenticated;
    },
    isAuthenticateValid: function() {
      return this.authenticateValid;
    },
    isAuthenticateReplaceable: function() {
      return this.authenticateReplaceable;
    },
    isOfflineEnabled: function() {
      return false;
    },
    getActiveUUID: function() {
      return testOwnerUUID;
    },
    getCredentials: function() {
      return '123456789';
    },
    getEmail: function() {
      return;
    },
    getUserUUID: function() {
      return;
    },
    getLatestModified: function () {
      return undefined;
    },
    setIsAuthenticated: function(authenticated) {
      this.authenticated = authenticated;
    },
    setIsAuthenticateValid: function(authenticateValid) {
      this.authenticateValid = authenticateValid;
    },
    setIsAuthenticateReplaceable: function(authenticateReplaceable) {
      this.authenticateReplaceable = authenticateReplaceable;
    },
    setAuthenticateInformation: function(authenticateResponse, email) {
      if (email) {
        this.setEmail(email);
      }
      return;
    },
    setEmail: function(/*email*/) {
      return;
    },
    clearUser: function() {
      return;
    }
  };

  var MockItemsService = {
    synchronize: function() {
      return;
    }
  };

  // SETUP / TEARDOWN

  beforeEach(function() {
    module('em.appTest');

    module('em.base', function ($provide){
      $provide.value('UserSessionService', MockUserSessionService);
    });

    module('em.main', function ($provide){
      $provide.value('ItemsService', MockItemsService);
    });

    inject(function (_$httpBackend_, _$location_, _$q_, _AuthenticationService_, _BackendClientService_, _HttpClientService_) {
      $httpBackend = _$httpBackend_;
      $location = _$location_;
      $q = _$q_;
      AuthenticationService = _AuthenticationService_;
      BackendClientService = _BackendClientService_;
      HttpClientService = _HttpClientService_;
    });

    spyOn($location, 'path');
    spyOn($location, 'search');
    inviteRequestResponse = getJSONFixture('inviteRequestResponse.json');
  });

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  // TESTS

  function verifyAndUpdateAuthenticationPromise() {
    var deferred = $q.defer();
    AuthenticationService.verifyAndUpdateAuthentication().then(function() {
      deferred.resolve(true);
    }, function() {
      deferred.resolve(false);
    });
    return deferred.promise;
  }

  it('should authenticate with username and password', function () {
    var returned;
    $httpBackend.expectPOST('/api/authenticate').respond(200, authenticateResponse);
    AuthenticationService.login({username:'timo@ext.md', password: 'timopwd'}).then(function() {
      returned = true;
    });
    $httpBackend.flush();
    expect(returned).toBe(true);
  });

  it('should set email to Web Storage after successful authentication', function() {
    var user = {
      username: 'example@example.com',
      password: 'example'
    };
    spyOn(MockUserSessionService, 'setEmail');
    $httpBackend.expectPOST('/api/authenticate').respond(200, authenticateResponse);
    AuthenticationService.login(user);
    $httpBackend.flush();
    expect(MockUserSessionService.setEmail).toHaveBeenCalledWith(user.username);
  });

  it('should post invite request', function() {
    var email = 'example@example.com';
    var skipLogStatuses = [0, 400, 404, 502];
    var postInviteRequestRegex = /^\/api\/invite\/request$/;
    spyOn(BackendClientService, 'postOnline').andCallThrough();
    spyOn(MockUserSessionService, 'setEmail');

    $httpBackend.expectPOST('/api/invite/request').respond(200);
    AuthenticationService.postInviteRequest(email);
    $httpBackend.flush();

    expect(BackendClientService.postOnline).toHaveBeenCalledWith(
      '/api/invite/request',
      postInviteRequestRegex,
      {email: email, bypass: true},
      true,
      skipLogStatuses);
    expect(MockUserSessionService.setEmail).toHaveBeenCalledWith(email);
  });

  it('should resolve authenticated user and redirect from \'/\' to \'/my\'', function() {
    spyOn(MockUserSessionService, 'getUserUUID').andReturn(testOwnerUUID);
    AuthenticationService.checkAndRedirectUser();
    expect($location.path).toHaveBeenCalledWith('/my');
  });

  it('should resolve user with new invite request and redirect from \'/\' to \'/waiting\'', function() {
    // SETUP
    inviteRequestResponse.resultType = 'newInviteRequest';
    spyOn(MockUserSessionService, 'getEmail').andReturn('example@example.com');
    spyOn(MockUserSessionService, 'getUserUUID').andReturn();
    var email = MockUserSessionService.getEmail();
    $httpBackend.expectPOST('/api/invite/request', {email: email, bypass: true}).
    respond(200, inviteRequestResponse);

    // EXECUTE
    AuthenticationService.checkAndRedirectUser();
    $httpBackend.flush();

    expect($location.path).toHaveBeenCalledWith('/waiting');
    expect($location.search).toHaveBeenCalledWith({
      uuid: inviteRequestResponse.result.uuid,
      queueNumber: inviteRequestResponse.queueNumber,
      request: true
    });
  });

  it('should resolve user with existing invite request and redirect from \'/\' to \'/waiting\'', function() {
    // SETUP
    inviteRequestResponse.resultType = 'inviteRequest';
    spyOn(MockUserSessionService, 'getEmail').andReturn('example@example.com');
    spyOn(MockUserSessionService, 'getUserUUID').andReturn();
    var email = MockUserSessionService.getEmail();
    $httpBackend.expectPOST('/api/invite/request', {email: email, bypass: true}).
    respond(200, inviteRequestResponse);

    // EXECUTE
    AuthenticationService.checkAndRedirectUser();
    $httpBackend.flush();

    expect($location.path).toHaveBeenCalledWith('/waiting');
    expect($location.search).toHaveBeenCalledWith({
      uuid: inviteRequestResponse.result.uuid,
      queueNumber: inviteRequestResponse.queueNumber,
      request: true
    });
  });

  it('should resolve invited user and redirect from \'/\' to \'/waiting\'', function() {
    // SETUP
    inviteRequestResponse.resultType = 'invite';
    spyOn(MockUserSessionService, 'getEmail').andReturn('example@example.com');
    spyOn(MockUserSessionService, 'getUserUUID').andReturn();
    var email = MockUserSessionService.getEmail();
    $httpBackend.expectPOST('/api/invite/request', {email: email, bypass: true}).
    respond(200, inviteRequestResponse);

    // EXECUTE
    AuthenticationService.checkAndRedirectUser();
    $httpBackend.flush();

    expect($location.path).toHaveBeenCalledWith('/waiting');
    expect($location.search).toHaveBeenCalledWith({
      uuid: inviteRequestResponse.result.uuid,
      email: email,
      invite: true
    });
  });

  it('should resolve existing not authenticated user and redirect from \'/\' to \'login\'', function() {
    // SETUP
    inviteRequestResponse.resultType = 'user';
    spyOn(MockUserSessionService, 'getEmail').andReturn('example@example.com');
    spyOn(MockUserSessionService, 'getUserUUID').andReturn();
    var email = MockUserSessionService.getEmail();
    $httpBackend.expectPOST('/api/invite/request', {email: email, bypass: true}).
    respond(200, inviteRequestResponse);

    // EXECUTE
    AuthenticationService.checkAndRedirectUser();
    $httpBackend.flush();

    expect($location.path).toHaveBeenCalledWith('/login');
  });

  it('should resolve fresh session and redirect from \'/\' to \'launch\'', function() {
    spyOn(MockUserSessionService, 'getEmail').andReturn();
    spyOn(MockUserSessionService, 'getUserUUID').andReturn();
    AuthenticationService.checkAndRedirectUser();
    expect($location.path).toHaveBeenCalledWith('/launch');
  });

  it('should set email to Web Storage after invite request', function() {
    var email = 'example@example.com';
    spyOn(MockUserSessionService, 'setEmail');
    $httpBackend.expectPOST('/api/invite/request').respond(200);
    AuthenticationService.postInviteRequest(email);
    $httpBackend.flush();

    expect(MockUserSessionService.setEmail).toHaveBeenCalledWith(email);
  });

  it('should get invite', function() {
    var inviteResponseCode = '6ee80fc23d4b0fee';
    var email = 'timo@ext.md';
    var invite;
    $httpBackend.expectGET('/api/invite/' + inviteResponseCode + '?email=' + email).respond(200, inviteResponse);
    AuthenticationService.getInvite(inviteResponseCode, email).then(function(response) {
      invite = response;
    });
    expect(invite).toBeUndefined();
    $httpBackend.flush();
    expect(invite).toBeDefined();
  });

  it('should sign up', function() {
    var inviteResponseCode = '123';
    var signUp;
    $httpBackend.expectPOST('/api/invite/' + inviteResponseCode + '/accept').respond(200, acceptInviteResponse);
    AuthenticationService.acceptInvite(inviteResponseCode, {email: 'timo@ext.md', password: 'timopwd'}).then(function(response) {
      signUp = response;
    });
    expect(signUp).toBeUndefined();
    $httpBackend.flush();
    expect(signUp).toBeDefined();
  });

  it('should verify and update authentication with valid, non-replaceable authentication', function() {
    MockUserSessionService.setIsAuthenticated(true);
    MockUserSessionService.setIsAuthenticateValid(true);
    MockUserSessionService.setIsAuthenticateReplaceable(false);

    verifyAndUpdateAuthenticationPromise().then(function(promise) {
      expect(promise).toEqual(true);
    });
  });

  it('should verify and update authentication with not valid but expired and replaceable authentication', function() {
    MockUserSessionService.setIsAuthenticated(true);
    MockUserSessionService.setIsAuthenticateValid(false);
    MockUserSessionService.setIsAuthenticateReplaceable(true);

    spyOn(MockUserSessionService, 'setAuthenticateInformation');

    $httpBackend.expectPOST('/api/authenticate').respond(200, authenticateResponse);
    verifyAndUpdateAuthenticationPromise().then(function(promise) {
      expect(promise).toEqual(true);
    });
    $httpBackend.flush();

    expect(MockUserSessionService.setAuthenticateInformation).toHaveBeenCalledWith(authenticateResponse);
  });

  it('should not verify and update authentication with not valid authentication', function() {
    MockUserSessionService.setIsAuthenticated(false);
    MockUserSessionService.setIsAuthenticateValid(false);
    MockUserSessionService.setIsAuthenticateReplaceable(false);

    verifyAndUpdateAuthenticationPromise().then(function(promise) {
      expect(promise).toEqual(false);
      expect($location.path).toHaveBeenCalledWith('/login');
    });
  });

  it('should not verify and update authentication with valid but expired and unreplaceable authentication', function() {
    MockUserSessionService.setIsAuthenticated(true);
    MockUserSessionService.setIsAuthenticateValid(false);
    MockUserSessionService.setIsAuthenticateReplaceable(false);

    verifyAndUpdateAuthenticationPromise().then(function(promise) {
      expect(promise).toEqual(false);
      expect($location.path).toHaveBeenCalledWith('/login');
    });
  });

  it('should change password', function() {
    var email = 'example@example.com';
    var currentPassword = 'currentPassword';
    var newPassword = 'newPassword';
    spyOn(BackendClientService, 'setUsernamePassword');

    $httpBackend.expectPUT('/api/password', {password: newPassword}).respond(200, changePasswordResponse);
    AuthenticationService.putChangePassword(email, currentPassword, newPassword);
    $httpBackend.flush();
  });
});