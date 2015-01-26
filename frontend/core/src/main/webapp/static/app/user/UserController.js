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

 function UserController($http, $location, $q, $rootScope, $scope, $templateCache, $window,
                         AnalyticsService, AuthenticationService, SwiperService,
                         SynchronizeService, UISessionService, UserService, UserSessionService, version) {

  $scope.extendedMindVersion = version;

  $scope.isAdmin = function isAdmin() {
    return UserSessionService.getUserType() === 0;
  };

  $scope.gotoAdmin = function gotoAdmin() {
    $location.path('/admin');
  };

  $scope.useCollectives = function useCollectives() {
    return $scope.collectives && Object.keys($scope.collectives).length > 1;
  };

  $scope.setMyActive = function setMyActive() {
    if (!$location.path().startsWith('/my')) {
      UISessionService.setMyActive();
      UISessionService.changeFeature('tasks');
      $location.path('/my');
      $templateCache.removeAll();
    } else {
      $scope.toggleMenu();
    }
  };

  $scope.setCollectiveActive = function setCollectiveActive(uuid) {
    if (!$location.path().startsWith('/collective/' + uuid)) {
      UISessionService.setCollectiveActive(uuid);
      UISessionService.changeFeature('tasks');
      $location.path('/collective/' + uuid);
      $templateCache.removeAll();
    }
  };

  $scope.isCollectiveActive = function(uuid) {
    if (UISessionService.getActiveUUID() === uuid) return true;
  };

  $scope.isMyActive = function() {
    if (UISessionService.getActiveUUID() === UserSessionService.getUserUUID()) return true;
  };

  $scope.getUserEmail = function(){
    return UserSessionService.getEmail();
  };

  // NAVIGATION

  $scope.activeDetails = undefined;
  $scope.swipeToDetails = function(detailsType){
    $scope.activeDetails = detailsType;
    if (detailsType === 'settings'){
      initializeSettings();
    }
    SwiperService.swipeTo('user/details');
  };

  $scope.swipeToHome = function(){
    SwiperService.swipeTo('user/home');
  };

  // LOGOUT

  $scope.logOut = function logOut() {
    $scope.loggingOut = true;
    $scope.logoutFailed = false;
    $scope.logoutOffline = false;
    UserService.logout().then(function() {
      $rootScope.$emit('emException', {type: 'redirectToEntry'});
    },function(error){
      if (error.type === 'offline') {
        AnalyticsService.error('logout', 'offline');
        $scope.logoutOffline = true;
      } else if (error.type === 'forbidden') {
        AnalyticsService.error('logout', 'failed');
        $scope.logoutFailed = true;
      }
      $scope.loggingOut = false;
    });
  };

  // SETTINGS

  function initializeSettings(){
    $scope.settings = {
      hideFooter: UserSessionService.getUIPreference('hideFooter'),
      disableVibration: UserSessionService.getUIPreference('disableVibration')
    };
  }

  $scope.settingsCheckboxClicked = function(preference) {
    if ($scope.settings[preference] !== undefined){
      UserSessionService.setUIPreference(preference, $scope.settings[preference]);
      UserService.saveAccountPreferences();
    }
  };

  // TODO: reset onboarding!
  $scope.showOnboardingCheckbox = function showOnboardingCheckbox() {
    return UserSessionService.getUserType() === 0 || UserSessionService.getUserType() === 1;
  };

  // TERMS AND PRIVACY

  $scope.openTermsInEditor = function(){
    var user  = UserSessionService.getUser();
    $http.get('http://ext.md/terms.html').then(function(termsResponse){
      user.terms = termsResponse.data;
      $scope.openEditor('user', user, 'terms');
    });
  };

  $scope.openPrivacyInEditor = function(){
    var user  = UserSessionService.getUser();
    $http.get('http://ext.md/privacy.html').then(function(privacyResponse){
      user.privacy = privacyResponse.data;
      $scope.openEditor('user', user, 'privacy');
    });
  };

  // OFFLINE MODIFICATIONS
  $scope.getOfflineModifiedCount = function(itemType) {
    var modifiedItems = SynchronizeService.getModifiedItems(itemType, UISessionService.getActiveUUID());
    if (modifiedItems && modifiedItems.length){
      return modifiedItems.length;
    }
  };

  $scope.getLastSyncedText = function(){
    var lastSyncedText;
    var itemsSynced = UserSessionService.getItemsSynchronized(UISessionService.getActiveUUID());
    if (itemsSynced){
      lastSyncedText = 'last synced: ';
      if (Date.now() - itemsSynced < 3000){
        lastSyncedText = lastSyncedText + 'just now';
      }else if (Date.now() - itemsSynced < 10000){
        lastSyncedText = lastSyncedText + 'less than 10 seconds ago';
      }else if (Date.now() - itemsSynced < 20000){
        lastSyncedText = lastSyncedText + 'less than 20 seconds ago';
      }else if (Date.now() - itemsSynced < 60000){
        lastSyncedText = lastSyncedText + 'less than a minute ago';
      }else if (Date.now() - itemsSynced < 600000){
        lastSyncedText = lastSyncedText + 'less than 10 minutes ago';
      }else if (Date.now() - itemsSynced < 3600000){
        lastSyncedText = lastSyncedText + 'in the past hour';
      }else if (Date.now() - itemsSynced >= 3600000){
        lastSyncedText = lastSyncedText + 'over an hour ago';
      }
    }else{
      lastSyncedText = 'backing up data';
    }
    return lastSyncedText;
  }
}
UserController['$inject'] = ['$http', '$location', '$q', '$rootScope', '$scope', '$templateCache', '$window',
'AnalyticsService', 'AuthenticationService', 'SwiperService',
'SynchronizeService', 'UISessionService', 'UserService', 'UserSessionService',
'version'];
angular.module('em.user').controller('UserController', UserController);
