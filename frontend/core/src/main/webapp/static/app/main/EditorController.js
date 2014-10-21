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

 function EditorController($rootScope, $scope, ListsService, SwiperService, UISessionService) {

  // OPENING, INITIALIZING, CLOSING

  var currentItem;
  function editorAboutToOpen(editorType, item, mode) {
    $scope.editorType = editorType;
    $scope.editorVisible = true;
    $scope.mode = mode;
    currentItem = item;
  }

  function editorAboutToClose() {
    if (typeof featureEditorAboutToCloseCallback === 'function') featureEditorAboutToCloseCallback();
  }

  $scope.getItemInEdit = function(){
    return currentItem;
  };

  // Callback from Snap.js, outside of AngularJS event loop
  function editorOpened() {
    if (typeof titleBarInputFocusCallbackFunction === 'function'){
      if (!$scope.$$phase && !$rootScope.$$phase){
        $scope.$apply(setFocusOnTitlebarInput);
      }else{
        setFocusOnTitlebarInput();
      }
    }
 }

  // Callback from Snap.js, outside of AngularJS event loop
  function editorClosed() {
    // Don't manipulate list items in list before editor has been closed.
    UISessionService.resolveDeferredActions('edit');

    // NOTE: Call $apply here if these don't seem to be reseted
    $scope.editorType = undefined;
    $scope.mode = undefined;
    $scope.editorVisible = false;
    currentItem = false;
    titleBarInputFocusCallbackFunction = titleBarInputBlurCallbackFunction = undefined;
  }

  if (angular.isFunction($scope.registerEditorAboutToOpenCallback))
    $scope.registerEditorAboutToOpenCallback(editorAboutToOpen, 'EditorController');

  if (angular.isFunction($scope.registerEditorAboutToCloseCallback))
    $scope.registerEditorAboutToCloseCallback(editorAboutToClose, 'EditorController');

  if (angular.isFunction($scope.registerEditorClosedCallback))
    $scope.registerEditorClosedCallback(editorClosed, 'EditorController');

  if (angular.isFunction($scope.registerEditorOpenedCallback))
    $scope.registerEditorOpenedCallback(editorOpened, 'EditorController');

  $scope.$on('$destroy', function() {
    if (angular.isFunction($scope.unregisterEditorAboutToOpenCallback))
      $scope.unregisterEditorAboutToOpenCallback('EditorController');

    if (angular.isFunction($scope.unregisterEditorAboutToCloseCallback))
      $scope.unregisterEditorAboutToCloseCallback('EditorController');

    if (angular.isFunction($scope.unregisterEditorOpenedCallback))
      $scope.unregisterEditorOpenedCallback('EditorController');

    if (angular.isFunction($scope.unregisterEditorClosedCallback))
      $scope.unregisterEditorClosedCallback('EditorController');
  });

  // HELPER METHODS

  $scope.saveNewListToExtendedItem = function(item, newList, readyFn) {
    if (newList && newList.title)
      $scope.saveList($scope.newList).then(
                                           function(savedList){
          // success
          if (item.transientProperties) item.transientProperties = {};
          item.transientProperties.list = savedList.uuid;
          readyFn(item);
        },
        function(){
          // failure
          readyFn(item);
        });
    else {
      readyFn(item);
    }
  };

  var featureEditorAboutToCloseCallback;
  $scope.registerFeatureEditorAboutToCloseCallback = function(callback) {
    featureEditorAboutToCloseCallback = callback;
  };

  $scope.deferEdit = function(){
    return UISessionService.deferAction('edit', $rootScope.EDITOR_CLOSED_FAILSAFE_TIME);
  };

  // TITLEBAR

  $scope.titlebar = {};

  var titleBarInputFocusCallbackFunction;
  var titleBarInputBlurCallbackFunction;

  $scope.registerTitleBarInputCallbacks = function (focusCallback, blurCallback) {
    titleBarInputFocusCallbackFunction = focusCallback;
    titleBarInputBlurCallbackFunction = blurCallback;
  };

  function setFocusOnTitlebarInput() {
    if (typeof titleBarInputFocusCallbackFunction === 'function') titleBarInputFocusCallbackFunction();
  }
  function blurTitlebarInput() {
    if (typeof titleBarInputBlurCallbackFunction === 'function') titleBarInputBlurCallbackFunction();
  }

  $scope.titlebarHasText = function() {
    return $scope.titlebar.text && $scope.titlebar.text.length !== 0;
  };

  $scope.handleBasicTitlebarKeydown = function(keydownEvent, item){
    // Escape
    if (keydownEvent.keyCode === 27){
      blurTitlebarInput();
    }
    else if (item && $scope.titlebarHasText()){
      // Change task title at the same time, but not if its empty
      item.title = $scope.titlebar.text;
    }
  };

  // NAVIGATION

  $scope.isFirstSlide = function(){
    return SwiperService.isSlideActive($scope.editorType + 'Editor/basic');
  };

  $scope.swipeToAdvanced = function() {
    SwiperService.swipeTo($scope.editorType + 'Editor/advanced');
  };

  $scope.swipeToBasic = function() {
    SwiperService.swipeTo($scope.editorType + 'Editor/basic');
  };

  $scope.editorSwiperSlideChanged = function(){
    // Need to digest on slide change to get changes to header to bite
    if (!$rootScope.$$phase && !$scope.$$phase)
      $scope.$digest();
  };

  // DROP-DOWN LIST WIDGET
  $scope.openDropDownList = function() {
    $scope.dropDownListOpen = true;
  };
  $scope.closeDropDownList = function() {
    $scope.dropDownListOpen = false;
  };
  $scope.getListFromUUID = function(uuid) {
    var list = ListsService.getListByUUID(uuid, UISessionService.getActiveUUID());
    if (list) return list;
  };
  $scope.getListTitleFromUUID = function(uuid) {
    var list = ListsService.getListByUUID(uuid, UISessionService.getActiveUUID());
    if (list) return list.title;
  };

  $scope.closeDropDownListAndSetListToItem = function(item, listUUID) {
    $scope.closeDropDownList();
    if (!item.transientProperties) item.transientProperties = {};
    item.transientProperties.list = listUUID;
  };

  $scope.closeDropDownListAndClearListFromItem = function(item, listUUID) {
    $scope.closeDropDownList();
    if (item.transientProperties && item.transientProperties.list === listUUID)
      delete item.transientProperties.list;
  };
}

EditorController['$inject'] = ['$rootScope', '$scope', 'ListsService', 'SwiperService', 'UISessionService'];
angular.module('em.main').controller('EditorController', EditorController);
