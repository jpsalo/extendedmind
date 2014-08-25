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

describe('LaunchController', function() {
  var $httpBackend, $location, $scope;
  var BackendClientService, LaunchController, UserSessionService;
  var inviteRequestResponse;

  beforeEach(function() {
    module('em.appTest');

    inject(function($controller, _$httpBackend_, _$location_, $rootScope, _BackendClientService_, _UserSessionService_) {
      $scope = $rootScope.$new();
      LaunchController = $controller('LaunchController', {
        $scope: $scope
      });
      $httpBackend = _$httpBackend_;
      $location = _$location_;
      BackendClientService = _BackendClientService_;
      UserSessionService = _UserSessionService_;

      $scope.user = {
        email: 'example@example.md'
      };
    });

    spyOn($location, 'path');
    spyOn($location, 'search');
    spyOn(UserSessionService, 'setEmail');
    inviteRequestResponse = getJSONFixture('inviteRequestResponse.json');
  });

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('should redirect user with new invite request to waiting page', function() {
    // SETUP
    inviteRequestResponse.resultType = 'newInviteRequest';
    inviteRequestResponse.queueNumber = 155500;

    $httpBackend.expectPOST('/api/invite/request', {email: $scope.user.email, bypass: true})
    .respond(200, inviteRequestResponse);

    // EXECUTE
    $scope.launchUser();
    $httpBackend.flush();

    expect($location.path).toHaveBeenCalledWith('/waiting');
    expect($location.search).toHaveBeenCalledWith({
      uuid: inviteRequestResponse.result.uuid,
      queueNumber: inviteRequestResponse.queueNumber,
      request: true
    });
    expect(UserSessionService.setEmail).toHaveBeenCalledWith($scope.user.email);
  });

  it('should redirect user with existing invite request to waiting page', function() {
    // SETUP
    inviteRequestResponse.resultType = 'inviteRequest';
    inviteRequestResponse.queueNumber = 123;

    $httpBackend.expectPOST('/api/invite/request', {email: $scope.user.email, bypass: true})
    .respond(200, inviteRequestResponse);

    // EXECUTE
    $scope.launchUser();
    $httpBackend.flush();

    expect($location.path).toHaveBeenCalledWith('/waiting');
    expect($location.search).toHaveBeenCalledWith({
      uuid: inviteRequestResponse.result.uuid,
      queueNumber: inviteRequestResponse.queueNumber,
      request: true
    });
    expect(UserSessionService.setEmail).toHaveBeenCalledWith($scope.user.email);
  });

  it('should redirect invited user to waiting page', function() {
    // SETUP
    inviteRequestResponse.resultType = 'invite';

    $httpBackend.expectPOST('/api/invite/request', {email: $scope.user.email, bypass: true})
    .respond(200, inviteRequestResponse);

    // EXECUTE
    $scope.launchUser();
    $httpBackend.flush();

    expect($location.path).toHaveBeenCalledWith('/waiting');
    expect($location.search).toHaveBeenCalledWith({
      uuid: inviteRequestResponse.result.uuid,
      email: $scope.user.email,
      invite : true
    });
    expect(UserSessionService.setEmail).toHaveBeenCalledWith($scope.user.email);
  });

  it('should redirect existing user to root page', function() {
    // SETUP
    inviteRequestResponse.resultType = 'user';

    $httpBackend.expectPOST('/api/invite/request', {email: $scope.user.email, bypass: true})
    .respond(200, inviteRequestResponse);

    // EXECUTE
    $scope.launchUser();
    $httpBackend.flush();
    expect($location.path).toHaveBeenCalledWith('/login');
    expect(UserSessionService.setEmail).toHaveBeenCalledWith($scope.user.email);
  });

  it('should show an http error 404 not found message', function() {
    inviteRequestResponse.status = 404;

    $httpBackend.expectPOST('/api/invite/request', {email: $scope.user.email, bypass: true})
    .respond(404, inviteRequestResponse);

    $scope.launchUser();
    $httpBackend.flush();

    expect($scope.launchOffline).toBe(true);
  });

  it('should show an http error 502 bad gateway message', function() {
    inviteRequestResponse.status = 502;

    $httpBackend.expectPOST('/api/invite/request', {email: $scope.user.email, bypass: true})
    .respond(502, inviteRequestResponse);

    $scope.launchUser();
    $httpBackend.flush();

    expect($scope.launchOffline).toBe(true);
  });

  it('should show launch failed message', function() {
    $httpBackend.expectPOST('/api/invite/request', {email: $scope.user.email, bypass: true})
    .respond(400, inviteRequestResponse);

    $scope.launchUser();
    $httpBackend.flush();

    expect($scope.launchFailed).toBe(true);
  });
});