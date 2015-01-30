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

 function RecurringEditorController($scope, DrawerService, ItemsService, TasksService, UISessionService) {

  // Start from the first item.
  var iterableItem = $scope.iterableItems[0];

  // Set initial $scope variable.
  if ($scope.mode === 'item') {
    $scope.item = iterableItem;
    itemType = 'item';
  }

  var itemType;
  function setItemType(type) {
    itemType = type;
  }

  $scope.getItemType = function() {
    return itemType;
  };

  $scope.getIterableItemIndex = function() {
    return $scope.iterableItems.indexOf(iterableItem);
  };

  var iterableItemDirty;
  function setIterableItemDirty(dirty) {
    iterableItemDirty = dirty;
  }

  $scope.isIterableItemDirty = function() {
    return iterableItemDirty;
  };

  function resetLeftOverVariables() {
    // Reset $scope variables. These may exist from previous editor.
    $scope.task = undefined;
    $scope.note = undefined;
    $scope.list = undefined;
    $scope.item = undefined;
  }

  $scope.endSorting = $scope.closeEditor;

  function initializeAndGotoNextItemOrEndSortingOnLast() {
    var iterableItemIndex = $scope.getIterableItemIndex();
    if (iterableItemIndex < $scope.iterableItems.length - 1) {
      // Still more items.
      resetLeftOverVariables();

      iterableItem = $scope.iterableItems[iterableItemIndex + 1];
      $scope.item = iterableItem;
      setIterableItemDirty(false);
      setItemType($scope.mode);
      DrawerService.enableDragging('right');

    } else {
      // End.
      $scope.closeEditor();
    }

  }
  var aboutToCloseCallbackRegistered;
  var interceptedRegisterAboutToCloseCallback = $scope.registerFeatureEditorAboutToCloseCallback;
  $scope.registerFeatureEditorAboutToCloseCallback = function() {
    if (!aboutToCloseCallbackRegistered) {
      aboutToCloseCallbackRegistered = true;
      interceptedRegisterAboutToCloseCallback();
    }
  };

  $scope.saveItemAndGotoNextItem = function() {
    var itemType = $scope.getItemType();

    if ($scope.mode === 'item') {
      if (itemType === 'item') {
        $scope.saveItem($scope.item);
        initializeAndGotoNextItemOrEndSortingOnLast();
      }
      else if (itemType === 'task') {
        var task = $scope.task;
        initializeAndGotoNextItemOrEndSortingOnLast();

        ItemsService.itemToTask(task, UISessionService.getActiveUUID()).then(function() {
          if (task.trans.optimisticComplete()) $scope.toggleCompleteTask(task);
        });
      } else if (itemType === 'note') {
        ItemsService.itemToNote($scope.note, UISessionService.getActiveUUID())
        .then(initializeAndGotoNextItemOrEndSortingOnLast);
      }
    }
  };

  $scope.undoSorting = function() {
    resetLeftOverVariables();

    if ($scope.getItemType() === 'note') {
      if (iterableItem.trans.content) {
        iterableItem.trans.description = iterableItem.trans.content;
        delete iterableItem.trans.content;
      }
    }

    if ($scope.mode === 'item') {
      $scope.item = iterableItem;
      setItemType('item');
    }

    setIterableItemDirty(false);
    DrawerService.enableDragging('right');
  };

  // OVERRIDDEN METHODS

  $scope.convertToTask = function(){
    $scope.task = TasksService.prepareConvertTask(iterableItem);
    setItemType('task');
    setIterableItemDirty(true);
    DrawerService.disableDragging('right');
  };

  $scope.convertToNote = function() {
    if (iterableItem.trans.description) {
      iterableItem.trans.content = iterableItem.trans.description;
      delete iterableItem.trans.description;
    }
    $scope.note = iterableItem;
    setItemType('note');
    setIterableItemDirty(true);
    DrawerService.disableDragging('right');
  };

  $scope.processDelete = function() {
    if ($scope.mode === 'item') $scope.deleteItem($scope.item);
    initializeAndGotoNextItemOrEndSortingOnLast();
  };

  $scope.processClose = $scope.saveItemAndGotoNextItem;

  $scope.handleTitlebarEnterAction = angular.noop;
}

RecurringEditorController['$inject'] = ['$scope', 'DrawerService', 'ItemsService', 'TasksService',
'UISessionService'];
angular.module('em.main').controller('RecurringEditorController', RecurringEditorController);
